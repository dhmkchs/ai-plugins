# ai-plugins

**choiheesik의 개인 AI 플러그인 저장소.** 같은 개발 작업 워크플로를 여러 AI 코딩 도구에서 쓸 수 있게 도구별로 나눠 담는다.

현재 **Claude Code**와 **OpenAI Codex** 두 도구를 지원한다. 워크플로의 내용(티켓 → 플랜 → 실행 → 커밋 → 리뷰 → PR → 정리 → 릴리즈, 설계·API·마이그레이션·E2E·정찰·디버깅·화면 검수)은 같고, 각 도구의 설치 방식에 맞춰 포장만 다르다.

```
ai-plugins/
├── .claude-plugin/
│   └── marketplace.json      ← Claude Code 마켓플레이스 카탈로그 (루트)
├── claude/                   ← Claude Code 용
│   ├── plugins/work/         · work 플러그인 (커맨드 20 · 스킬 20)
│   ├── README.md             · 상세 설치·사용법
│   └── INSTALL.md
└── codex/                    ← OpenAI Codex 용
    ├── skills/               · work 스킬 20종 (.agents/skills 호환)
    └── README.md             · 상세 설치·사용법
```

> Claude 마켓플레이스 카탈로그(`.claude-plugin/marketplace.json`)만 루트에 있다.
> Claude가 GitHub 저장소를 설치할 때 **소스 루트**에서 이 파일을 찾기 때문이다(하위 경로 미지원).
> 카탈로그는 플러그인 실체를 `./claude/plugins/work`로 가리킨다.

---

## Claude Code

```bash
claude plugin marketplace add dhmkchs/ai-plugins
claude plugin install work@dhmkchs
```

설치하면 `/work:ticket`, `/work:review` 같은 커맨드가 뜨고, 스킬은 표현을 감지해 자동으로 켜진다.
상세 설치(로컬 경로 · 프로젝트 자동 설정 · Cowork)와 사용법은 [`claude/README.md`](./claude/README.md).

## OpenAI Codex

Codex는 마켓플레이스가 아니라 `.agents/skills/` 폴더에서 스킬을 읽는다. CWD에서 저장소 루트까지,
**그리고 홈(`~/.agents/skills/`)** 을 스캔한다 — **홈에 두면 그게 곧 글로벌**이라 repo마다 복사할 필요가 없다.

```bash
# 글로벌 (권장) — 모든 프로젝트에서. 심볼릭 링크라 git pull로 자동 갱신
mkdir -p ~/.agents/skills
ln -sfn "$PWD/codex/skills"/* ~/.agents/skills/     # 저장소를 고정 위치에 둘 때
# 또는 복사 (갱신 수동):  cp -R codex/skills/* ~/.agents/skills/

# 프로젝트 한정 — 이 프로젝트에서만 (팀과 커밋으로 공유)
mkdir -p .agents/skills
cp -R codex/skills/* .agents/skills/
```

> 한 번 링크하면 `setting`을 포함한 전 스킬이 모든 프로젝트에서 뜬다. 저장소를 옮기면 링크가 깨지니 고정 위치에 둔다.
> 최초 1회만 위 명령을 직접 실행하면, 이후 스킬 갱신·재설치는 `$setting`이 도와준다.

Codex 세션에서 표현을 감지해 자동으로 켜지고, 명시 호출은 `$review`처럼 `$스킬이름` 또는 `/skills`.
상세는 [`codex/README.md`](./codex/README.md).

---

## work 워크플로 한눈에

```
ticket → plan → start → commit → review → pr → cleanup → release
```

| 스킬 | 하는 일 |
|---|---|
| `ticket` | 대화 → Jira 티켓 (중복 확인 · 필드 조회) |
| `plan` | 티켓 → 코드베이스 정찰 → 슬라이스 플랜 파일 |
| `start` | 슬라이스 실행 (커밋마다 플랜 갱신 · 재개 가능) |
| `commit` | 원자적 커밋 분할 · 잔여물/시크릿 검사 · Conventional Commits |
| `review` | 셀프 리뷰 게이트 (기계 검사 → 적대적 diff) |
| `pr` | 플랜·커밋 → PR 본문 생성 · Jira 연결 |
| `cleanup` | 머지 후 브랜치 정리 · 플랜 닫기 · 후속 티켓 |
| `release` | semver·태그·changelog · 배포순서 · 롤백 |
| `status` | 플랜 vs git vs Jira 드리프트 검사 |
| `adr` | 되돌리기 비싼 설계 판단 → 대안·근거·결과 기록 |
| `api` | REST/GraphQL 계약 우선 설계 (스키마·에러·인증·페이지네이션) |
| `migrate` | DB 스키마 무중단 변경 (expand-contract·롤백·배포순서) |
| `e2e` | 브랜치에서 바뀐 코드로 Playwright 회귀 테스트 생성·실행·커밋 |
| `explore` | 낯선 코드베이스 정찰 · 수정 지점 국소화 |
| `debug` | 재현 → 국소화 → 최소수정 → 회귀방지 |
| `browser` | Playwright로 화면 자가검수 (DOM·콘솔·요청, 일회성) |
| `feature` | Jira 없이 요구사항 → 구현·테스트·PR |
| `pair` | AI에게 코드 맡길 때의 요청·검증 사이클 |
| `lang` | TS·Java 관용구와 함정 |

대상 스택: JavaScript / TypeScript, Java (Spring). Jira · Bitbucket · Forgejo 연동.

## 전제 조건 (양쪽 공통)

| 기능 | 필요한 것 |
|---|---|
| `ticket` · `plan` · Jira 전이 | Atlassian MCP 서버 (Rovo) |
| `pr` (Bitbucket) | Atlassian MCP + `write_bitbucket` 권한 |
| `pr` (Forgejo) | `FORGEJO_TOKEN`, `FORGEJO_URL` 환경변수 |
| `browser` · `e2e` | `npm i -D @playwright/test` + `npx playwright install chromium` |
| `migrate` | 프로젝트 마이그레이션 도구 (Prisma / TypeORM / Flyway / Liquibase) |

> **토큰을 `.work/config.json`에 쓰지 않는다.** 그 파일은 커밋된다. 환경변수로 둔다.

## 유지보수

`work` 워크플로의 정본은 `claude/plugins/work/skills/`다. 여기서 스킬을 고친 뒤
`codex/skills/`로 동기화하면 두 도구가 같은 절차를 공유한다.
플랜 경로만 도구별로 다르다 — Claude는 `.claude/plans/`, Codex는 `.agents/plans/`.
그래서 동기화 뒤 그 경로만 Codex 규약으로 치환한다.

```bash
# claude → codex 동기화
rsync -a --delete claude/plugins/work/skills/ codex/skills/
# Claude 전용 플랜 경로를 Codex 규약으로 (macOS sed는 -i ''; GNU sed는 -i)
grep -rl '.claude/plans' codex/skills/ | xargs sed -i '' 's|.claude/plans|.agents/plans|g'
```
