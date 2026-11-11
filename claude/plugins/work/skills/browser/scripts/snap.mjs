#!/usr/bin/env node
/**
 * 변경 화면 보고서 — 작업 전/후 화면을 찍어 "어디가 바뀌었는지"를 보여준다.
 * check.mjs 와 목적이 다르다: 저건 "지금 동작하나", 이건 "무엇이 달라졌나".
 *
 * 사용:
 *   node snap.mjs capture before <url> [<url> ...] [--out dir] [--mobile] [--mask "css,css"]
 *   (구현)
 *   node snap.mjs capture after  <url> [<url> ...] [--out dir] [--mobile] [--mask "css,css"]
 *   node snap.mjs report [--out dir]
 *
 *   --out    산출 디렉터리 (기본 .claude/snapshots/current). 티켓마다 따로: .claude/snapshots/PROJ-123
 *   --mask   매번 달라지는 영역(시계·랜덤 배너 등)을 가린다. 쉼표 구분 CSS 셀렉터
 *   --mobile 390x844 뷰포트로 찍는다 (before/after 는 같은 옵션으로 찍어야 비교된다)
 *   --storage 로그인 상태 파일 (context.storageState({ path }) 로 저장한 auth.json)
 *
 * 산출:
 *   <out>/before/<slug>.png, <slug>.aria.txt     작업 전
 *   <out>/after/<slug>.png,  <slug>.aria.txt     작업 후
 *   <out>/diff/<slug>.png                        바뀐 픽셀(빨강) + 바뀐 영역 박스
 *   <out>/report.html                            전/후/차이 나란히 + 슬라이더 + 구조 diff
 *   stdout                                       화면별 변경률·영역·구조 변화 요약 (텍스트)
 *
 * 픽셀 비교는 브라우저 canvas 로 한다 — playwright 외 추가 의존성이 없다.
 * 필요:  npm i -D playwright  &&  npx playwright install chromium
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const optValues = new Set(['--out', '--mask', '--storage'].map((f) => opt(f, null)).filter(Boolean));
const positional = args.filter((a) => !a.startsWith('--') && !optValues.has(a));

const [cmd, ...rest] = positional;
const OUT = opt('--out', '.claude/snapshots/current');
const executablePath = process.env.PW_CHROME || undefined;

// URL → 파일명. 같은 URL 은 before/after 에서 같은 slug 가 되어야 짝이 맞는다
const slugOf = (u) => {
  const { pathname, search, hash } = new URL(u);
  const s = `${pathname}${search}${hash}`.replace(/[^a-zA-Z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
  return (s || 'root') + (has('--mobile') ? '@mobile' : '');
};

const usage = () => {
  console.error('사용법:\n  node snap.mjs capture <before|after> <url...> [--out dir] [--mobile] [--mask css] [--storage auth.json]\n  node snap.mjs report [--out dir]');
  process.exit(2);
};

// ───────────────────────────────── capture
async function capture(label, urls) {
  if (!['before', 'after'].includes(label) || urls.length === 0) usage();
  const dir = path.join(OUT, label);
  fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ executablePath });
  const storage = opt('--storage', null);
  if (storage && !fs.existsSync(storage)) { console.error(`--storage 파일이 없다: ${storage}`); process.exit(2); }
  const context = await browser.newContext({
    ...(has('--mobile')
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
      : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }),
    ...(storage ? { storageState: storage } : {}),
  });
  // 매번 달라지는 요소가 diff 를 오염시키지 않게
  await context.addInitScript(() => {
    const css = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = css;
      document.head.appendChild(s);
    });
  });
  const masks = (opt('--mask', '') || '').split(',').map((s) => s.trim()).filter(Boolean);

  const meta = { label, capturedAt: new Date().toISOString(), commit: gitHead(), mobile: has('--mobile'), screens: [] };
  let failed = 0;
  for (const url of urls) {
    const slug = slugOf(url);
    const page = await context.newPage();
    try {
      const res = await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
      await page.evaluate(() => document.fonts?.ready);
      await page.screenshot({
        path: path.join(dir, `${slug}.png`),
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        mask: masks.map((m) => page.locator(m)),
      });
      const aria = await page.locator('body').ariaSnapshot().catch((e) => `(스냅샷 실패: ${e.message.split('\n')[0]})`);
      fs.writeFileSync(path.join(dir, `${slug}.aria.txt`), aria + '\n');
      const status = res?.status() ?? null;
      meta.screens.push({ url, slug, status });
      // 4xx/5xx 도 찍어는 두지만 실패로 센다 — 에러 페이지끼리 비교한 보고서는 의미가 없다
      if (status !== null && status >= 400) failed++;
      console.log(`${status !== null && status >= 400 ? '✗' : '✓'} ${label} ${slug}  (${status ?? '?'})  ${url}`);
    } catch (e) {
      failed++;
      meta.screens.push({ url, slug, error: e.message.split('\n')[0] });
      console.log(`✗ ${label} ${slug}  ${e.message.split('\n')[0]}`);
    }
    await page.close();
  }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  await browser.close();
  console.log(`\n저장: ${dir}  (${urls.length - failed}/${urls.length})`);
  process.exit(failed ? 1 : 0);
}

function gitHead() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return dirty ? `${sha}+dirty` : sha;
  } catch { return null; }
}

// ───────────────────────────────── report
async function report() {
  const readMeta = (l) => {
    try { return JSON.parse(fs.readFileSync(path.join(OUT, l, 'meta.json'), 'utf8')); } catch { return null; }
  };
  const before = readMeta('before');
  const after = readMeta('after');
  if (!after) { console.error(`after 캡처가 없다: ${OUT}/after — 먼저 capture after`); process.exit(2); }

  const slugs = [...new Set([...(before?.screens ?? []), ...after.screens].map((s) => s.slug))];
  const urlOf = (slug) => (after.screens.find((s) => s.slug === slug) ?? before?.screens.find((s) => s.slug === slug))?.url;
  fs.mkdirSync(path.join(OUT, 'diff'), { recursive: true });

  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage();
  const results = [];

  for (const slug of slugs) {
    const b = path.join(OUT, 'before', `${slug}.png`);
    const a = path.join(OUT, 'after', `${slug}.png`);
    const hasB = fs.existsSync(b);
    const hasA = fs.existsSync(a);
    const r = { slug, url: urlOf(slug), kind: !hasB ? 'new' : !hasA ? 'gone' : 'compared' };

    if (hasB && hasA) {
      const d = await page.evaluate(pixelDiff, {
        before: 'data:image/png;base64,' + fs.readFileSync(b).toString('base64'),
        after: 'data:image/png;base64,' + fs.readFileSync(a).toString('base64'),
      });
      fs.writeFileSync(path.join(OUT, 'diff', `${slug}.png`), Buffer.from(d.png.split(',')[1], 'base64'));
      Object.assign(r, { ratio: d.ratio, changed: d.changed, boxes: d.boxes, size: d.size, sizeChanged: d.sizeChanged });
    }
    r.aria = lineDiff(readText(path.join(OUT, 'before', `${slug}.aria.txt`)), readText(path.join(OUT, 'after', `${slug}.aria.txt`)));
    results.push(r);
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT, 'report.html'), html(results, before, after));
  printSummary(results);
  console.log(`\n보고서: ${path.resolve(OUT, 'report.html')}`);
}

const readText = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trimEnd().split('\n') : []);

// 브라우저 안에서 실행된다 — canvas 로 픽셀 비교, 바뀐 영역을 격자 단위로 묶어 박스로 만든다
async function pixelDiff({ before, after }) {
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const [ib, ia] = await Promise.all([load(before), load(after)]);
  const W = Math.max(ib.width, ia.width);
  const H = Math.max(ib.height, ia.height);
  const px = (img) => {
    const c = new OffscreenCanvas(W, H);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, W, H).data;
  };
  const pb = px(ib);
  const pa = px(ia);

  const out = new OffscreenCanvas(W, H);
  const ox = out.getContext('2d');
  ox.globalAlpha = 0.25;
  ox.drawImage(ia, 0, 0);            // 바탕은 흐린 after
  ox.globalAlpha = 1;
  const od = ox.getImageData(0, 0, W, H);

  const CELL = 16;
  const gw = Math.ceil(W / CELL);
  const gh = Math.ceil(H / CELL);
  const grid = new Uint8Array(gw * gh);
  const THRESH = 40;                 // 안티앨리어싱 노이즈 무시 (RGBA 차이 합)
  let changed = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const delta = Math.abs(pb[i] - pa[i]) + Math.abs(pb[i + 1] - pa[i + 1]) + Math.abs(pb[i + 2] - pa[i + 2]) + Math.abs(pb[i + 3] - pa[i + 3]);
      if (delta > THRESH) {
        changed++;
        od.data[i] = 255; od.data[i + 1] = 0; od.data[i + 2] = 64; od.data[i + 3] = 255;
        grid[Math.floor(y / CELL) * gw + Math.floor(x / CELL)] = 1;
      }
    }
  }
  ox.putImageData(od, 0, 0);

  // 인접한(1칸 간격 허용) 변경 셀을 하나의 영역으로 묶는다
  const seen = new Uint8Array(gw * gh);
  const boxes = [];
  for (let s = 0; s < grid.length; s++) {
    if (!grid[s] || seen[s]) continue;
    let [x0, y0, x1, y1] = [s % gw, Math.floor(s / gw), s % gw, Math.floor(s / gw)];
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % gw, cy = Math.floor(c / gw);
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const n = ny * gw + nx;
        if (grid[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    boxes.push({ x: x0 * CELL, y: y0 * CELL, w: Math.min((x1 + 1) * CELL, W) - x0 * CELL, h: Math.min((y1 + 1) * CELL, H) - y0 * CELL });
  }
  boxes.sort((p, q) => q.w * q.h - p.w * p.h);

  ox.strokeStyle = '#ff0040';
  ox.lineWidth = 3;
  ox.font = 'bold 16px sans-serif';
  ox.fillStyle = '#ff0040';
  boxes.forEach((b, i) => {
    ox.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    ox.fillText(String(i + 1), b.x + 6, b.y + 20);
  });

  const blob = await out.convertToBlob({ type: 'image/png' });
  const png = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  return {
    png, changed, ratio: changed / (W * H), boxes,
    size: { before: [ib.width, ib.height], after: [ia.width, ia.height] },
    sizeChanged: ib.width !== ia.width || ib.height !== ia.height,
  };
}

// 최소 LCS 라인 diff — aria 스냅샷은 수백 줄 수준이라 O(n·m) 로 충분하다
function lineDiff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push([' ', a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(['-', a[i++]]);
    else ops.push(['+', b[j++]]);
  }
  while (i < n) ops.push(['-', a[i++]]);
  while (j < m) ops.push(['+', b[j++]]);
  return ops;
}

function printSummary(results) {
  console.log('='.repeat(60));
  console.log('변경 화면 요약');
  for (const r of results) {
    const added = r.aria.filter(([o]) => o === '+');
    const removed = r.aria.filter(([o]) => o === '-');
    if (r.kind === 'new') console.log(`\n■ ${r.slug}  — 새 화면 (before 없음)`);
    else if (r.kind === 'gone') console.log(`\n■ ${r.slug}  — after 에서 사라짐`);
    else if (r.changed === 0 && !added.length && !removed.length) { console.log(`\n□ ${r.slug}  — 변화 없음`); continue; }
    else {
      console.log(`\n■ ${r.slug}  — 픽셀 ${(r.ratio * 100).toFixed(2)}% 변경, 영역 ${r.boxes.length}개` +
        (r.sizeChanged ? `, 크기 ${r.size.before.join('x')} → ${r.size.after.join('x')}` : ''));
      r.boxes.slice(0, 5).forEach((b, i) => console.log(`   [${i + 1}] x=${b.x} y=${b.y} ${b.w}x${b.h}`));
      if (r.boxes.length > 5) console.log(`   … 외 ${r.boxes.length - 5}개`);
    }
    if (added.length || removed.length) {
      console.log(`   구조: +${added.length} / -${removed.length}`);
      [...removed.slice(0, 6).map(([, l]) => `   - ${l.trim()}`), ...added.slice(0, 6).map(([, l]) => `   + ${l.trim()}`)].forEach((l) => console.log(l));
    }
  }
  console.log('='.repeat(60));
}

function html(results, before, after) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const sections = results.map((r) => {
    const src = (l) => `${l}/${encodeURIComponent(r.slug)}.png`;
    const ariaChanged = r.aria.some(([o]) => o !== ' ');
    const badge = r.kind === 'new' ? '새 화면' : r.kind === 'gone' ? '사라짐'
      : r.changed === 0 && !ariaChanged ? '변화 없음' : `${(r.ratio * 100).toFixed(2)}% · 영역 ${r.boxes.length}`;
    const visual = r.kind === 'compared'
      ? `<div class="tabs" data-slug="${esc(r.slug)}">
          <button class="on" data-v="slider">슬라이더</button><button data-v="side">나란히</button><button data-v="diff">차이</button>
        </div>
        <div class="view slider on"><div class="cmp" style="--p:50%">
          <img src="${src('after')}" alt="after"><div class="top"><img src="${src('before')}" alt="before"></div>
          <input type="range" min="0" max="100" value="50" aria-label="전/후 비교 위치">
          <span class="lab l">before</span><span class="lab r">after</span></div></div>
        <div class="view side"><figure><figcaption>before</figcaption><img src="${src('before')}"></figure>
          <figure><figcaption>after</figcaption><img src="${src('after')}"></figure></div>
        <div class="view diff"><img src="diff/${encodeURIComponent(r.slug)}.png" alt="diff">
          ${r.boxes.length ? `<ol class="boxes">${r.boxes.slice(0, 20).map((b) => `<li>x ${b.x}, y ${b.y} — ${b.w}×${b.h}</li>`).join('')}</ol>` : ''}</div>`
      : `<figure><figcaption>${r.kind === 'new' ? 'after' : 'before'}</figcaption><img src="${src(r.kind === 'new' ? 'after' : 'before')}"></figure>`;
    const aria = ariaChanged
      ? `<details open><summary>화면 구조(aria) 변화</summary><pre>${r.aria
          .map(([o, l], i, all) => (o !== ' ' || all.slice(Math.max(0, i - 2), i + 3).some(([x]) => x !== ' ')) ? `<span class="${o === '+' ? 'add' : o === '-' ? 'del' : ''}">${o} ${esc(l)}</span>` : null)
          .filter(Boolean).join('')}</pre></details>`
      : '<p class="muted">화면 구조(aria)는 동일하다.</p>';
    return `<section class="${r.changed === 0 && !ariaChanged && r.kind === 'compared' ? 'same' : ''}">
      <h2>${esc(r.slug)} <span class="badge">${badge}</span></h2>
      <p class="muted"><a href="${esc(r.url ?? '#')}">${esc(r.url ?? '')}</a></p>
      ${visual}${aria}</section>`;
  }).join('\n');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>변경 화면 보고서</title><style>
:root{--bg:#fff;--fg:#1a1a1a;--muted:#6b6b6b;--line:#e3e3e3;--card:#f7f7f7;--add:#e6f6ea;--del:#fdeaea;--accent:#ff0040}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#ececec;--muted:#9a9a9a;--line:#2e2e2e;--card:#1d1d1d;--add:#16301d;--del:#3a1a1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif}
header,main{max-width:1200px;margin:0 auto;padding:16px}header{border-bottom:1px solid var(--line)}h1{font-size:20px;margin:8px 0}
h2{font-size:17px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.badge{font-size:12px;padding:2px 8px;border-radius:99px;background:var(--accent);color:#fff}
.same .badge{background:var(--muted)}.muted{color:var(--muted);font-size:13px;margin:4px 0}section{padding:16px 0;border-bottom:1px solid var(--line)}
img{max-width:100%;display:block;border:1px solid var(--line)}.tabs{display:flex;gap:4px;margin:8px 0}
.tabs button{font:inherit;font-size:13px;padding:4px 12px;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:6px;cursor:pointer}
.tabs button.on{background:var(--fg);color:var(--bg)}.view{display:none}.view.on{display:block}.side.on{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:700px){.side.on{grid-template-columns:1fr}}figure{margin:0}figcaption{font-size:12px;color:var(--muted);margin-bottom:4px}
.cmp{position:relative;display:inline-block;max-width:100%}.cmp .top{position:absolute;inset:0;width:var(--p);overflow:hidden;border-right:2px solid var(--accent)}
.cmp .top img{max-width:none;width:auto;height:100%}.cmp input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;margin:0}
.lab{position:absolute;top:8px;font-size:12px;background:rgba(0,0,0,.6);color:#fff;padding:2px 6px;border-radius:4px}.lab.l{left:8px}.lab.r{right:8px}
pre{background:var(--card);padding:12px;overflow:auto;font-size:12.5px;border-radius:6px}pre span{display:block;white-space:pre}pre .add{background:var(--add)}pre .del{background:var(--del)}
.boxes{font-size:13px;color:var(--muted)}details summary{cursor:pointer;margin:8px 0}a{color:inherit}
</style></head><body><header><h1>변경 화면 보고서</h1>
<p class="muted">before ${before ? `${esc(before.commit ?? '-')} · ${esc(before.capturedAt)}` : '캡처 없음'}<br>after ${esc(after.commit ?? '-')} · ${esc(after.capturedAt)}</p>
<p class="muted">요소가 끼어들면 그 아래가 밀려 전부 바뀐 것으로 잡힌다 — 실제로 무엇이 생기고 사라졌는지는 구조 diff 를 본다.</p>
<p class="muted">빨간 박스 = 픽셀이 바뀐 영역 (번호는 큰 순). 구조 diff 의 <b>+</b>/<b>−</b> 는 화면에 생기거나 사라진 요소다.</p></header>
<main>${sections}</main><script>
document.querySelectorAll('.cmp').forEach(c=>{const top=c.querySelector('.top img'),base=c.querySelector(':scope>img'),r=c.querySelector('input');
const fit=()=>{top.style.width=base.clientWidth+'px'};base.addEventListener('load',fit);addEventListener('resize',fit);fit();
r.addEventListener('input',()=>c.style.setProperty('--p',r.value+'%'))});
document.querySelectorAll('.tabs').forEach(t=>t.addEventListener('click',e=>{const v=e.target.dataset.v;if(!v)return;
t.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===e.target));
t.parentElement.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.classList.contains(v)))}));
</script></body></html>`;
}

// 디스패치는 맨 끝 — 위의 const 헬퍼가 모두 초기화된 뒤에 실행돼야 한다
if (cmd === 'capture') await capture(rest[0], rest.slice(1));
else if (cmd === 'report') await report();
else usage();
