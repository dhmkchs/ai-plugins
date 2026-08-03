# work

개발 작업을 **티켓부터 PR까지** 끌고 가는 스킬 세트.
대상 스택: **JavaScript / TypeScript**, **Java (Spring)**. Jira · Bitbucket · Forgejo 연동.

## 메인 사슬

```
/work:ticket   대화 → Jira 티켓                 (중복 확인 · 필수 필드 조회)
     ↓
/work:plan     티켓 → .work/plans/PROJ-123.md   (정찰 결과를 플랜에 임베드)
     ↓
/work:start    플랜 → 슬라이스 실행              (커밋마다 플랜 갱신 · 재개 가능)
     ↓
/work:review   변경 → 셀프 리뷰 게이트            (기계 검사 → 적대적 diff)
     ↓
/work:pr       플랜 + 커밋 → PR 본문 · 생성 · Jira 연결
     ↓
/work:cleanup  머지 후 → 브랜치 정리 · 플랜 닫기 · 후속 티켓 회수
```

각 단계는 앞 단계의 산출물을 읽는다. **플랜 파일이 사슬 전체의 backbone이다** —
`start`가 진행 상태를 여기 기록하고, `pr`이 이걸로 PR 본문을 만든다.
그래서 PR 설명을 새로 창작하지 않고, 가정·리스크·범위 밖이 누락되지 않는다.

`/work:status`로 언제든 현재 위치를 확인한다.

## 전체 명령

| 명령 | 하는 일 |
|---|---|
| `/work:ticket` | Jira 티켓 생성. 중복 확인 → 4요소(문제·영향·완료조건·범위밖) → 필드 조회 → 승인 후 생성 |
| `/work:plan` | 티켓 읽기 → 코드베이스 정찰 → 요구사항 표 → 수직 슬라이스 → 플랜 파일 |
| `/work:start` | 첫 미완료 슬라이스부터 실행. 브랜치 생성, Jira 전이, 슬라이스마다 커밋+플랜 갱신 |
| `/work:review` | 디버그 잔여물·자격증명·비활성 테스트 검사 → 적대적 diff 리뷰 → 설명 가능성 게이트 |
| `/work:pr` | 호스트 감지 → 플랜에서 본문 생성 → PR 생성 → Jira 코멘트·상태 전이 |
| `/work:cleanup` | 머지 확인 → 브랜치·worktree 정리 → 플랜 닫기 → Jira Done → 후속 티켓 생성 |
| `/work:status` | 플랜 현황 + **드리프트 검사** (플랜 vs git vs Jira 불일치) |
| `/work:explore` | 낯선 코드베이스 정찰 → 수정 지점 국소화 → 정찰 노트 |
| `/work:debug` | 재현 → 국소화 → 가설 → 최소수정 → 회귀방지 |
| `/work:browser` | Playwright로 aria 스냅샷·콘솔 에러·실패 요청을 텍스트로 뽑아 판정 |
| `/work:feature` | Jira 없이 요구사항을 구현·테스트·PR까지 |
| `/work:pair` | AI에게 코드를 맡길 때의 요청·검증 사이클 |
| `/work:lang` | TS·Java 관용구와 함정 |

슬래시로 부르지 않아도 된다. 스킬은 표현을 감지해 자동으로 켜진다 —
"PR 올리기 전에 봐줘" → `review`, "이 페이지 콘솔 에러 있나" → `browser`.

## 플랜 파일

`.work/plans/<TICKET>.md` 하나에 요구사항 표, 정찰 노트, 슬라이스, 설계 판단, 가정, 리스크, 로그가 들어간다.
front-matter의 `status`로 상태를 관리한다.

```
planned → in-progress → review → pr-open → done
                ↕
             blocked
```

`start`가 브랜치를 만들 때 `git config branch.<브랜치>.base`에 base를 기록한다.
`review`·`pr`·`cleanup`이 이 값으로 diff 범위를 잡는다 — `develop`에서 딴 브랜치를
`main` 기준으로 비교하면 남의 커밋이 전부 내 변경으로 잡히기 때문이다.

티켓을 동시에 여러 개 진행해야 하면 `start`가 worktree 분리를 안내한다.

**슬라이스를 끝낼 때마다 즉시 갱신한다.** 이 규칙이 재개 가능성을 만든다 —
세션이 끊겨도, 하루가 지나도, 다른 사람이 이어받아도 플랜 파일만 보면 된다.

정본 스키마는 `skills/plan/references/plan-format.md`.

## 전제 조건

| 기능 | 필요한 것 |
|---|---|
| `ticket` · `plan` · Jira 전이 | **Atlassian MCP 서버** (Rovo). 없으면 해당 단계에서 멈추고 알린다 |
| `pr` (Bitbucket) | Atlassian MCP + `write_bitbucket` 권한 |
| `pr` (Forgejo) | `FORGEJO_TOKEN`, `FORGEJO_URL` 환경변수 |
| `browser` | `npm i -D playwright` + `npx playwright install chromium` |

**토큰을 `.work/config.json`에 쓰지 않는다.** 그 파일은 커밋된다. 환경변수로 둔다.

저장소별 기본값은 `.work/config.json`에 둘 수 있다 (프로젝트 키, 브랜치 prefix, base, 리뷰어).
형식은 `skills/plan/references/plan-format.md` 마지막 절 참고.

## 설치

### Claude Code

```bash
claude plugin marketplace add ~/Documents/work-kit/work-marketplace
claude plugin install work@my-plugins
```

이미 설치돼 있으면 버전 갱신에는 재설치가 필요하다. `marketplace update`만으로는 올라가지 않는다.

```bash
claude plugin marketplace update my-plugins
claude plugin uninstall work@my-plugins
claude plugin install work@my-plugins
```

### Cowork

`work.plugin`을 대화창에 올려 설치 버튼을 누른다.

> 두 곳은 플러그인 저장소를 공유하지 않는다. 각각 설치한다.
> 그리고 **같은 스킬을 `~/.claude/skills/`에 복사하지 않는다** — 개인 스킬은 네임스페이스가 안 붙어서
> `/work:` 자동완성에서 사라진다.

## 설계 원칙

이 세트가 일관되게 지키는 것들이다.

- **승인 게이트** — Jira 생성·상태 전이, 마이그레이션, push, PR 생성 전에 멈추고 보여준다
- **추측 금지** — 프로젝트 키·이슈 타입·전이 이름·MCP 도구 인자를 조회해서 쓴다
- **한 번에 하나** — 슬라이스 하나 = 커밋 하나. 실패 시 원인을 귀속할 수 있게
- **즉시 기록** — 진행 상태를 몰아서 쓰지 않는다
- **범위 사수** — 작업 중 발견한 것은 고치지 않고 로그에 남겨 후속 티켓으로
- **설명 가능성** — 설명할 수 없는 코드는 머지하지 않는다
- **자동 수정은 되돌릴 수 있을 때만** — `review`의 자동 수정은 한 건씩 고치고 즉시 검증하며,
  실패하면 **사본에서 복원**한다. `git checkout --`은 쓰지 않는다 (커밋 안 된 사용자 작업을 날린다)
- **판단이 필요한 건 사람에게** — 지적을 AUTO-FIX / HUMAN-REQUIRED로 나누고,
  확신이 없거나 동작이 바뀌면 자동으로 고치지 않는다

## 커스터마이즈

`SKILL.md`는 평범한 마크다운이다. 고쳐 쓰는 걸 전제로 만들었다.

- **팀 컨벤션** — `skills/review/references/checklist.md`에 팀 규칙 추가
- **PR 형식** — `skills/feature/references/pr-description.md`를 팀 템플릿으로 교체
- **반복하는 실수** — `skills/debug/references/failure-catalog.md`에 계속 append.
  이 파일이 시간이 지나면 가장 값어치가 커진다
- **브라우저 노이즈** — `skills/browser/scripts/check.mjs`의 `IGNORE` 배열
- **Jira 필드** — 팀 커스텀 필드가 있으면 `skills/ticket/references/ticket-patterns.md`에 기록

`commands/*.md`는 자동완성에 `/work:` prefix로 뜨게 하는 얇은 래퍼다.
스킬을 추가하면 여기도 하나 만든다.
