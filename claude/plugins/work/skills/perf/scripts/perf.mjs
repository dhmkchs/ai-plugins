#!/usr/bin/env node
// 성능 기준선·재측정 스크립트. 기준선과 재측정에 반드시 같은 파일·같은 인자를 쓴다.
//
//   node perf.mjs <url> [runs] [budget.json]
//
// 예산 파일을 주면 중앙값을 비교하고 초과 시 exit 1 로 끝난다 (CI 게이트용).
//   { "lcp": 2500, "cls": 0.1, "tbt": 200, "scriptKB": 400 }
import { chromium } from 'playwright';
import fs from 'node:fs';

const [url, runs = '3', budgetPath] = process.argv.slice(2);
if (!url) { console.error('usage: node perf.mjs <url> [runs] [budget.json]'); process.exit(2); }

async function once() {
  const browser = await chromium.launch();
  // 모바일 기준. Lighthouse 기본 프로파일에 맞춘다
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);

  await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.emulateNetworkConditions', {   // Lighthouse 기본: 느린 4G
    offline: false, latency: 150,
    downloadThroughput: 1.6 * 1024 * 1024 / 8,
    uploadThroughput: 750 * 1024 / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // 관측자는 goto 이전에 심는다. 나중에 심으면 초기 엔트리를 놓친다
  await page.addInitScript(() => {
    window.__p = { lcp: 0, lcpEl: '', cls: 0, shifts: [], long: [] };
    new PerformanceObserver(l => { for (const e of l.getEntries()) {
      window.__p.lcp = e.startTime;
      window.__p.lcpEl = e.element?.tagName + (e.url ? ' ' + e.url : '');
    }}).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) {
      window.__p.cls += e.value;
      window.__p.shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime),
        nodes: (e.sources || []).map(s => s.node?.nodeName).filter(Boolean) });
    }}).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries())
      window.__p.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) });
    }).observe({ type: 'longtask', buffered: true });
  });

  await page.goto(url, { waitUntil: 'load' });
  // 여기서의 고정 대기는 의도된 측정 창이다. browser 스킬이 금지하는 것은 상호작용 대기다
  await page.waitForTimeout(4000);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    const tbt = window.__p.long.filter(t => t.t > fcp)
      .reduce((s, t) => s + Math.max(0, t.d - 50), 0);
    const res = performance.getEntriesByType('resource');
    const kb = t => Math.round(res.filter(r => r.initiatorType === t)
      .reduce((s, r) => s + (r.transferSize || 0), 0) / 1024);
    return {
      ttfb: Math.round(nav.responseStart), fcp: Math.round(fcp),
      lcp: Math.round(window.__p.lcp), lcpEl: window.__p.lcpEl,
      cls: +window.__p.cls.toFixed(3), tbt: Math.round(tbt),
      shifts: window.__p.shifts, longTasks: window.__p.long.length,
      totalKB: Math.round(res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
      scriptKB: kb('script'), cssKB: kb('link'), imgKB: kb('img'),
    };
  });

  await browser.close();
  return m;
}

const KEYS = ['ttfb', 'fcp', 'lcp', 'cls', 'tbt', 'totalKB', 'scriptKB', 'cssKB', 'imgKB'];
const all = [];
for (let i = 0; i < Number(runs); i++) all.push(await once());
const med = k => all.map(r => r[k]).sort((a, b) => a - b)[Math.floor(all.length / 2)];
const median = Object.fromEntries(KEYS.map(k => [k, med(k)]));

const report = {
  url, runs: all.length,
  condition: '모바일 412x915 · 느린 4G(150ms/1.6Mbps) · CPU 4x · 캐시 비움',
  median,
  lcpElement: all[0].lcpEl,
  worstShifts: all[0].shifts.sort((a, b) => b.v - a.v).slice(0, 5),
};

let breached = [];
if (budgetPath) {
  const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
  breached = Object.entries(budget)
    .filter(([k]) => KEYS.includes(k))
    .filter(([k, limit]) => median[k] > limit)
    .map(([k, limit]) => `${k} ${median[k]} > ${limit}`);
  report.budget = { file: budgetPath, breached };
}

console.log(JSON.stringify(report, null, 2));
if (breached.length) { console.error('예산 초과: ' + breached.join(', ')); process.exit(1); }
