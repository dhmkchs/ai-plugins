# work — OpenAI Codex 스킬

`ai-plugins` 저장소의 **Codex** 부분이다. Claude Code의 `work` 플러그인과 **같은 워크플로**를
Codex CLI/IDE에서 쓸 수 있게 스킬로 포장했다.

Codex는 마켓플레이스가 아니라 **`.agents/skills/` 폴더**에서 스킬을 읽는다.
여기 `codex/skills/`에 든 13개 스킬을 Codex가 스캔하는 위치로 복사하면 된다.

```
codex/
└── skills/
    ├── ticket/SKILL.md
    ├── plan/SKILL.md
    ├── start/SKILL.md
    ├── review/SKILL.md
    ├── pr/SKILL.md
    ├── cleanup/SKILL.md
    ├── status/SKILL.md
    ├── explore/SKILL.md
    ├── debug/SKILL.md
    ├── browser/SKILL.md   (+ scripts/check.mjs, references/)
    ├── feature/SKILL.md
    ├── pair/SKILL.md
    └── lang/SKILL.md
```

각 스킬은 `SKILL.md`(frontmatter의 `name`·`description` + 절차)와 필요 시 `references/`, `scripts/`로 구성된다.
이 형식은 Claude Code 스킬과 동일해서, 정본을 `claude/plugins/work/skills/`에 두고 여기로 동기화한다.

---

## 설치

Codex는 아래 위치의 `.agents/skills/`를 CWD에서 저장소 루트까지, 그리고 홈 디렉터리에서 스캔한다.

```bash
# 개인 — 모든 프로젝트에서 (홈)
mkdir -p ~/.agents/skills
cp -R codex/skills/* ~/.agents/skills/

# 프로젝트 — 이 프로젝트에서만 (팀과 커밋으로 공유)
mkdir -p .agents/skills
cp -R codex/skills/* .agents/skills/
```

확인:

```
/skills
```

설치된 스킬 목록에 `ticket`, `review`, `browser` … 가 보이면 된다.

> **버전 관리 팁**: 심볼릭 링크로 걸어두면 저장소를 `git pull` 할 때 스킬도 같이 갱신된다.
> `ln -s "$PWD/codex/skills"/* ~/.agents/skills/` (저장소를 옮기면 링크가 깨지니 고정 위치에 둔다.)

---

## 사용법

### 자동 호출 (implicit)

Codex가 대화 내용을 스킬의 `description`과 매칭해 알아서 켠다.
"PR 올리기 전에 봐줘" → `review`, "이 페이지 콘솔 에러 있나" → `browser`,
"이거 티켓으로 만들어줘" → `ticket`.

### 명시 호출 (explicit)

`$스킬이름`으로 직접 부른다. 또는 `/skills`로 골라서 실행한다.

```
$review
$browser
$ticket 로그인 실패 시 429 응답
```

### 메인 사슬

Claude 쪽과 같다. 순서대로 이어서 부른다.

```
$ticket → $plan → $start → $review → $pr → $cleanup
```

`.work/plans/<TICKET>.md` 플랜 파일이 사슬 전체의 backbone이고, `$status`로 현재 위치를 확인한다.

### 스킬 목록

| 스킬 | 하는 일 |
|---|---|
| `ticket` | 대화 → Jira 티켓 (중복 확인 · 필드 조회) |
| `plan` | 티켓 → 코드베이스 정찰 → 슬라이스 플랜 파일 |
| `start` | 슬라이스 실행 (커밋마다 플랜 갱신 · 재개 가능) |
| `review` | 셀프 리뷰 게이트 (기계 검사 → 적대적 diff) |
| `pr` | 플랜·커밋 → PR 본문 생성 · Jira 연결 |
| `cleanup` | 머지 후 브랜치 정리 · 플랜 닫기 · 후속 티켓 |
| `status` | 플랜 vs git vs Jira 드리프트 검사 |
| `explore` | 낯선 코드베이스 정찰 · 수정 지점 국소화 |
| `debug` | 재현 → 국소화 → 최소수정 → 회귀방지 |
| `browser` | Playwright로 화면 자가검수 (DOM·콘솔·요청) |
| `feature` | Jira 없이 요구사항 → 구현·테스트·PR |
| `pair` | AI에게 코드 맡길 때의 요청·검증 사이클 |
| `lang` | TS·Java 관용구와 함정 |

---

## 전제 조건

| 기능 | 필요한 것 |
|---|---|
| `ticket` · `plan` · Jira 전이 | Atlassian MCP 서버 (Codex `mcp` 설정에 등록) |
| `pr` (Bitbucket) | Atlassian MCP + `write_bitbucket` 권한 |
| `pr` (Forgejo) | `FORGEJO_TOKEN`, `FORGEJO_URL` 환경변수 |
| `browser` | `npm i -D playwright` + `npx playwright install chromium` |

> **토큰을 `.work/config.json`에 쓰지 않는다.** 그 파일은 커밋된다. 환경변수로 둔다.

---

## Claude Code 판과의 차이

- **네임스페이스 없음.** Claude는 `/work:review`처럼 `work:` 접두사가 붙지만, Codex 스킬은 `review`로 노출된다.
  다른 스킬과 이름이 겹칠 수 있으니, 겹치면 폴더명을 `work-review`처럼 바꾼다.
- **커맨드 래퍼 불필요.** Claude의 `commands/*.md`(슬래시 등록용)는 Codex에 필요 없다.
  Codex는 스킬을 자동 발견하고 `$이름`으로 명시 호출한다.
- **정본은 Claude 쪽.** 스킬을 고칠 때는 `claude/plugins/work/skills/`에서 고치고 아래로 동기화한다.

```bash
rsync -a --delete ../claude/plugins/work/skills/ ./skills/
```

명시 호출을 끄고 자동 호출만 쓰거나 그 반대로 하려면 각 스킬에 `agents/openai.yaml`을 두고
`policy.allow_implicit_invocation`을 조정한다.
