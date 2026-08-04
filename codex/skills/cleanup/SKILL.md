---
name: cleanup
description: >
  머지된 작업을 마무리한다 — 브랜치·worktree 정리, 플랜 닫기, Jira 상태 전이, 후속 티켓 생성.
  Use after a PR is merged or a task is abandoned — "PR 머지됐어", "작업 끝났어", "정리해줘",
  "브랜치 정리", "마무리", "이 티켓 닫아줘", "다 끝났으니 치워줘" — or when `status` reports
  stale branches and plans that never got closed. Never deletes unmerged work.
---

# Cleanup

작업은 PR을 만든 순간이 아니라 **머지되고 흔적이 정리된 순간** 끝난다.
이 단계를 건너뛰면 죽은 브랜치와 `pr-open`으로 멈춘 플랜이 쌓이고, `status`의 신호가 무뎌진다.

## 1. 대상 확인

티켓 번호: 인자 → 현재 브랜치 → `.claude/plans/`에서 `status: pr-open`인 것들을 보여주고 선택.

**머지 여부를 실제로 확인한다.** 플랜의 `status`를 믿지 않는다.

```bash
BASE=$(git config branch.$(git branch --show-current).base 2>/dev/null || echo main)
git fetch origin --prune

# base에 실제로 들어갔는가
git branch --merged origin/$BASE | grep "$BRANCH"

# squash 머지는 위 명령에 안 잡힌다 — 커밋 제목으로 확인
git log origin/$BASE --oneline -30 | grep -i "PROJ-123"
```

**squash 머지를 쓰는 팀이면 `--merged`가 항상 비어 나온다.** 그것만 보고 "안 머지됨"으로 판단하지 않는다.
애매하면 PR 상태를 조회하거나 사용자에게 묻는다.

## 2. 안전 확인 — 하나라도 걸리면 멈춘다

```bash
git status --porcelain                        # 커밋 안 된 변경
git log origin/$BASE..$BRANCH --oneline       # base에 없는 커밋
git stash list | grep "$TICKET"               # 남은 stash
```

- **머지되지 않은 커밋이 있으면 브랜치를 지우지 않는다.** 보여주고 어떻게 할지 묻는다
- 커밋 안 된 변경이 있으면 그것부터 처리한다
- 작업을 포기하는 경우라도 브랜치는 **사용자가 명시적으로 승인할 때만** 지운다

**`git branch -D`(강제 삭제)를 먼저 제안하지 않는다.** `-d`로 시도해서 거부되면 그건 안 머지됐다는 신호다.

## 3. 정리

승인받고 순서대로. **한 단계가 실패해도 다음을 계속하고 결과를 누적 보고한다.**

```bash
# 로컬 브랜치
git switch "$BASE" && git pull
git branch -d "$BRANCH"          # -D 는 위 확인을 통과했을 때만

# 원격 브랜치 (호스트 설정에 따라 이미 지워졌을 수 있다)
git push origin --delete "$BRANCH"

# worktree를 썼다면
git worktree remove ../repo-PROJ-123
git worktree prune

# 브랜치 config는 브랜치와 함께 사라진다 — 별도 정리 불필요
```

원격 브랜치가 이미 없으면 오류가 나는데, 이건 실패가 아니다. 그렇게 보고한다.

## 4. 플랜 닫기

`.claude/plans/<TICKET>.md`를 갱신한다.

```yaml
status: done
updated: 2026-08-03
```

`## 로그`에 마지막 줄을 남긴다.
```
- 2026-08-03 PR #482 머지됨, 브랜치 정리 완료
```

**플랜 파일을 지우지 않는다.** 6개월 뒤 "이거 왜 이렇게 했지"의 답이 여기 있다.
저장소가 지저분해지는 게 걱정이면 `.claude/plans/done/`으로 옮기는 것까지만 제안한다.

## 5. Jira 마무리

```
getJiraIssue                  현재 상태 확인
getTransitionsForJiraIssue    가능한 전이 조회 — 이름을 추측하지 않는다
transitionJiraIssue           Done 계열로. 승인받고 실행
```

**이미 Done이면 건드리지 않는다.** 다른 사람이 이미 닫았을 수 있다.
가능한 전이에 Done 계열이 없으면(예: QA 검증이 남은 워크플로) 건너뛰고 그 사실을 알린다.

배포까지 확인해야 닫는 팀이면 여기서 멈추는 게 맞다. **팀 워크플로를 앞질러 닫지 않는다.**

## 6. 후속 작업 회수 — 이 단계의 진짜 가치

플랜의 `## 로그`에서 "발견" 항목을 모은다. `start`가 작업 중 마주쳤지만 범위 밖이라 넘긴 것들이다.

```
- 2026-08-03 발견: AdminUserController에도 같은 중복 검사 누락
- 2026-08-03 발견: UserImportJob의 예외 처리가 빈 catch
```

그리고 `## 범위 밖`에 적어둔 것들도 함께 본다.

**이걸 사용자에게 보여주고 티켓 생성을 제안한다.** 여기서 회수하지 않으면 그 발견은 영영 사라진다.
승인하면 `ticket` 스킬로 만들고, 만든 티켓 키를 플랜 로그에 기록한다.

```
- 2026-08-03 후속 티켓 생성: PROJ-141 (Admin 경로 중복 검사), PROJ-142 (ImportJob 예외 처리)
```

## 7. 보고

```
## PROJ-123 정리 완료
- 머지 확인: origin/main 에 반영됨 (squash, a1b2c3d)
- 로컬 브랜치 삭제 ✓ / 원격 브랜치 이미 삭제됨
- worktree 없음
- 플랜: status=done, .claude/plans/PROJ-123.md 유지
- Jira: In Review → Done ✓
- 후속 티켓 2건 생성: PROJ-141, PROJ-142

남은 플랜 2건 — /work:status 로 확인
```

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| 플랜 status만 보고 머지 판단 | 머지 안 된 브랜치를 지운다 |
| `git branch -D` 를 기본으로 | 되돌릴 수 없다. `-d`가 거부하는 건 이유가 있다 |
| squash 머지를 미머지로 오판 | 멀쩡히 머지된 작업을 다시 하게 된다 |
| 플랜 파일 삭제 | 결정의 근거가 사라진다 |
| 후속 발견을 그냥 버리기 | 기록되지 않은 발견은 없던 일이 된다 |
| 팀 워크플로보다 먼저 Jira 닫기 | QA·배포 단계를 건너뛴 것으로 보인다 |
| 승인 없이 원격 브랜치 삭제 | 남이 그 브랜치를 보고 있을 수 있다 |
