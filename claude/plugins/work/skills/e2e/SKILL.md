---
name: e2e
description: >
  작업 브랜치의 변경을 분석해 바뀐 유저 플로우를 Playwright E2E 테스트 코드로 생성하고, 실행해
  통과시킨 뒤 회귀 자산으로 커밋한다.
  Use after implementing a feature or flow that renders in a browser and you want durable
  regression tests — not a one-off check. The user says "E2E 테스트 만들어줘", "이 플로우 테스트 짜줘",
  "플레이라이트 테스트 작성", "회귀 테스트 추가", "이 브랜치 변경 테스트로 덮어줘", "e2e 돌려줘".
  일회성 화면 자가검수는 `browser` 스킬이다 — 이 스킬은 남는 테스트 코드를 만든다. 대상: Playwright.
---

# E2E — 회귀 테스트 생성

**`browser`와 다르다.** `browser`는 방금 만든 화면이 도는지 *한 번 보고 버리는* 자가검수다.
이 스킬은 작업 브랜치의 변경을 **재현 가능한 Playwright 테스트 코드로 박제**해서, 다음에 누가
그 플로우를 깨뜨리면 CI가 잡게 만든다. 결과물은 커밋되는 테스트 파일이다.

| | `browser` | `e2e` (이 스킬) |
|---|---|---|
| 목적 | 지금 도는지 확인 | 앞으로 안 깨지게 방어 |
| 산출물 | 텍스트 판정(휘발) | 커밋되는 테스트 코드 |
| 수명 | 일회성 | 영속(회귀 자산) |
| 실행 | 수동 드라이브 | `npx playwright test`, CI |

## 1. 브랜치 diff 분석 — 무엇을 테스트할지 도출

추측으로 테스트를 짜지 않는다. **이 브랜치가 실제로 바꾼 화면·플로우**를 찾는다.

```bash
BASE=$(git config branch.$(git branch --show-current).base 2>/dev/null || echo main)
git diff --stat origin/$BASE..HEAD                 # 무엇이 바뀌었나
git diff origin/$BASE..HEAD -- '**/*.tsx' '**/*.vue' '**/routes/**'   # 화면·라우트 변경
```

- 바뀐 라우트/페이지/컴포넌트 → 어떤 유저 플로우가 영향받나
- 새 폼·버튼·상호작용 → happy path + 핵심 실패 경로
- 플랜 파일(`.work/plans/<TICKET>.md`)의 요구사항 표가 있으면 → 그게 곧 테스트할 시나리오 목록

**테스트할 플로우를 먼저 목록으로 만들고 사용자에게 확인받는다.** 화면 전체가 아니라 이번 변경이 건드린 플로우에 집중한다.

## 2. 셀렉터 전략 — 역할 기반, 깨지지 않게

CSS 클래스·DOM 구조로 셀렉트하면 리팩터 한 번에 테스트가 다 깨진다. **사용자가 보는 것**으로 찾는다.

```ts
page.getByRole('button', { name: '주문하기' })   // 접근성 역할 — 권장
page.getByLabel('이메일')                          // 폼 필드
page.getByText('주문이 완료되었습니다')
page.getByTestId('order-total')                    // 위 셀렉터가 애매할 때만 data-testid
```

우선순위: `getByRole` > `getByLabel`/`getByText` > `getByTestId` > CSS/xpath(최후). `data-testid`가 필요하면 구현 코드에 추가하는 것도 이 작업의 일부다.

## 3. 테스트 코드 생성 — AAA + 격리

```ts
import { test, expect } from '@playwright/test';

test.describe('회원가입 플로우', () => {
  test('유효한 정보로 가입하면 대시보드로 이동한다', async ({ page }) => {
    // Arrange
    await page.goto('/signup');
    // Act
    await page.getByLabel('이메일').fill('new@example.com');
    await page.getByLabel('비밀번호').fill('Str0ng!pass');
    await page.getByRole('button', { name: '가입' }).click();
    // Assert — 눈에 보이는 결과로 단언
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('환영합니다')).toBeVisible();
  });

  test('중복 이메일이면 에러를 보여준다', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('이메일').fill('taken@example.com');
    await page.getByLabel('비밀번호').fill('Str0ng!pass');
    await page.getByRole('button', { name: '가입' }).click();
    await expect(page.getByText('이미 가입된 이메일')).toBeVisible();
  });
});
```

- **테스트 간 독립**: 각 테스트가 자기 상태를 만든다. 순서 의존 금지. 필요한 로그인은 fixture/`storageState`로
- **웹 우선 단언**: `expect(locator).toBeVisible()`는 자동 대기 — `waitForTimeout`(고정 sleep) 쓰지 않는다
- **네트워크 통제**: 외부 의존은 `page.route`로 목킹하거나, 통합 테스트면 실제 백엔드 시드 데이터 사용 — 어느 쪽인지 정한다
- happy path 하나 + 핵심 실패 경로 1~2개. 모든 조합을 e2e로 덮지 않는다(느리다) — 단위/통합에 위임

셀렉터·fixture·목킹 상세 패턴은 `references/patterns.md`.

## 4. 실행 → 통과시킨다

```bash
npx playwright test path/to/spec.ts            # 대상만
npx playwright test path/to/spec.ts --headed   # 눈으로 보며 (디버깅)
npx playwright test --ui                        # UI 모드로 스텝 추적
npx playwright show-report                      # 실패 후 트레이스·스크린샷
```

- **실패하면 테스트가 아니라 무엇이 틀렸는지 먼저 본다** — 실제 버그인가, 셀렉터가 틀렸나, 타이밍인가
- flaky(간헐 실패)면 원인을 없앤다 — 고정 sleep 제거, 웹 우선 단언으로, 상태 격리. `retries`로 덮지 않는다
- 실패 아티팩트(스크린샷·트레이스)로 원인 확인. `trace: 'on-first-retry'` 설정 권장

## 5. 회귀 자산으로 커밋

`browser`와 결정적으로 다른 지점 — **테스트를 남긴다.**

- 위치: 프로젝트의 e2e 디렉터리 (`e2e/`, `tests/e2e/`, `playwright/` — 기존 관례 따름)
- `commit` 스킬로 커밋: `test(signup): add e2e for duplicate-email and happy path`
- 플랜 파일 로그에 "이 플로우 e2e 커버" 한 줄
- CI에 e2e 잡이 없으면 → 추가를 제안한다(회귀 자산은 CI에서 돌아야 가치가 있다). `dx:gha`/파이프라인 설정 참고

## 전제

```bash
npm i -D @playwright/test && npx playwright install chromium
```

`playwright.config.ts`의 `baseURL`·`webServer`(테스트 전 앱 자동 기동)를 확인한다. 없으면 앱을 띄운 뒤 실행.

## work 사슬 연결

- `feature`/`start`로 화면을 구현한 뒤 → 이 스킬로 회귀 테스트를 남긴다.
- 지금 도는지만 빠르게 보려면 → `browser`(휘발성 자가검수). 남길 거면 → `e2e`(이 스킬).
- 생성한 테스트는 `commit`으로 커밋하고 `pr` 본문 `## 테스트`에 반영한다.

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| CSS 클래스·DOM 구조로 셀렉트 | 리팩터 한 번에 전부 깨짐 (역할/라벨로) |
| `waitForTimeout` 고정 sleep | flaky + 느림 (웹 우선 단언으로 자동 대기) |
| 테스트 간 상태 공유·순서 의존 | 하나 깨지면 연쇄, 병렬 실행 불가 |
| flaky를 `retries`로 덮기 | 진짜 버그를 숨김 |
| 모든 경우를 e2e로 | 느리고 취약 — 단위/통합에 위임, e2e는 핵심 플로우만 |
| 테스트 안 커밋 | `browser`와 같아짐 — 회귀 방어가 안 됨 |
| CI 없이 로컬만 | 다음 사람이 안 돌려서 결국 썩음 |

## 참고 파일

- `references/patterns.md` — 셀렉터 우선순위, 로그인 fixture·storageState, 네트워크 목킹, POM(Page Object), config·CI 설정
