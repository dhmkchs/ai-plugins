# Playwright E2E 패턴

## 셀렉터 우선순위 (위에서부터 시도)

```ts
page.getByRole('button', { name: '저장' })     // 1. 접근성 역할 — 사용자가 인지하는 방식
page.getByLabel('이메일')                        // 2. 폼 필드 (label 연결)
page.getByPlaceholder('검색어 입력')
page.getByText('주문 완료')                      // 3. 보이는 텍스트
page.getByTestId('cart-total')                  // 4. data-testid (위가 애매할 때)
page.locator('.btn-primary')                    // 5. CSS — 최후, 취약
```

역할 기반이 접근성도 강제한다(라벨 없는 버튼은 `getByRole`로 못 잡힘 → 접근성 버그 발견).

## 로그인 fixture — 매 테스트 로그인 반복 제거

`storageState`로 인증 상태를 한 번 저장해 재사용:

```ts
// global-setup.ts
import { chromium } from '@playwright/test';
export default async function () {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('/login');
  await page.getByLabel('이메일').fill(process.env.E2E_USER!);
  await page.getByLabel('비밀번호').fill(process.env.E2E_PASS!);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
  await browser.close();
}
```

```ts
// playwright.config.ts
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:3000', storageState: 'e2e/.auth/user.json',
         trace: 'on-first-retry' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true },
});
```

`e2e/.auth/`는 `.gitignore`에 넣는다(자격증명 파생물).

## 네트워크 목킹 — 외부 의존 통제

```ts
await page.route('**/api/payment', route =>
  route.fulfill({ status: 200, json: { status: 'paid' } }));
```

- 순수 프론트 e2e: 백엔드를 목킹해 결정적으로
- 풀스택 통합 e2e: 실제 백엔드 + 시드 데이터. 테스트 전 DB 시드, 후 정리. 어느 쪽인지 명시적으로 택한다

## 실패 경로 단언

```ts
await expect(page.getByRole('alert')).toHaveText(/이미 가입된 이메일/);
await expect(page.getByRole('button', { name: '가입' })).toBeDisabled();
```

## Page Object Model — 플로우가 커지면

셀렉터·액션을 페이지 클래스로 모아 중복 제거:

```ts
class SignupPage {
  constructor(private page: Page) {}
  goto() { return this.page.goto('/signup'); }
  async submit(email: string, pw: string) {
    await this.page.getByLabel('이메일').fill(email);
    await this.page.getByLabel('비밀번호').fill(pw);
    await this.page.getByRole('button', { name: '가입' }).click();
  }
}
```

작은 플로우엔 과설계. 같은 화면을 여러 테스트가 쓸 때 도입한다.

## CI (GitHub Actions)

```yaml
- run: npx playwright install --with-deps chromium
- run: npx playwright test
- uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with: { name: playwright-report, path: playwright-report/ }
```

`trace: 'on-first-retry'` + 리포트 업로드 → CI 실패를 로컬에서 재생(`npx playwright show-trace`).

## flaky 잡기 (retries로 덮지 말 것)

| 증상 | 원인 | 해결 |
|---|---|---|
| 가끔 요소 못 찾음 | 고정 sleep, 렌더 전 단언 | 웹 우선 단언(`toBeVisible`)이 자동 대기 |
| 순서 따라 실패 | 테스트 간 상태 공유 | 각 테스트가 자기 데이터 생성, storageState 격리 |
| 애니메이션 중 클릭 | 전환 타이밍 | Playwright가 actionability 대기 — 수동 sleep 금지 |
| 네트워크 지연 | 실제 외부 호출 | `page.route`로 목킹 or `waitForResponse` |
