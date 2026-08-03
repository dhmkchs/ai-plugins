# 자가검수 스크립트 조각

전부 `playwright` 패키지만으로 동작한다 (`@playwright/test` 러너 불필요).
`scripts/check.mjs`의 골격에 필요한 조각을 끼워 넣어 쓴다.

```javascript
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
// ... 여기에 조각 ...
await browser.close();
```

## 셀렉터 — 우선순위

```javascript
page.getByRole('button', { name: '가입' })      // 1순위. 접근성까지 동시 검증
page.getByLabel('이메일')                        // 폼 입력
page.getByPlaceholder('you@example.com')
page.getByText('등록 완료')                       // 표시 확인
page.getByTestId('user-row')                     // 위 방법이 불가능할 때만
page.locator('.btn-primary')                     // 최후 수단. 스타일 변경에 깨진다
```

`getByRole`이 안 잡히면 **먼저 aria 스냅샷을 찍어 실제 role과 이름을 확인**한다. 추측하지 않는다.
```javascript
console.log(await page.locator('body').ariaSnapshot());
```

여러 개가 잡히면 좁힌다.
```javascript
page.getByRole('row', { name: '희식' }).getByRole('button', { name: '삭제' })
page.getByRole('button', { name: '저장' }).first()   // 순서 의존. 가능하면 피한다
```

## 대기 — `waitForTimeout` 대신

액션과 단정은 자동 대기한다. 명시적 대기가 필요한 경우만:

```javascript
await page.waitForURL(/\/welcome/);                              // 이동 완료
await page.waitForResponse(r => r.url().includes('/api/users') && r.ok());
await page.waitForLoadState('networkidle');                      // 요청이 잦아들 때까지
await page.getByRole('progressbar').waitFor({ state: 'hidden' }); // 로딩 사라짐
await page.getByText('저장됨').waitFor({ timeout: 5000 });

// 요청을 먼저 걸어두고 액션 — 경쟁 조건 회피 (순서가 중요하다)
const wait = page.waitForResponse(r => r.url().includes('/api/save'));
await page.getByRole('button', { name: '저장' }).click();
const res = await wait;
console.log('저장 응답:', res.status(), await res.json().catch(() => null));
```

## 폼 흐름 확인

```javascript
await page.getByLabel('이메일').fill('a@b.com');
await page.getByLabel('비밀번호').fill('secret1234');
await page.getByRole('checkbox', { name: '약관 동의' }).check();
await page.getByRole('combobox', { name: '국가' }).selectOption('KR');
await page.getByRole('button', { name: '가입' }).click();

// 검증 에러도 확인한다 — 정상 경로만 보면 절반만 본 것이다
await page.getByLabel('이메일').fill('not-an-email');
await page.getByRole('button', { name: '가입' }).click();
console.log('에러 메시지:', await page.getByRole('alert').allTextContents());
```

## 로그인 상태 재사용 (매번 로그인하지 않기)

```javascript
// 1회만: 로그인 후 상태 저장
await page.goto('http://localhost:3000/login');
await page.getByLabel('이메일').fill('dev@example.com');
await page.getByLabel('비밀번호').fill('devpass');
await page.getByRole('button', { name: '로그인' }).click();
await page.waitForURL(/\/dashboard/);
await context.storageState({ path: 'auth.json' });

// 이후: 저장된 상태로 시작
const context = await browser.newContext({ storageState: 'auth.json' });
```

`auth.json`은 **반드시 `.gitignore`에 넣는다.** 세션 토큰이 들어 있다.

## API 응답 가로채기 (백엔드 없이 화면만 확인)

```javascript
await page.route('**/api/users', route =>
  route.fulfill({ status: 200, contentType: 'application/json',
                  body: JSON.stringify([{ id: 1, name: '희식' }]) }));

// 에러·빈 상태 화면 확인 — 실제로 재현하기 어려운 경로다
await page.route('**/api/users', r => r.fulfill({ status: 500, body: '{}' }));
await page.route('**/api/users', r => r.fulfill({ status: 200, body: '[]' }));

// 느린 응답 → 로딩 UI 확인
await page.route('**/api/**', async route => {
  await new Promise(r => setTimeout(r, 3000));
  await route.continue();
});
```

**에러·빈 상태·로딩 화면은 이 방법 없이는 확인하기 어렵다.** 대부분의 UI 버그가 여기에 있다.

## 반응형 확인

```javascript
for (const [label, viewport] of [
  ['mobile',  { width: 390,  height: 844 }],
  ['tablet',  { width: 820,  height: 1180 }],
  ['desktop', { width: 1440, height: 900 }],
]) {
  await page.setViewportSize(viewport);
  await page.screenshot({ path: `check-${label}.png`, fullPage: true });
  // 가로 스크롤 발생 여부 — 모바일 레이아웃 깨짐의 가장 흔한 신호
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(label, overflow ? '⚠️ 가로 스크롤 발생' : 'ok');
}
```

## 다크모드 / 언어 / 타임존

```javascript
const context = await browser.newContext({
  colorScheme: 'dark',
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  reducedMotion: 'reduce',   // 애니메이션 제거 — 스크린샷 안정화
});
```

타임존을 고정하지 않으면 날짜 표시 확인이 실행 환경에 따라 달라진다.

## 접근성 빠른 점검

```javascript
// 이미지 alt 누락
console.log(await page.locator('img:not([alt])').count(), '개 이미지에 alt 없음');

// 라벨 없는 입력
console.log(await page.locator('input:not([aria-label]):not([id])').count(), '개 입력에 라벨 없음');

// 키보드로 도달 가능한지
await page.keyboard.press('Tab');
console.log('첫 포커스:', await page.evaluate(() =>
  document.activeElement?.outerHTML?.slice(0, 80)));
```

## 실패 시 증거 남기기

```javascript
// 실행 전체를 trace로 기록 → 실패했을 때만 열어본다
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
try {
  // ... 확인 작업 ...
} finally {
  await context.tracing.stop({ path: 'trace.zip' });
}
```
```bash
npx playwright show-trace trace.zip     # 타임라인·DOM·네트워크를 그대로 재생
```

원인이 안 보이는 실패에는 trace가 가장 빠르다. 스크린샷 여러 장보다 정보량이 많다.

## 여러 페이지 한 번에

```javascript
const urls = ['/', '/signup', '/login', '/dashboard'];
const results = [];
for (const path of urls) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const res = await page.goto('http://localhost:3000' + path).catch(e => ({ status: () => e.message }));
  results.push({ path, status: res?.status?.(), errors: errors.length });
  page.removeAllListeners('pageerror');
}
console.table(results);
```

변경 범위가 넓을 때 회귀를 빠르게 훑는 용도. `console.table`로 한눈에 본다.
