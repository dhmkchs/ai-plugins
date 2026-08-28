---
name: pr
description: >
  플랜 파일과 커밋 이력으로 PR 본문을 만들어 Bitbucket 또는 Forgejo에 PR을 생성한다.
  Use when opening a pull request — "PR 만들어줘", "PR 올려줘", "풀리퀘 생성",
  "머지 요청 만들어", "PR 올리자", "pull request" — typically right after `review`
  passes. Detects the host from the git remote, builds the description from
  `.agents/plans/<TICKET>.md`, and links the PR back to Jira.
---

# PR Create

PR 설명을 처음부터 쓰지 않는다. **플랜 파일에 이미 다 있다** — 요구사항 표, 설계 판단, 가정, 리스크.
이 스킬은 그걸 PR 형식으로 옮기고 호스트에 올린다.

## 1. 사전 조건 — 하나라도 실패하면 멈춘다

```bash
# base는 브랜치를 만들 때 기록해둔 값을 쓴다 — main으로 넘겨짚지 않는다
BASE=$(git config branch.$(git branch --show-current).base 2>/dev/null || echo main)

git status --porcelain                    # 비어 있어야 함
git log --oneline origin/$BASE..HEAD      # 커밋이 1개 이상
git fetch origin && git rebase origin/$BASE
./gradlew clean build    # 또는 npm ci && npm test && npm run build
```

`develop`에서 딴 브랜치를 `main` 기준으로 diff하면 남의 커밋이 전부 내 변경으로 잡힌다.
PR 본문·커밋 목록·변경 규모가 통째로 틀어지므로 `BASE`를 반드시 확인한다.

리베이스 후 테스트가 깨지면 **PR을 만들지 않는다.** 남의 변경과 충돌한 것이고, 지금 고치는 게 싸다.

플랜의 `status`를 확인한다.
- `review`가 아니면 → 슬라이스가 남았거나 셀프 리뷰 전이다. 확인 후 진행
- `pr-open`이면 → 이미 PR이 있다. URL을 보여주고 갱신할지 묻는다

**셀프 리뷰를 안 거쳤으면 먼저 하라고 권한다.** `review`가 잡는 것들(디버그 잔여물, 비활성 테스트,
자격증명)은 리뷰어가 볼 필요 없는 것들이고, PR에 섞이면 리뷰가 거기서 멈춘다.

## 2. 호스트 감지

```bash
git remote get-url origin
```

| 패턴 | 호스트 | 수단 |
|---|---|---|
| `bitbucket.org` | Bitbucket Cloud | Atlassian MCP `bitbucketPullRequest` |
| 그 외 자체 호스팅 | Forgejo (또는 Gitea) | REST API + 토큰 |

config의 `git.host`가 있으면 그것을 우선한다 (프로젝트 `.work/config.json` > 글로벌 `~/.work/config.json`). 애매하면 **묻는다. 추측해서 올리지 않는다.**

remote URL에서 `owner`/`repo`를 파싱한다. SSH(`git@host:owner/repo.git`)와 HTTPS 둘 다 처리한다.

## 3. PR 본문 생성

플랜 파일에서 그대로 옮긴다. 없는 내용을 지어내지 않는다.

```markdown
## 무엇을 / 왜
<플랜의 title + 티켓 문제 요약 2~3문장>

관련: PROJ-123

## 요구사항 충족
<플랜의 요구사항 표 — 상태 채워진 것>

## 설계 판단
<플랜의 ## 설계 판단>

## 가정
<플랜의 ## 가정>

## 리뷰 포인트
<플랜의 ## 리스크 + 확신 없는 부분>

## 테스트
<검증 명령 + 결과 숫자>
기존 142 passed → 148 passed (신규 6건)

## 범위 밖 / 후속
<플랜의 ## 범위 밖 + 로그에 기록된 "발견" 항목들>

## 커밋
<git log --oneline origin/main..HEAD 결과>
```

**배포 순서 의존성이 있으면 맨 위에 경고로 올린다.**

```
⚠️ 배포 순서: PROJ-140(중복 데이터 정리)을 먼저 배포해야 합니다. 반대면 마이그레이션이 실패합니다.
```

플랜 `## 로그`의 "발견" 항목은 **후속 작업 목록**이 된다. 여기서 후속 티켓 생성을 제안한다 (`ticket`).

### 금지 문구 — 본문에서 지운다

```
전반적으로 개선했습니다        문제없이 동작합니다
여러 가지를 수정했습니다        테스트 완료 (명령·숫자 없이)
코드를 정리했습니다            안정성을 향상
더 나은 구조로 변경            성능을 개선 (숫자 없이)
사소한 변경                   필요한 부분을 반영
```

판정 기준 하나: **그 문장을 읽고 리뷰어가 diff의 어디를 봐야 하는지 아는가.**
모르면 지우거나 파일·숫자로 바꾼다.

```
성능을 개선  →  목록 조회 p95 1.2s → 380ms (N+1 제거, UserRepository.java:47)
테스트 완료  →  ./gradlew test — 142 passed → 148 passed (신규 6건)
```

### PR 크기 확인

```bash
git diff origin/main --stat | tail -1
```

400줄을 넘으면 알린다. 쪼갤 수 있으면 제안하고, 못 쪼개면 **커밋 단위로 읽으라는 안내를 본문에 넣는다.**

```
커밋 단위로 보시면 읽기 쉽습니다: 1) 정규화 2) 중복 검사 3) 응답 매핑 4) 마이그레이션
```

## 4. 미리보기 → 승인 → 생성

**본문 전문을 보여주고 승인받는다.** PR 생성은 팀에 알림이 나가고, 되돌리려면 닫아야 한다.

```bash
git push -u origin feature/PROJ-123-duplicate-email
```

### Bitbucket

Atlassian MCP `bitbucketPullRequest` (write_bitbucket 권한 필요).
workspace/repo_slug/source branch/destination branch/title/description을 넘긴다.
**인자 이름은 실제 도구 스키마에서 확인한다.** 이 문서의 필드명을 그대로 믿지 않는다.

### Forgejo

토큰은 환경변수에서 읽는다. **명령에 토큰을 직접 쓰지 않는다** (셸 히스토리에 남는다).

```bash
: "${FORGEJO_TOKEN:?FORGEJO_TOKEN 이 필요합니다}"

jq -n --arg t "$TITLE" --arg b "$BODY" --arg h "$BRANCH" --arg base "$BASE" \
  '{title:$t, body:$b, head:$h, base:$base}' > /tmp/pr.json

curl -sS -X POST "$FORGEJO_URL/api/v1/repos/$OWNER/$REPO/pulls" \
  -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/pr.json
```

`Authorization: token <값>` 형식이다 — `Bearer`가 아니다. 응답의 `html_url`이 PR 주소다.
본문은 반드시 `jq`로 JSON 이스케이프한다. 한글·따옴표·줄바꿈이 그냥 들어가면 깨진다.

리뷰어 지정은 별도 호출이다: `POST /api/v1/repos/{owner}/{repo}/pulls/{index}/requested_reviewers`

## 5. Jira 연결

PR 생성 후:

1. **완료 조건 체크박스 갱신** — 티켓 본문의 `- [ ]` 항목 중 이번 변경으로 충족된 것을 체크한다
   - 갱신 직전에 본문을 다시 읽는다. 조회와 갱신 사이에 편집이 있었으면 순서가 어긋난다
   - **코드·커밋·테스트로 명백히 충족된 것만** 체크한다. 부분 충족·추정·의심은 체크하지 않는다
   - "QA 통과", "디자인 리뷰 완료" 같이 코드로 검증할 수 없는 항목은 건드리지 않는다
   - 이미 체크된 항목은 그대로 둔다
2. `addCommentToJiraIssue` — PR 링크와 한 줄 요약.
   **진행 기록은 본문이 아니라 코멘트에 남긴다** — 본문 갱신은 전체 교체라 남의 편집을 덮어쓴다
3. `getTransitionsForJiraIssue` → `transitionJiraIssue` — In Review로. **승인받고 실행한다**
   - 전이 이름은 조회 결과에서 고른다. 추측하지 않는다
   - 가능한 전이가 없으면 건너뛰고 알린다

**한 단계가 실패해도 다음 단계를 계속 진행하고 결과를 누적 보고한다.**
PR은 이미 만들어졌는데 Jira 코멘트 실패로 멈추면, 무엇이 됐고 무엇이 안 됐는지 알 수 없게 된다.

Bitbucket은 브랜치·커밋의 Jira 키로 자동 연결되지만, **자동 연결을 전제하지 않고 코멘트를 남긴다.**
Forgejo는 Jira와 연동이 없으므로 코멘트가 유일한 연결 고리다.

## 6. 마무리

플랜을 갱신한다: `status: pr-open`, `pr: <URL>`, 로그 한 줄.

```
PR 생성됨 — https://git.example.com/team/service/pulls/482
Jira PROJ-123 → In Review, PR 링크 코멘트 추가
후속 티켓 후보 2건이 플랜 로그에 있습니다.
머지되면 /work:cleanup 으로 브랜치 정리와 후속 티켓 생성을 한 번에 처리합니다.
```

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| 셀프 리뷰 없이 PR | 리뷰어가 디버그 로그부터 지적한다 |
| 리베이스 없이 PR | CI가 깨지고 리뷰어가 충돌을 떠안는다 |
| PR 본문을 새로 창작 | 플랜과 어긋나고 가정·리스크가 누락된다 |
| 미구현·한계 생략 | 반드시 발견되고 신뢰 비용이 더 크다 |
| 토큰을 명령에 직접 | 셸 히스토리·로그에 남는다 |
| 호스트 추측 | 엉뚱한 곳에 PR이 열린다 |
| 승인 없이 생성 | 팀 알림, 되돌리려면 닫아야 한다 |

## 참고 파일

- `references/hosts.md` — Bitbucket·Forgejo 호출 상세, remote URL 파싱, 실패 대응
