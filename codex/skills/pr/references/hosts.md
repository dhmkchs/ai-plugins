# 호스트별 PR 생성

## remote URL 파싱

```bash
URL=$(git remote get-url origin)

# git@host:owner/repo.git  또는  https://host/owner/repo.git
HOST=$(echo "$URL" | sed -E 's#^(git@|https?://)([^/:]+).*#\2#')
PATHPART=$(echo "$URL" | sed -E 's#^(git@[^:]+:|https?://[^/]+/)##; s#\.git$##')
OWNER=$(echo "$PATHPART" | cut -d/ -f1)
REPO=$(echo "$PATHPART" | cut -d/ -f2)

BRANCH=$(git branch --show-current)
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's#.*/##')
BASE=${BASE:-main}

echo "host=$HOST owner=$OWNER repo=$REPO branch=$BRANCH base=$BASE"
```

`$HOST`가 `bitbucket.org`면 Bitbucket, 그 외 자체 호스팅이면 Forgejo로 본다.
Bitbucket Server(자체 호스팅)를 쓰는 팀도 있으니 **애매하면 묻는다.**
config의 `git.host`가 있으면 그것이 최우선이다 (프로젝트 `.work/config.json` > 글로벌 `~/.work/config.json`).

파싱이 실패하거나 `owner`/`repo`가 비면 그 자리에서 멈추고 사용자에게 확인한다.

---

## Forgejo (토큰)

### 준비

```bash
# 토큰: 웹 UI > Settings > Applications > Generate New Token
# 필요한 권한: repository (read/write)
export FORGEJO_TOKEN="..."           # 셸 프로필이나 비밀 관리자에 둔다
export FORGEJO_URL="https://git.example.com"
```

**토큰을 config 파일(글로벌·프로젝트)이나 커밋되는 파일에 쓰지 않는다.** 그 파일들은 커밋된다.
`FORGEJO_TOKEN`은 셸 env로만, `FORGEJO_URL`은 config에 둬도 된다 (비밀이 아니다). `/work:setting`으로 잡는다.

### PR 생성

```bash
: "${FORGEJO_TOKEN:?FORGEJO_TOKEN 이 필요합니다}"
: "${FORGEJO_URL:?FORGEJO_URL 이 필요합니다}"

git push -u origin "$BRANCH"

# 본문은 반드시 jq로 이스케이프 — 한글·따옴표·줄바꿈이 그냥 들어가면 깨진다
jq -n --arg t "$TITLE" --arg b "$(cat /tmp/pr-body.md)" --arg h "$BRANCH" --arg base "$BASE" \
  '{title:$t, body:$b, head:$h, base:$base}' > /tmp/pr.json

curl -sS -X POST "$FORGEJO_URL/api/v1/repos/$OWNER/$REPO/pulls" \
  -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/pr.json | tee /tmp/pr-resp.json | jq -r '.html_url // .message'
```

`Authorization: token <값>` 형식이다. **`Bearer`가 아니다** — Forgejo는 역사적 이유로 `token`을 요구한다.

### 리뷰어·라벨 (선택)

PR 번호는 응답의 `.number`.

```bash
PR=$(jq -r '.number' /tmp/pr-resp.json)

# 리뷰어
curl -sS -X POST "$FORGEJO_URL/api/v1/repos/$OWNER/$REPO/pulls/$PR/requested_reviewers" \
  -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \
  -d '{"reviewers":["alice","bob"]}'

# 라벨은 이슈 API를 쓴다 (PR도 이슈로 취급된다). 라벨 ID가 필요하다
curl -sS "$FORGEJO_URL/api/v1/repos/$OWNER/$REPO/labels" \
  -H "Authorization: token $FORGEJO_TOKEN" | jq -r '.[] | "\(.id) \(.name)"'
```

### 초안 PR

Forgejo는 제목 앞에 `WIP:`를 붙이면 초안으로 취급한다 (기본 prefix, 인스턴스 설정에 따라 다를 수 있다).

### 응답 코드

| 코드 | 의미 | 대응 |
|---|---|---|
| 201 | 생성됨 | `.html_url` 출력 |
| 401 | 토큰 무효·만료 | 토큰 재발급 |
| 403 | 권한 부족 | 토큰 스코프에 repository write 확인 |
| 404 | owner/repo 오류 또는 접근 불가 | 파싱 결과와 URL 확인 |
| 409 | 같은 head→base PR이 이미 있음 | 기존 PR을 찾아 갱신 제안 |
| 422 | head/base 오류, 커밋 없음 | 푸시했는지, base가 맞는지 확인 |

409면 기존 PR을 찾아 보여준다:
```bash
curl -sS "$FORGEJO_URL/api/v1/repos/$OWNER/$REPO/pulls?state=open" \
  -H "Authorization: token $FORGEJO_TOKEN" | jq -r ".[] | select(.head.ref==\"$BRANCH\") | .html_url"
```

### 기존 PR 갱신

```bash
curl -sS -X PATCH "$FORGEJO_URL/api/v1/repos/$OWNER/$REPO/pulls/$PR" \
  -H "Authorization: token $FORGEJO_TOKEN" -H "Content-Type: application/json" \
  -d @/tmp/pr-patch.json
```

---

## Bitbucket Cloud (Atlassian MCP)

Atlassian Rovo MCP의 `bitbucketPullRequest` 도구를 쓴다. **write_bitbucket 권한이 필요하다** —
읽기만 연결돼 있으면 생성이 실패한다. 실패하면 권한 문제임을 알리고 멈춘다.

**도구의 정확한 인자 이름은 실제 도구 스키마에서 확인한다.** 문서 기준으로 추측해 호출하지 않는다.
대체로 workspace, repo_slug, source branch, destination branch, title, description을 요구한다.

`bitbucketRepository` / `bitbucketRepoContent`로 workspace·repo slug·기본 브랜치를 먼저 확인할 수 있다.

MCP를 못 쓰는 상황이면 앱 비밀번호로 REST API를 쓸 수 있다.

```bash
curl -sS -X POST \
  "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO/pullrequests" \
  -u "$BB_USER:$BB_APP_PASSWORD" \
  -H "Content-Type: application/json" \
  -d @/tmp/pr-bb.json
```
```json
{
  "title": "...",
  "description": "...",
  "source": { "branch": { "name": "feature/PROJ-123-x" } },
  "destination": { "branch": { "name": "main" } },
  "close_source_branch": true
}
```

### 리뷰어 지정

Bitbucket은 PR 생성 시 `reviewers`를 함께 넘길 수 있다. **uuid가 필요하고 계정명으로는 안 된다.**

```bash
# workspace 멤버에서 uuid 조회
curl -sS "https://api.bitbucket.org/2.0/workspaces/$WORKSPACE/members" \
  -u "$BB_USER:$BB_APP_PASSWORD" | jq -r '.values[] | "\(.user.uuid) \(.user.display_name)"'

# 기본 리뷰어가 설정돼 있으면 그걸 쓰는 게 낫다
curl -sS "https://api.bitbucket.org/2.0/repositories/$WORKSPACE/$REPO/default-reviewers" \
  -u "$BB_USER:$BB_APP_PASSWORD" | jq -r '.values[] | "\(.uuid) \(.display_name)"'
```

페이로드에 추가한다.
```json
{ "reviewers": [ { "uuid": "{...}" }, { "uuid": "{...}" } ] }
```

config의 `pr.reviewers`(글로벌 또는 프로젝트)에 계정명을 두고, 매번 uuid로 변환해 쓴다.
uuid를 config에 직접 적어두면 사람이 읽을 수 없어 유지가 안 된다.

Bitbucket은 브랜치명·커밋 메시지의 Jira 키로 티켓과 자동 연결된다.
그래도 **PR 링크 코멘트는 남긴다** — 자동 연결이 안 걸리는 경우가 있고, 코멘트가 더 눈에 띈다.

---

## 공통 실패 대응

| 증상 | 원인 | 대응 |
|---|---|---|
| `src refspec ... does not match any` | 커밋이 없다 | `git log`로 확인 |
| push는 됐는데 PR이 422 | base 브랜치명이 틀림 | `git ls-remote --heads origin`로 확인 |
| 본문이 깨져 보임 | JSON 이스케이프 누락 | `jq -n --arg` 사용 |
| 한글이 물음표로 | 인코딩 | 파일로 저장 후 `--arg "$(cat file)"` |
| 리베이스 후 push 거부 | 이력이 바뀜 | `git push --force-with-lease` (`--force` 아님) |
| PR은 만들어졌는데 Jira 미연결 | 자동 연결 실패 | `addCommentToJiraIssue`로 링크 |

`--force-with-lease`를 쓴다. `--force`는 남의 커밋을 지운다.
