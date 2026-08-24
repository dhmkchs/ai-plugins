# work — Claude Code 플러그인

`ai-plugins` 저장소의 **Claude Code** 부분이다. `work` 플러그인 하나를 마켓플레이스로 배포한다.
개발 작업을 **티켓부터 릴리즈까지** 끌고 가는 스킬 세트다.

마켓플레이스 카탈로그(`.claude-plugin/marketplace.json`)는 **저장소 루트**에 있고,
플러그인 실체는 이 `claude/` 폴더 아래에 있다. Claude Code가 GitHub 설치 시 소스 루트에서
카탈로그를 찾기 때문이며, 카탈로그의 `source`는 `./claude/plugins/work`를 가리킨다.

```
ai-plugins/
├── .claude-plugin/
│   └── marketplace.json      ← 카탈로그 (dhmkchs) · source: ./claude/plugins/work
└── claude/
    ├── plugins/
    │   └── work/
    │       ├── .claude-plugin/plugin.json   ← 플러그인 정의 (work, v0.8.0)
    │       ├── commands/                     ← 슬래시 커맨드 21종 (/work:*)
    │       └── skills/                       ← 스킬 21종
    ├── INSTALL.md
    └── README.md             ← 이 문서
```

| 항목 | 값 |
|---|---|
| 마켓플레이스 이름 | `dhmkchs` |
| 플러그인 | `work@dhmkchs` (v0.8.0) |
| 저장소 | `github.com/dhmkchs/ai-plugins` |
| 대상 스택 | JavaScript / TypeScript, Java (Spring) |

---

## 설치

### 1. GitHub 저장소로 설치 — 권장

```bash
claude plugin marketplace add dhmkchs/ai-plugins
claude plugin install work@dhmkchs
```

Claude Code 세션 안에서는 슬래시 커맨드로도 같다.

```
/plugin marketplace add dhmkchs/ai-plugins
/plugin install work@dhmkchs
```

확인:

```bash
claude plugin list
# > work@dhmkchs   Version: 0.8.0   Scope: user   Status: enabled
```

비공개 저장소면 설치하는 쪽이 저장소 읽기 권한(SSH 키 또는 토큰)을 가지고 있어야 한다.

### 2. 로컬 경로로 설치 — 개발·수정할 때

카탈로그가 있는 **저장소 루트**를 등록한다 (`claude/`가 아니라 루트).

```bash
claude plugin marketplace add ~/Documents/GitHub/ai-plugins
claude plugin install work@dhmkchs
```

> **로컬 경로 설치는 등록이지 심볼릭이 아니다.** 폴더를 옮기거나 지우면 깨진다.
> 옮겼다면 `marketplace remove dhmkchs` 후 새 경로로 다시 `add`.

### 3. 프로젝트 단위 자동 설정 — 저장소를 여는 모두에게

프로젝트의 `.claude/settings.json`에 선언하면 팀원이 별도 설치 없이 쓴다.

```json
{
  "extraKnownMarketplaces": {
    "dhmkchs": {
      "source": {
        "source": "github",
        "repo": "dhmkchs/ai-plugins"
      }
    }
  },
  "enabledPlugins": {
    "work@dhmkchs": true
  }
}
```

### 4. 플러그인 없이 스킬만 쓰기

```bash
# 개인 — 모든 프로젝트에서
mkdir -p ~/.claude/skills
cp -R claude/plugins/work/skills/* ~/.claude/skills/

# 프로젝트 — 이 저장소에서만
mkdir -p .claude/skills
cp -R claude/plugins/work/skills/* .claude/skills/
```

> 이렇게 넣으면 네임스페이스(`work:`)가 없어져 `debug` 같은 이름으로 노출된다. 계속 쓸 거면 플러그인 방식이 낫다.

### Cowork (데스크톱 앱)

`work.plugin`을 대화창에 올려 설치 버튼을 누른다. `.plugin`은 `plugins/work/` 내용을 zip으로 묶은 것이다.

```bash
cd claude/plugins/work && zip -r ../../../work.plugin . -x "*.DS_Store"
```

> Claude Code와 Cowork는 플러그인 저장소를 공유하지 않는다. 각각 설치한다.

---

## 사용법

### 메인 사슬

```
/work:ticket   대화 → Jira 티켓                 (중복 확인 · 필수 필드 조회)
     ↓
/work:plan     티켓 → .claude/plans/PROJ-123.md   (정찰 결과를 플랜에 임베드)
     ↓
/work:start    플랜 → 슬라이스 실행              (슬라이스마다 구현+유닛 테스트 → 커밋 · 재개 가능)
     ↓
/work:commit   변경 → 원자적 커밋               (Conventional Commits · 왜를 남김)
     ↓
/work:review   변경 → 셀프 리뷰 게이트            (기계 검사 → 적대적 diff)
     ↓
/work:pr       플랜 + 커밋 → PR 본문 · 생성 · Jira 연결
     ↓
/work:cleanup  머지 후 → 브랜치 정리 · 플랜 닫기 · 후속 티켓 회수
     ↓
/work:release  머지된 변경 → semver·태그·changelog · 배포순서 · 롤백
```

**플랜 파일(`.claude/plans/<TICKET>.md`)이 사슬 전체의 backbone**이다. `/work:status`로 언제든 현재 위치를 확인한다.
설계·구현 보조 스킬(`adr`·`api`·`migrate`·`e2e`)은 사슬 옆에서 필요할 때 끼어든다.

### 전체 명령 (21종)

| 명령 | 하는 일 |
|---|---|
| `/work:setting` | 설정 잡기. 회사 공통값은 글로벌 `~/.work/config.json`, repo 고유값은 `.work/config.json`, 토큰은 셸 env |
| `/work:ticket` | Jira 티켓 생성. 중복 확인 → 4요소(문제·영향·완료조건·범위밖) → 필드 조회 → 승인 후 생성 |
| `/work:plan` | 티켓 읽기 → 코드베이스 정찰 → 요구사항 표 → 수직 슬라이스 → 플랜 파일 |
| `/work:start` | 첫 미완료 슬라이스부터 실행. 브랜치 생성, Jira 전이, 슬라이스마다 **구현+유닛 테스트**→커밋→플랜 갱신 |
| `/work:test` | 유닛 테스트 작성·보강·리뷰. 행위 표 도출 → 작성 → 실행 → 스멜 체크리스트 |
| `/work:commit` | 원자적 커밋 분할 · 잔여물/시크릿 검사 · Conventional Commits로 왜를 남김 |
| `/work:review` | 디버그 잔여물·자격증명·비활성 테스트 검사 → 적대적 diff 리뷰 → 설명 가능성 게이트 |
| `/work:pr` | 호스트 감지 → 플랜에서 본문 생성 → PR 생성 → Jira 코멘트·상태 전이 |
| `/work:cleanup` | 머지 확인 → 브랜치·worktree 정리 → 플랜 닫기 → Jira Done → 후속 티켓 생성 |
| `/work:release` | semver 버전·태그·changelog → 배포 순서 → 배포 후 확인 → 롤백 계획 |
| `/work:status` | 플랜 현황 + 드리프트 검사 (플랜 vs git vs Jira 불일치) |
| `/work:adr` | 되돌리기 비싼 설계 판단을 대안·근거·결과와 함께 ADR로 기록 |
| `/work:api` | REST/GraphQL 계약을 스키마·에러·인증·페이지네이션까지 계약 우선 설계 |
| `/work:migrate` | DB 스키마를 expand-contract·롤백·배포순서로 무중단 변경 |
| `/work:e2e` | 브랜치에서 바뀐 코드로 Playwright 회귀 테스트 생성·실행·커밋 |
| `/work:explore` | 낯선 코드베이스 정찰 → 수정 지점 국소화 → 정찰 노트 |
| `/work:debug` | 재현 → 국소화 → 가설 → 최소수정 → 회귀방지 |
| `/work:browser` | Playwright로 aria 스냅샷·콘솔 에러·실패 요청을 텍스트로 뽑아 판정 (일회성) |
| `/work:feature` | Jira 없이 요구사항을 구현·테스트·PR까지 |
| `/work:pair` | AI에게 코드를 맡길 때의 요청·검증 사이클 |
| `/work:lang` | TS·Java 관용구와 함정 |

슬래시로 부르지 않아도 스킬은 표현을 감지해 자동으로 켜진다 — "PR 올리기 전에 봐줘" → `review`.
`browser`(일회성 자가검수)와 `e2e`(영속 회귀 테스트)는 목적이 다르다.

### 전제 조건

| 기능 | 필요한 것 |
|---|---|
| `ticket` · `plan` · Jira 전이 | **Atlassian MCP 서버** (Rovo) |
| `pr` (Bitbucket) | Atlassian MCP + `write_bitbucket` 권한 |
| `pr` (Forgejo) | `FORGEJO_TOKEN`, `FORGEJO_URL` 환경변수 (`/work:setting`으로 안내) |
| `browser` · `e2e` | `npm i -D @playwright/test` + `npx playwright install chromium` |
| `migrate` | 프로젝트 마이그레이션 도구 (Prisma / TypeORM / Flyway / Liquibase) |

> **설정은 `/work:setting`으로 잡는다.** 회사 공통값(host·prefix·리뷰어·전이명)은 글로벌 `~/.work/config.json`에 한 번,
> repo 고유값(projectKey·owner·repo·base)만 프로젝트 `.work/config.json`에 — 대부분 git remote에서 자동 감지된다.
> **토큰은 어느 config 파일에도 쓰지 않는다.** 두 파일 다 커밋될 수 있다. 환경변수로 둔다.

---

## 확인 · 업데이트 · 제거

```bash
claude plugin marketplace list
claude plugin list
claude plugin validate .                    # 저장소 루트에서 마켓플레이스 검증
claude plugin validate claude/plugins/work  # 플러그인 단독 검증
claude plugin marketplace update dhmkchs
claude plugin marketplace remove dhmkchs
```

플러그인을 고친 뒤 세션에 반영하려면 `/reload-plugins`.

> **버전 갱신에는 재설치가 필요하다.** `marketplace update`만으로는 안 올라간다.
> ```bash
> claude plugin marketplace update dhmkchs
> claude plugin uninstall work@dhmkchs
> claude plugin install work@dhmkchs
> ```

새 버전을 배포하려면 `plugin.json`과 `marketplace.json`의 `version`을 같이 올리고 push한다.

---

## 문제가 생기면

| 증상 | 원인 · 대응 |
|---|---|
| `marketplace add` 실패 | 저장소 **루트**에 `.claude-plugin/marketplace.json`이 있는지 확인. `claude plugin validate .` |
| 설치는 됐는데 스킬이 안 보임 | `/reload-plugins`, 그래도 안 되면 세션 재시작 |
| 스킬이 두 벌 보임 | 같은 스킬을 플러그인 + `~/.claude/skills/` 양쪽에 넣었다. 한쪽을 지운다 |
| 폴더를 옮긴 뒤 깨짐 | `marketplace remove` 후 새 경로로 다시 `add` |
| 팀원만 설치 실패 | 저장소 접근 권한, `marketplace.json`이 커밋됐는지 확인 |

Codex에서 같은 워크플로를 쓰는 법은 [`../codex/README.md`](../codex/README.md).
플러그인 설계·커스터마이즈는 [`plugins/work/README.md`](./plugins/work/README.md), 더 자세한 배포는 [`INSTALL.md`](./INSTALL.md).
