#!/usr/bin/env node
/**
 * 자가검수 스크립트 — 방금 구현한 화면이 동작하는지 텍스트로 뽑아 확인한다.
 *
 * 사용:
 *   node check.mjs http://localhost:3000/signup
 *   node check.mjs http://localhost:3000 --shot           스크린샷도 저장
 *   node check.mjs http://localhost:3000 --headed         브라우저 보면서
 *   node check.mjs http://localhost:3000 --mobile         모바일 뷰포트
 *   node check.mjs http://localhost:3000 --selector "main"  일부만 스냅샷
 *   node check.mjs http://localhost:3000 --ignore "analytics|sentry"  노이즈 제외
 *
 * 문제(콘솔 에러 / 실패 요청 / 비정상 상태)가 있으면 exit code 1.
 * favicon 등 무해한 노이즈는 기본으로 걸러낸다 (IGNORE 상수 참고).
 *
 * 필요:  npm i -D playwright  &&  npx playwright install chromium
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) {
  console.error('사용법: node check.mjs <url> [--shot] [--headed] [--mobile] [--selector <css>]');
  process.exit(2);
}
const has = (f) => args.includes(f);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);

// 브라우저 실행 파일을 직접 지정해야 하는 환경(샌드박스 등)을 위한 탈출구
const executablePath = process.env.PW_CHROME || undefined;

// 판정에서 제외할 무해한 노이즈. 프로젝트에 맞게 늘려서 쓴다.
const IGNORE = [/favicon/i, /\/__nextjs/, /devtools/i, /\.map(\?|$)/];
const extraIgnore = opt('--ignore', null);
if (extraIgnore) IGNORE.push(new RegExp(extraIgnore, 'i'));
const noise = (s) => IGNORE.some((re) => re.test(s));

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const ignored = [];

const browser = await chromium.launch({ headless: !has('--headed'), executablePath });
const context = await browser.newContext(
  has('--mobile')
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }
    : { viewport: { width: 1280, height: 800 } }
);
const page = await context.newPage();

// "Failed to load resource"는 브라우저가 네트워크 실패를 콘솔로 되풀이하는 것이라
// FAILED REQUESTS와 중복된다. 콘솔 목록에서는 뺀다.
const isNetworkEcho = (t) => /Failed to load resource/i.test(t);

page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (isNetworkEcho(t)) return;
  (noise(t) ? ignored : consoleErrors).push(t);
});
page.on('pageerror', (e) => {
  const t = `${e.name}: ${e.message}`;
  (noise(t) ? ignored : pageErrors).push(t);
});
page.on('requestfailed', (r) => {
  const t = `${r.method()} ${r.url()} — ${r.failure()?.errorText ?? 'failed'}`;
  (noise(r.url()) ? ignored : failedRequests).push(t);
});
page.on('response', (r) => {
  if (r.status() < 400) return;
  const t = `${r.status()} ${r.url()}`;
  (noise(r.url()) ? ignored : failedRequests).push(t);
});

let status = null;
let navError = null;
try {
  const res = await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
  status = res?.status() ?? null;
  // 초기 렌더 직후 발생하는 클라이언트 에러를 놓치지 않기 위한 짧은 여유
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
} catch (e) {
  navError = e.message;
}

console.log('='.repeat(60));
console.log('URL     :', url);
console.log('STATUS  :', status ?? '(이동 실패)');
if (navError) console.log('NAV ERR :', navError.split('\n')[0]);

if (!navError) {
  console.log('TITLE   :', await page.title());
  console.log('CHARSET :', await page.evaluate(() => document.characterSet));

  // 가장 정보량이 큰 출력 — 화면 구조를 텍스트로
  const target = page.locator(opt('--selector', 'body'));
  console.log('\n--- ARIA SNAPSHOT ---');
  try {
    console.log(await target.ariaSnapshot());
  } catch (e) {
    console.log('(스냅샷 실패:', e.message.split('\n')[0], ')');
  }

  // 눈에 보이는 텍스트가 실제로 있는지 (빈 화면 조기 탐지)
  const visibleText = (await page.locator('body').innerText().catch(() => '')).trim();
  console.log('\nVISIBLE TEXT LENGTH:', visibleText.length);
  if (visibleText.length === 0) console.log('⚠️  화면에 보이는 텍스트가 없다 — 렌더링 실패 가능성');

  if (has('--shot')) {
    const file = `check-${has('--mobile') ? 'mobile' : 'desktop'}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log('SCREENSHOT:', file);
  }
}

console.log('\n--- CONSOLE ERRORS (%d) ---', consoleErrors.length);
consoleErrors.forEach((e) => console.log(' •', e));
console.log('--- UNCAUGHT PAGE ERRORS (%d) ---', pageErrors.length);
pageErrors.forEach((e) => console.log(' •', e));
console.log('--- FAILED REQUESTS (%d) ---', failedRequests.length);
failedRequests.forEach((e) => console.log(' •', e));
if (ignored.length) {
  console.log('--- IGNORED AS NOISE (%d) ---', ignored.length);
  ignored.forEach((e) => console.log(' ·', e));
}

await browser.close();

const bad =
  navError !== null ||
  (status !== null && status >= 400) ||
  consoleErrors.length > 0 ||
  pageErrors.length > 0 ||
  failedRequests.length > 0;

console.log('='.repeat(60));
console.log(bad ? '결과: 문제 있음' : '결과: 통과');
process.exit(bad ? 1 : 0);
