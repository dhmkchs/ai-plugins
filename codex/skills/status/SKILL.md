---
name: status
description: >
  진행 중인 작업 플랜들의 상태를 모아 보여주고, Jira·git 실제 상태와 어긋난 곳을 찾아낸다.
  Use when the user asks what's in flight — "지금 뭐 하고 있었지", "작업 현황", "진행 상황",
  "어디까지 했지", "남은 거 뭐야", "status", "내 작업 목록" — or when resuming after a break
  and needing to pick up context. Reads `.claude/plans/*.md`, cross-checks against git branches
  and Jira, and reports drift.
---

# Status

플랜 파일은 사람이 손으로 갱신하는 순간 현실과 어긋난다.
이 스킬의 진짜 가치는 목록을 예쁘게 보여주는 게 아니라 **어긋난 곳을 찾아내는 것**이다.

## 1. 수집

```bash
ls .claude/plans/*.md 2>/dev/null || echo "플랜 없음"
git branch --format='%(refname:short)' | grep -E '[A-Z]+-[0-9]+' || true
git status --porcelain
git log --oneline -1
```

각 플랜의 front-matter(`ticket`, `status`, `branch`, `pr`, `updated`)와 슬라이스 체크박스를 읽는다.
현재 브랜치에서 티켓 키를 추출해 **지금 작업 중인 것을 맨 위에** 놓는다.

플랜이 하나도 없으면 그렇게 말하고 `/work:plan <TICKET>`을 안내한다. 억지로 만들지 않는다.

## 2. 드리프트 검사 — 이 스킬의 핵심

플랜이 말하는 것과 실제가 다른 지점을 찾는다. 각 항목을 실제로 확인한다.

| 검사 | 방법 | 어긋났을 때의 의미 |
|---|---|---|
| 슬라이스 체크 vs 커밋 | `git log --oneline <base>..<branch>` 개수와 `[x]` 개수 비교 | 갱신을 빠뜨렸거나, 커밋 없이 체크했다 |
| 커밋 해시 유효성 | `git cat-file -e <해시>` | 리베이스로 해시가 바뀌었다 |
| `branch` 존재 | `git rev-parse --verify <branch>` | 브랜치가 삭제됐다 (머지됐을 수 있음) |
| `status: in-progress` + 커밋 0개 | git log | 시작만 하고 방치됐다 |
| `status: review` + 미완료 슬라이스 | 체크박스 | 상태를 성급히 올렸다 |
| `pr` URL 있는데 `status != pr-open` | front-matter | 갱신 누락 |
| Jira 상태 vs 플랜 상태 | `getJiraIssue` | 팀에 보이는 상태가 실제와 다르다 |
| `updated`가 7일 이상 전 | 날짜 비교 | 방치된 작업 |
| 머지된 브랜치인데 `status != done` | `git branch --merged <base>` | 끝났는데 안 닫혔다 |

**Jira 조회는 티켓이 5개를 넘으면 한 번에 한다.**
`searchJiraIssuesUsingJql: key IN (PROJ-123, PROJ-124, ...)` — 개별 호출을 반복하지 않는다.
Atlassian MCP가 없으면 Jira 대조는 건너뛰고 그렇게 표시한다. 나머지 검사는 그대로 한다.

## 3. 보고

현재 작업을 먼저, 그다음 나머지를 최근 갱신순으로.

```
## 지금 작업 중
PROJ-123 중복 이메일로 계정이 두 개 생성됨
  브랜치 feature/PROJ-123-duplicate-email (커밋 3개, 작업트리 깨끗)
  슬라이스 3/4 — 다음: S4 DB 유니크 제약 + 동시성 테스트  ⚠️ 되돌리기 주의
  Jira: In Progress ✓ 일치
  다음: /work:start PROJ-123

## 다른 진행 중
PROJ-118 결제 타임아웃 조정      review    슬라이스 2/2   3일 전
PROJ-140 중복 데이터 정리        blocked   슬라이스 0/3   5일 전
  └ 사유: PROJ-123의 유니크 제약 결정 대기

## ⚠️ 어긋난 것
PROJ-118  슬라이스는 2/2 완료인데 status가 review — 셀프 리뷰 미실행
          → /work:review
PROJ-131  Jira는 Done인데 플랜은 in-progress, 브랜치도 없음
          → 다른 데서 처리된 듯. 플랜을 done으로 닫을까요?
PROJ-140  updated가 5일 전. blocked 사유가 아직 유효한지 확인 필요

## 요약
플랜 4건 — 진행 1 / 리뷰대기 1 / 차단 1 / 완료 1
어긋남 3건
```

**어긋남이 없으면 "없음"이라고 명확히 쓴다.** 억지로 지적을 만들지 않는다.

## 4. 다음 행동 제안

보고로 끝내지 않는다. 가장 값이 큰 다음 한 가지를 제시한다. 우선순위:

1. **차단 해소** — 남을 막고 있는 것이 먼저다
2. **리뷰 대기** — 끝난 일을 닫는 게 새 일을 시작하는 것보다 값이 크다
3. **진행 중 재개**
4. **머지된 것 정리** — `pr-open`인데 브랜치가 머지됐으면 `/work:cleanup`
5. **방치 정리** — 7일 이상 멈춘 것은 닫을지 이어갈지 결정한다

플랜 수정(상태 닫기, blocked 해제)은 **반드시 승인받고** 한다. 조용히 고치지 않는다.

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| 플랜 파일만 읽고 보고 | 플랜이 거짓말일 때 그대로 옮긴다 |
| Jira를 티켓마다 개별 조회 | 느리고 레이트 리밋에 걸린다 |
| 어긋남을 조용히 수정 | 사용자가 모르는 사이 이력이 바뀐다 |
| 목록만 나열하고 끝 | 뭘 해야 할지 알려주지 않으면 값이 없다 |
| 없는 플랜을 지어내기 | — |
