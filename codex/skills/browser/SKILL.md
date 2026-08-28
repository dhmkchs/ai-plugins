---
name: browser
description: >
  Playwright로 방금 구현한 화면이 실제로 동작하는지 자가검수하는 절차.
  Use right after implementing or changing anything that renders in a browser — a page,
  component, form, or API the frontend consumes — or when the user says "화면 확인해줘",
  "잘 나오는지 봐줘", "동작하나 확인", "브라우저로 띄워봐", "스크린샷 찍어줘",
  "콘솔 에러 있나", "playwright", "E2E", "렌더링 확인", "이 페이지 깨졌어".
  Captures DOM structure, console errors, and failed requests as text before resorting
  to screenshots.
---

# Browser Check

목적은 테스트 자산을 만드는 것이 아니라 **"지금 동작하나"를 30초에 확인하는 것**이다.

핵심 원칙: **스크린샷보다 텍스트를 먼저 뽑는다.**
스크린샷은 눈으로 봐야 하고 "괜찮아 보인다"로 끝난다. aria 스냅샷·콘솔 로그·실패한 요청은
텍스트라서 즉시 판정 가능하고, diff도 되고, 놓치지 않는다. 스크린샷은 레이아웃이 의심될 때만 찍는다.

## 3단계

### 1. 띄워서 텍스트로 뽑는다

`scripts/check.mjs`를 프로젝트에 복사해 실행한다. 준비된 그대로 동작한다.

```bash
node check.mjs http://localhost:3000/signup
```

한 번에 수집하는 것:
- HTTP 상태
- **aria 스냅샷** — 화면 구조를 텍스트로. 이게 가장 정보량이 크다
- 콘솔 에러 + 잡히지 않은 예외
- 실패한 요청 (4xx/5xx, 네트워크 실패)
- 스크린샷 (파일로만 저장, 필요할 때 본다)

**문제가 있으면 exit code 1**로 끝난다. 그래서 사이클 검증에 그대로 끼워 넣을 수 있다.

aria 스냅샷 출력 예 — 이것만 봐도 렌더링 여부·접근성·텍스트가 한 번에 판정된다:
```
- heading "사용자 등록" [level=1]
- text: 이메일
- textbox "이메일"
- button "가입"
- paragraph
```

### 2. 상호작용을 한 줄씩 확인한다

정적 렌더링이 확인됐으면 실제 흐름을 밟는다. 셀렉터는 **`getByRole` / `getByLabel`을 쓴다.**
CSS 클래스나 `data-testid`는 마지막 수단이다 — 클래스는 스타일 변경에 깨지고,
role 기반은 접근성까지 동시에 검증한다.

```javascript
await page.getByLabel('이메일').fill('a@b.com');
await page.getByRole('button', { name: '가입' }).click();
await expect(page.getByText('등록 완료')).toBeVisible();   // 자동 대기
```

**`waitForTimeout`을 쓰지 않는다.** Playwright는 액션·단정마다 자동으로 대기한다.
고정 대기를 넣는 순간 느려지고 동시에 flaky해진다. 기다려야 할 것이 있으면 그 조건을 명시한다.

```javascript
await page.waitForURL(/\/welcome/);
await page.waitForResponse(r => r.url().includes('/api/users') && r.ok());
await expect(page.getByRole('alert')).toBeVisible();
```

패턴별 스크립트는 `references/recipes.md` — 로그인 상태 재사용, 폼 검증, 반응형,
API 모킹, 다크모드, 느린 네트워크 재현.

### 3. 판정하고 정리한다

확인 결과를 아래 형식으로 보고한다.

```
## 브라우저 확인
- URL: http://localhost:3000/signup (200)
- 렌더링: 정상 (heading·form·button 확인)
- 상호작용: 이메일 입력 → 가입 클릭 → "등록 완료" 표시 ✓
- 콘솔 에러: 1건 — "Warning: validateDOMNesting" (기존, 이 변경과 무관)
- 실패 요청: 1건 — 404 /favicon.ico (무해)
- 스크린샷: check.png
- 판정: 통과 / 문제 있음(<무엇>)
```

**"괜찮아 보입니다"로 끝내지 않는다.** 무엇을 확인했고 무엇을 확인하지 않았는지 쓴다.
콘솔 에러가 있으면 이 변경 때문인지 기존 것인지 구분한다 — 구분하려면 변경 전 상태에서 한 번 더 돌린다.

## 언제 테스트로 승격하나

자가검수 스크립트는 원칙적으로 **버리는 것**이다. 남길 기준은 하나뿐이다.

> 이게 깨지면 사용자가 즉시 알아차리고, 지금 이 검증을 다음에도 반복할 것인가.

그렇다면 `tests/`로 옮겨 `@playwright/test`로 다시 쓴다 (`expect` 단정, `test.describe` 구조).
아니라면 지운다. **애매한 E2E 테스트를 늘리는 것이 안 만드는 것보다 나쁘다** — 느리고 flaky하고
아무도 신뢰하지 않게 되어서, 결국 CI에서 skip된다.

승격할 때는 `feature`의 테스트 전략을 따르고, 단위·통합 테스트로 커버 가능한 것은
E2E로 만들지 않는다. E2E는 가장 비싸고 가장 잘 깨지는 층이다.

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| 스크린샷만 찍고 눈으로 판정 | 콘솔 에러·실패 요청을 전부 놓친다 |
| `waitForTimeout(3000)` | 느려지고 동시에 flaky해진다 |
| CSS 클래스 셀렉터 | 스타일 변경마다 깨진다 |
| 콘솔 에러 무시 | 대개 실제 버그의 첫 신호다 |
| 자가검수 스크립트를 전부 테스트로 커밋 | 신뢰 못 하는 E2E 스위트가 쌓인다 |
| 프로덕션 URL에 대고 확인 | 실제 데이터를 변경할 수 있다 |
| `--headed`로 띄워놓고 방치 | 프로세스가 남아 포트를 점유한다 |

**프로덕션에 쓰기 동작(가입, 삭제, 결제)을 실행하지 않는다.** 확인은 로컬이나 스테이징에서 한다.

## 환경 확인

브라우저 바이너리와 패키지 버전이 어긋나면 실행 자체가 안 된다. 먼저 확인한다.

```bash
npx playwright --version          # 설치된 버전을 여기서 확인한다
npx playwright install chromium   # 브라우저 없으면
```

**이 문서에 Playwright API 목록을 적어두지 않는다.** 적는 순간 썩고, 썩었는지 아무도 모른다.
API 가용성은 아래에서 확인한다 — **문서가 이 문서보다 항상 맞다.**

| 확인할 것 | 어디서 |
|---|---|
| 최신 API·시그니처 | `https://playwright.dev/docs/api/class-page` |
| 어느 버전에 추가됐나 | `https://github.com/microsoft/playwright/releases` |
| 지금 설치된 버전에 있나 | `node -e "const {chromium}=require('playwright'); console.log(typeof (await chromium.launch()).newContext)"` 식으로 직접 확인 |

**설치된 버전보다 새 API를 쓰면 조용히 `undefined`가 된다** — 예외가 아니라 무반응이라 더 나쁘다.
새로 알게 된 API를 쓰기 전에 **그 객체에 실제로 있는지 한 번 찍어본다.**

실행 실패·한글 깨짐·타임아웃은 `references/troubleshooting.md`.

## 참고 파일

- `scripts/check.mjs` — 복사해서 바로 쓰는 자가검수 스크립트 (검증됨)
- `references/recipes.md` — 상황별 스크립트 조각
- `references/troubleshooting.md` — 실행 실패와 오진단 원인
