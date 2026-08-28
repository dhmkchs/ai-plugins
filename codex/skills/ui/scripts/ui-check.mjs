#!/usr/bin/env node
// 시안 대조용 값 추출. browser/scripts/check.mjs 와 목적이 다르다 — 동작이 아니라 값을 본다.
//
//   node ui-check.mjs <url> [targets.json]
//
// targets.json 예 (없으면 페이지의 heading/button/textbox 를 자동으로 잡는다):
//   {
//     "widths": [1440, 1280, 375],
//     "elements": [
//       { "role": "heading", "name": "사용자 등록" },
//       { "role": "button",  "name": "가입" }
//     ],
//     "gaps": [ { "from": "h1", "to": "h1 + p", "label": "제목→본문" } ]
//   }
import { chromium } from 'playwright';
import fs from 'node:fs';

const [url, targetsPath] = process.argv.slice(2);
if (!url) { console.error('usage: node ui-check.mjs <url> [targets.json]'); process.exit(2); }

const cfg = targetsPath ? JSON.parse(fs.readFileSync(targetsPath, 'utf8')) : {};
const widths = cfg.widths ?? [1440, 1280, 375];
const gaps = cfg.gaps ?? [];

const browser = await chromium.launch();
const out = { url, widths: {} };

for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 812 : 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  // 웹폰트가 적용되기 전에 재면 폰트 크기·줄바꿈이 시안과 다르게 나온다
  await page.evaluate(() => document.fonts?.ready);

  // 대상이 지정되지 않았으면 접근성 트리에서 주요 요소를 자동으로 잡는다
  let elements = cfg.elements;
  if (!elements) {
    elements = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,button,a[href],input,label')]
        .slice(0, 12)
        .map(n => ({ sel: n.tagName.toLowerCase(), text: (n.textContent || n.getAttribute('placeholder') || '').trim().slice(0, 30) })));
  }

  const measured = [];
  for (const el of elements) {
    const locator = el.role
      ? page.getByRole(el.role, { name: el.name, exact: el.exact ?? false }).first()
      : page.locator(el.selector ?? el.sel).filter(el.text ? { hasText: el.text } : {}).first();
    if (await locator.count() === 0) { measured.push({ ...el, found: false }); continue; }
    const v = await locator.evaluate(n => {
      const s = getComputedStyle(n), r = n.getBoundingClientRect();
      return {
        size: `${Math.round(r.width)}×${Math.round(r.height)}`,
        pos: `${Math.round(r.x)},${Math.round(r.y)}`,
        font: `${s.fontSize}/${s.lineHeight} ${s.fontWeight} ${s.fontFamily.split(',')[0]}`,
        pad: s.padding, radius: s.borderRadius,
        bg: s.backgroundColor, color: s.color, border: s.borderWidth === '0px' ? 'none' : `${s.borderWidth} ${s.borderColor}`,
      };
    });
    measured.push({ ...el, found: true, ...v });
  }

  // 간격은 두 요소의 경계로 잰다 — margin 값을 읽는 것보다 정확하다(마진 상쇄가 있다)
  const measuredGaps = [];
  for (const g of gaps) {
    const px = await page.evaluate(({ from, to }) => {
      const a = document.querySelector(from), b = document.querySelector(to);
      if (!a || !b) return null;
      return Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom);
    }, g);
    measuredGaps.push({ ...g, px });
  }

  // 가로 스크롤이 생기면 그 폭에서 레이아웃이 깨진 것이다
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  await page.screenshot({ path: `ui-${width}.png`, fullPage: true });
  out.widths[width] = { elements: measured, gaps: measuredGaps, horizontalOverflow: overflow };
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));

const broken = Object.entries(out.widths).filter(([, v]) => v.horizontalOverflow).map(([w]) => w);
const missing = Object.values(out.widths).flatMap(v => v.elements.filter(e => !e.found));
if (broken.length) console.error(`가로 스크롤 발생: ${broken.join(', ')}px`);
if (missing.length) console.error(`찾지 못한 대상 ${missing.length}건 — 셀렉터나 문구를 확인한다`);
if (broken.length || missing.length) process.exit(1);
