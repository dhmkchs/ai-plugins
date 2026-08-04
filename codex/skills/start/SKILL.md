---
name: start
description: >
  작업 플랜 파일을 읽어 슬라이스 단위로 구현을 진행하고, 진행 상태를 플랜에 계속 기록한다.
  Use when starting or resuming implementation from a plan — "작업 시작", "PROJ-123 작업해줘",
  "이어서 진행", "플랜대로 진행해줘", "다음 슬라이스", "작업 재개" — or after
  `plan` produced `.claude/plans/<TICKET>.md`. Resumable: picks up at the first
  unfinished slice. Creates the branch and moves the Jira ticket to In Progress.
---

# Task Start

플랜을 실행한다. 핵심 성질은 **재개 가능성**이다.
세션이 끊기든 하루가 지나든, 플랜 파일만 보고 정확히 이어받을 수 있어야 한다.
그래서 **슬라이스를 끝낼 때마다 즉시 플랜을 갱신한다.** 이 규칙 하나가 이 스킬의 전부다.

## 1. 플랜 로드

티켓 번호: 인자 → 현재 브랜치명에서 추출 → `.claude/plans/` 목록을 보여주고 선택 → 묻는다.

`.claude/plans/<TICKET>.md`가 없으면 여기서 멈춘다.
`/work:plan <TICKET>`을 먼저 돌리라고 안내한다. **플랜 없이 진행하지 않는다.**

front-matter의 `status`로 분기한다.

| status | 동작 |
|---|---|
| `planned` | 브랜치 생성부터 시작 |
| `in-progress` | 첫 미완료 슬라이스부터 재개 |
| `review` | 슬라이스 완료됨 → `review`로 넘기라고 안내 |
| `pr-open` | 이미 PR 있음 → PR 링크 보여주고 추가 작업인지 확인 |
| `blocked` | `## 로그`의 사유를 보여주고, 해소됐는지 확인 후 진행 |

## 2. 착수 준비 (첫 실행일 때만)

**작업 트리가 깨끗한지 먼저 확인한다.** 커밋 안 된 변경이 있으면 멈추고 사용자에게 처리를 묻는다.

```bash
git status --porcelain          # 비어 있어야 한다
git fetch origin
git switch -c feature/PROJ-123-duplicate-email origin/main

# base를 git config에 기록한다 — 나중에 diff 범위를 정확히 잡기 위해
git config branch.feature/PROJ-123-duplicate-email.base main
```

브랜치명은 `<branchPrefix><TICKET>-<제목-슬러그>`. config의 `branchPrefix`·`base`를 따른다 (프로젝트 `.work/config.json` > 글로벌 `~/.work/config.json`).
브랜치가 이미 있으면 새로 만들지 말고 체크아웃한다.

**base 기록을 빠뜨리지 않는다.** `develop`에서 딴 브랜치를 나중에 `main` 기준으로 diff하면
남의 커밋이 전부 내 변경으로 잡히고, PR 본문과 리뷰 범위가 통째로 오염된다.
`review`와 `pr`은 이 값을 읽는다.

```bash
BASE=$(git config branch.$(git branch --show-current).base 2>/dev/null || echo main)
```

### 다른 티켓을 동시에 진행해야 하면

브랜치를 갈아타면 진행 중이던 작업을 커밋하거나 stash해야 하고, 그 과정에서 플랜과 실제가 어긋난다.
**worktree로 디렉터리를 분리한다.**

```bash
git worktree add ../repo-PROJ-124 -b feature/PROJ-124-x origin/main
git config -f ../repo-PROJ-124/.git/config branch.feature/PROJ-124-x.base main
```

각 worktree는 독립된 작업 트리라 빌드·테스트가 서로를 방해하지 않는다.
플랜 파일은 `.claude/plans/`에 티켓별로 있으므로 그대로 쓰면 된다.
끝나면 `git worktree remove ../repo-PROJ-124`.

플랜의 `branch`·`status`를 갱신하고, **Jira 상태 전이를 승인받는다.**

```
getTransitionsForJiraIssue    지금 가능한 전이를 먼저 조회 — 상태 이름을 추측하지 않는다
transitionJiraIssue           승인 후 실행
```

전이 이름이 팀마다 다르므로(`In Progress` / `진행 중` / `개발중`) 반드시 조회 결과에서 고른다.
가능한 전이가 없거나 애매하면 **건너뛰고 사용자에게 알린다.** Jira 상태 때문에 코드 작업을 막지 않는다.

## 3. 슬라이스 루프

첫 미완료 슬라이스부터. **한 번에 하나만.**

각 슬라이스에서:

1. **선언** — 지금 무슨 슬라이스를 하는지, 대상 파일과 완료 조건을 한 줄로 말한다
2. **구현** — `pair`의 사이클을 그대로 돈다 (RESTATE → PLAN → PROMPT → VERIFY)
   - 코드베이스 관례는 플랜의 정찰 노트에 있다. 다시 탐색하지 않는다
3. **검증** — 슬라이스의 완료 조건 명령을 **실제로 실행한다.** 통과를 눈으로 확인한다
   - 화면이 바뀌면 `browser`
   - 테스트 전체를 돌려 기준선과 비교한다 (새로 깨진 게 없어야 한다)
4. **커밋** — 슬라이스 하나 = 커밋 하나
   ```bash
   git add -A && git commit -m "feat(PROJ-123): 이메일 정규화 및 중복 검사 추가"
   ```
   커밋 메시지에 티켓 키를 넣는다. Bitbucket은 이걸로 Jira와 자동 연결된다
5. **플랜 갱신** — 체크박스 `[x]`, 커밋 해시 기록, 요구사항 표 상태, `## 로그` 한 줄. **즉시**
6. **보고 후 다음** — 무엇이 끝났고 다음이 뭔지 한 줄

### 슬라이스가 실패하면

- **다음 슬라이스로 넘어가지 않는다.** 실패를 쌓으면 원인을 가릴 수 없다
- 원인 불명이면 `debug` 절차로 전환한다
- 10분 이상 진전이 없으면 접근을 바꾼다 (`pair`의 10분 룰)
- 플랜 자체가 틀렸으면 **플랜을 고친다.** 슬라이스를 나누거나 순서를 바꾸고 `## 로그`에 이유를 남긴다
- 진행 불가면 `status: blocked` + 사유를 로그에 남기고 멈춘다

### 되돌리기 어려운 슬라이스

마이그레이션·데이터 삭제·외부 시스템 쓰기는 실행 전에 **반드시 승인받는다.**
플랜에 `⚠️ 되돌리기 주의`가 붙어 있으면 그냥 지나치지 않는다.

## 4. 범위를 지킨다

작업 중에 눈에 띈 다른 문제는 **고치지 않는다.** 플랜의 `## 로그`에 적어두고 넘어간다.

```
- 2026-08-03 발견: AdminUserController에도 같은 중복 검사 누락. 이 티켓 범위 밖 → 후속 티켓 필요
```

곁가지 수정이 섞이면 diff가 리뷰 불가가 되고, 되돌릴 때 무엇을 되돌릴지 가릴 수 없다.
정말 지금 고쳐야 하면 사용자에게 묻고, 승인되면 **플랜에 슬라이스로 추가**한 뒤 진행한다.

## 5. 완료

모든 슬라이스가 `[x]`가 되면:

- 요구사항 표가 전부 ☑인지 확인한다. 아니면 슬라이스가 빠진 것이다
- 전체 테스트를 한 번 더 돌려 기준선과 비교한다
- `status: review`로 갱신
- 다음 단계를 안내한다

```
PROJ-123 슬라이스 4/4 완료 — 커밋 4개
요구사항 6/6 충족, 테스트 148 passed / 0 failed (기준선 142 → 신규 6건)
다음: /work:review
```

**여기서 PR을 만들지 않는다.** 셀프 리뷰를 거치는 게 이 체인의 요점이다.

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| 플랜 갱신을 마지막에 몰아서 | 중단되면 진행 상황이 사라진다 |
| 여러 슬라이스 동시 진행 | 실패 시 원인 귀속 불가 |
| 완료 조건 명령을 안 돌리고 체크 | 동작하지 않는 걸 완료로 기록 |
| 곁가지 수정 섞기 | diff가 리뷰 불가, 롤백 단위 소실 |
| 계획과 달라졌는데 플랜 방치 | 플랜이 거짓말이 되고 PR 설명도 틀어진다 |
| Jira 전이 이름 추측 | 전이 실패, 또는 엉뚱한 상태로 이동 |
| 승인 없이 마이그레이션 실행 | 되돌릴 수 없다 |

## 참고 파일

- `references/execution-rules.md` — 브랜치·커밋 규칙, 중단·재개, 슬라이스 실패 대응
