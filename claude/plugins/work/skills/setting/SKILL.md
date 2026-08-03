---
name: setting
description: >
  work 사슬 설정을 잡는다 — 회사 공통값은 글로벌 `~/.work/config.json`에 한 번, repo 고유값은
  프로젝트 `.work/config.json`에. Use when setting up work in a new environment or fixing
  connection config — "work 설정", "글로벌 설정", "설정 잡아줘", "config 만들어줘", "포지스토 토큰 어디",
  "FORGEJO_TOKEN 어디에", "매 프로젝트마다 설정하기 귀찮아", "jira 프로젝트 키 설정", "PR 안 올라가는데 설정",
  "리뷰어 기본값", "codex 스킬 글로벌로", "스킬 모든 프로젝트에서 쓰기", "스킬 프로젝트마다 복사하기 싫어" —
  or the first time `ticket`/`plan`/`pr` complains it can't detect the project. 비밀 토큰은 어느 파일에도
  쓰지 않고 셸 환경변수로 안내한다. Codex면 스킬을 홈에 심어 전 프로젝트에서 쓰게 도와준다.
---

# Setting

**프로젝트마다 전부 설정하지 않는다.** 회사에서 안 바뀌는 값은 글로벌에 한 번,
repo마다 바뀌는 값만 프로젝트에 — 그리고 그것도 대부분 git에서 자동 감지된다.

## 설정이 사는 세 곳

| 어디 | 무엇 | 왜 여기 |
|---|---|---|
| **셸 env** (`~/.zshrc`) | `FORGEJO_TOKEN`, `FORGEJO_URL` | 비밀. 한 번 export하면 **전 프로젝트 공통** |
| **글로벌** `~/.work/config.json` | host, branchPrefix, 이슈타입, 전이명, 리뷰어 | 회사에서 잘 안 바뀜 → 한 번만 |
| **프로젝트** `.work/config.json` | projectKey, owner, repo, base | repo 고유. 대부분 remote에서 자동 감지 |

**병합 순서: 프로젝트 > 글로벌 > env > 감지 > 질문.** 프로젝트 값이 글로벌을 덮어쓴다.
그래서 새 repo에서는 아무것도 안 잡아도 글로벌 + 자동감지로 대개 굴러간다.

**핵심 원칙 — 비밀은 어느 파일에도 넣지 않는다.** 두 config 파일 모두 커밋될 수 있다.
토큰·비밀번호는 셸 env로만 둔다.

## 0. 무엇을 잡을지 정한다

사용자가 원하는 범위를 확인한다.

- **처음 세팅 / "글로벌 설정"** → 1·2절(env)과 3절(글로벌)을 한다. 프로젝트값은 자동감지에 맡긴다.
- **특정 repo가 감지 안 됨** → 4절(프로젝트)만 한다.
- 애매하면 묻는다 — "회사 공통값을 글로벌에 잡을까요, 이 repo만 잡을까요?"

기존 설정을 먼저 읽어 현재 상태를 보여준다.

```bash
echo "--- env ---";      echo "FORGEJO_URL=${FORGEJO_URL:-(없음)}  FORGEJO_TOKEN=${FORGEJO_TOKEN:+설정됨}"
echo "--- 글로벌 ---";   cat ~/.work/config.json 2>/dev/null || echo "없음"
echo "--- 프로젝트 ---"; cat .work/config.json 2>/dev/null || echo "없음"
```

## 1. 비밀 — 셸 env (전 프로젝트 공통)

이게 "매 프로젝트마다 하기 귀찮다"의 진짜 답이다. **토큰은 파일이 아니라 셸 프로필에 한 번** 넣으면
모든 repo에서 쓴다. Forgejo를 쓸 때만 필요하다.

```bash
# Forgejo 웹 UI > Settings > Applications > Generate New Token
#   필요한 권한: repository (read/write)
# ~/.zshrc 또는 ~/.bashrc 에 추가 (비밀 관리자를 쓰면 거기에):
export FORGEJO_TOKEN="ghp_..."                 # 비밀 — 어느 config 파일에도 쓰지 않는다
export FORGEJO_URL="https://git.example.com"   # 비밀 아님 — 원하면 글로벌 config에 둬도 된다
```

쓴 뒤 `source ~/.zshrc`(또는 새 셸). 검증:

```bash
: "${FORGEJO_TOKEN:?셸 프로필에 export 되지 않았다}" && echo "FORGEJO_TOKEN OK"
```

Bitbucket은 토큰이 필요 없다 — Atlassian MCP의 `write_bitbucket` 권한으로 처리한다.

## 2. 글로벌 감지 — 묻기 전에 채운다

호스트 종류는 remote로 추정한다.

```bash
URL=$(git remote get-url origin 2>/dev/null)
HOST=$(echo "$URL" | sed -E 's#^(git@|https?://)([^/:]+).*#\2#')
echo "host_domain=$HOST"   # bitbucket.org → bitbucket, 그 외 자체호스팅 → forgejo 추정
```

`bitbucket.org`면 Bitbucket, 그 외 자체 호스팅이면 Forgejo로 **추정**한다.
Bitbucket Server(자체 호스팅)를 쓰는 팀도 있으니 애매하면 묻는다.

## 3. 글로벌 config — 회사 공통값 (한 번만)

여러 repo에서 같은 값들. 감지로 안 채워지는 것만 묻는다. 각 항목은 선택이다.

| 키 | 무엇 | 어떻게 얻나 |
|---|---|---|
| `git.host` | `forgejo` / `bitbucket` | 2절 추정값 확인 |
| `git.forgejoUrl` | Forgejo 베이스 URL | env `FORGEJO_URL`과 같아도 됨. Forgejo일 때만 |
| `git.branchPrefix` | 브랜치 prefix (기본 `feature/`) | 팀 컨벤션 |
| `jira.defaultIssueType` | 기본 이슈 타입 (`Task`/`Story`/`Bug`) | 팀 컨벤션 |
| `jira.inProgressTransition` | "진행 중" 전이 이름 | Jira 워크플로. **이름은 추측 말고 조회** |
| `jira.inReviewTransition` | "리뷰" 전이 이름 | 위와 같음 |
| `pr.reviewers` | 기본 리뷰어 계정명 배열 | 팀원 계정. Forgejo는 계정명, 매번 uuid로 변환 |
| `pr.draft` | 기본 draft 여부 (`true`/`false`) | 팀 컨벤션 |

Jira 전이 이름은 워크플로마다 다르다. Atlassian MCP가 있으면 실제 전이 목록을 조회해서 채우고,
없으면 정확한 이름을 묻는다. 추측한 이름을 넣지 않는다.

승인받은 뒤 쓴다. 비운 키는 넣지 않는다.

```bash
mkdir -p ~/.work
```

```json
{
  "git": { "host": "forgejo", "forgejoUrl": "https://git.example.com", "branchPrefix": "feature/" },
  "jira": { "defaultIssueType": "Task", "inProgressTransition": "In Progress", "inReviewTransition": "In Review" },
  "pr": { "reviewers": ["alice", "bob"], "draft": false }
}
```

기존 글로벌 파일이 있으면 통째로 덮어쓰지 말고 변경한 키만 병합한다.

## 4. 프로젝트 config — repo 고유값만 (대개 자동)

**projectKey를 뺀 대부분은 git에서 감지된다.** 새 repo에서 이 절이 필요한 건 보통 Jira 프로젝트 키뿐이다.

```bash
PATHPART=$(echo "$URL" | sed -E 's#^(git@[^:]+:|https?://[^/]+/)##; s#\.git$##')
OWNER=$(echo "$PATHPART" | cut -d/ -f1)
REPO=$(echo "$PATHPART" | cut -d/ -f2)
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's#.*/##'); BASE=${BASE:-main}
echo "owner=$OWNER repo=$REPO base=$BASE"
```

| 키 | 무엇 | 기본 출처 |
|---|---|---|
| `jira.projectKey` | 티켓 prefix (예: `PROJ`) | **묻는다** — 감지 불가 |
| `git.owner` / `git.repo` | 저장소 소유자·이름 | 감지값 확인. 감지되면 생략 가능 |
| `git.base` | PR 기준 브랜치 | 감지값 확인. `main`이 아니면(예: `develop`) 명시 |
| `pr.reviewers` | 이 repo만 다른 리뷰어 | 글로벌과 다를 때만 |

owner/repo/base가 감지값과 같으면 **파일에 안 써도 된다** — 소비 스킬이 같은 방식으로 감지한다.
글로벌과 다른 값, 감지 안 되는 값(projectKey)만 남긴다.

```json
{
  "jira": { "projectKey": "PROJ" },
  "git": { "base": "develop" }
}
```

기존 프로젝트 파일이 있으면 변경한 키만 병합한다.

## 5. 검증 / 보고

두 파일 모두 `jq`로 파싱되는지, 비밀이 새지 않았는지 확인한다.

```bash
for f in ~/.work/config.json .work/config.json; do
  [ -f "$f" ] || continue
  jq . "$f" >/dev/null && echo "$f: 유효한 JSON"
  grep -iE 'token|secret|password|ghp_|glpat' "$f" && echo "⚠️ $f 에 비밀 — 제거하고 env로" || echo "$f: 비밀 없음 OK"
done
```

무엇을 어디에 넣었는지(글로벌/프로젝트/env) 한 줄로 요약하고, 다음 단계(`/work:ticket` 또는 `/work:plan`)를 알린다.
다음 repo부터는 글로벌 + 자동감지로 대개 4절도 필요 없다.

## 6. Codex — 스킬을 홈에 심어 전 프로젝트에서 (선택)

**Claude Code면 이 절은 건너뛴다.** 플러그인은 설치되면 이미 전 프로젝트에서 뜬다.

Codex는 `.agents/skills/`를 **CWD→저장소 루트, 그리고 홈(`~/.agents/skills/`)** 에서 스캔한다.
즉 **홈에 두면 그게 글로벌**이다 — repo마다 복사할 필요가 없다. 매번 복사 대신 **심볼릭 링크**로 걸면
`ai-plugins`를 `git pull` 할 때 스킬도 같이 갱신된다.

먼저 이 저장소(`ai-plugins`) 위치를 확인한다. 모르면 사용자에게 묻는다.

```bash
REPO="$HOME/Documents/GitHub/ai-plugins"     # 실제 위치로. git rev-parse로 확인 가능
[ -d "$REPO/codex/skills" ] || { echo "codex/skills 없음 — 저장소 경로 확인"; }
```

승인받은 뒤 홈에 심는다. 링크 방식(권장, 자동 갱신)과 복사 방식 중 고른다.

```bash
mkdir -p ~/.agents/skills

# A) 심볼릭 링크 — git pull로 자동 갱신 (저장소를 고정 위치에 둘 때)
ln -sfn "$REPO/codex/skills"/* ~/.agents/skills/

# B) 복사 — 저장소를 지워도 남지만 갱신은 수동
# cp -R "$REPO/codex/skills/"* ~/.agents/skills/
```

확인:

```bash
ls -l ~/.agents/skills            # setting·host·ticket … 이 보이면 됨
# Codex에서:  /skills   (목록에 뜨는지)
```

- **닭-달걀 주의**: `setting` 자체가 스킬이라 처음 한 번은 위 명령을 **직접** 쳐서 부트스트랩해야 한다.
  한 번 링크해두면 `setting`을 포함한 전부가 홈에 뜨고, 이후 갱신은 `git pull`만으로 된다.
- 저장소를 옮기면 링크가 깨진다 — `ai-plugins`를 고정 위치에 두거나, 옮긴 뒤 다시 링크한다.
- 프로젝트 한정으로 쓰고 싶으면 `~/.agents/skills` 대신 그 repo의 `.agents/skills/`에 같은 방식으로 둔다.

정본 스키마·병합 순서는 `skills/plan/references/plan-format.md`의 `.work/config.json` 절.
