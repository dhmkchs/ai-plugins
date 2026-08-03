# 플랜 파일 정본 스키마

경로: `.work/plans/<TICKET>.md` (예: `.work/plans/PROJ-123.md`)

`plan`이 만들고, `start`가 갱신하고, `pr`가 읽고, `status`가 집계한다.
**front-matter의 키 이름을 바꾸지 않는다.** 다른 스킬이 이걸로 상태를 판단한다.

---

## 전체 형식

```markdown
---
ticket: PROJ-123
title: 중복 이메일로 계정이 두 개 생성됨
status: planned
branch: feature/PROJ-123-duplicate-email
base: main
host: forgejo
plan_version: 1
created: 2026-08-03
updated: 2026-08-03
pr: null
---

## 요구사항

| # | 요구사항 (티켓 원문) | 필수 | 검증 방법 | 상태 |
|---|---|---|---|---|
| 1 | "이미 존재하는 이메일로 가입 시 409" | 필수 | `UserApiTest.중복_이메일이면_409` | ☐ |
| 2 | "대소문자가 달라도 같은 이메일" | 필수 | `UserApiTest.대소문자_무시` | ☐ |
| 3 | "동시 요청에서도 중복 없음" | 필수 | DB 유니크 제약 + 통합 테스트 | ☐ |

## 정찰 노트

- 스택: Java 21 / Spring Boot 3.3 / Gradle
- 실행: build=`./gradlew build` test=`./gradlew test` run=`./gradlew bootRun`
- 테스트 기준선: 142 passed / 0 failed  (2026-08-03 확인)
- 수정 지점: `src/main/java/com/example/user/UserService.java:48` (register)
  - 계약: 입력 email·name / 출력 User / 부수효과 저장 + 가입메일 발송
- 호출부: 3곳 — UserController:31, AdminUserController:57, UserImportJob:88
- 관례: 에러=도메인 예외 + @RestControllerAdvice / 로깅=slf4j / 테스트=JUnit5+AssertJ
- 미해결 질문: 기존 중복 데이터 47건을 어떻게 할지 (티켓 범위 밖으로 두었음)

## 슬라이스

- [ ] S1 중복 검사 없이 정상 가입 흐름 관통 확인 (기준선 고정)
      대상: 없음 (기존 동작 확인만)
      완료: `./gradlew test --tests "*UserApiTest*"` 통과
      커밋:
- [ ] S2 이메일 정규화 + 중복 검사 추가
      대상: UserService.java, User.java
      완료: `./gradlew test --tests "*UserApiTest.중복*"` 통과
      커밋:
- [ ] S3 409 응답 매핑
      대상: ApiExceptionHandler.java
      완료: `curl -X POST .../users` 두 번 호출 시 두 번째가 409
      커밋:
- [ ] S4 DB 유니크 제약 + 동시성 테스트
      대상: V12__user_email_unique.sql, UserConcurrencyTest.java
      완료: `./gradlew test --tests "*UserConcurrencyTest*"` 통과
      커밋:
      ⚠️ 되돌리기 주의: 마이그레이션. 기존 중복 데이터가 있으면 적용 실패한다

## 설계 판단

- 이메일을 저장 시점에 소문자 정규화 — 조회마다 함수 인덱스를 타지 않게
- 애플리케이션 검사 + DB 유니크 제약 이중 — 동시 요청은 앱 검사만으로 못 막는다

## 가정

- "대소문자 무시"는 로컬 파트에도 적용 (RFC상 구분하지만 주요 메일 서비스가 구분 안 함)
- 기존 중복 데이터 정리는 이 티켓 범위 밖 → 별도 티켓 필요

## 리스크

- S4의 유니크 제약은 기존 중복 47건 때문에 그대로 적용하면 실패한다.
  → 정리 티켓 선행 필요. 이 PR은 제약 없이 머지하고 후속에서 추가.

## 범위 밖

- 기존 중복 데이터 정리
- 이메일 인증 플로우

## 로그

- 2026-08-03 플랜 작성
```

---

## front-matter 필드

| 키 | 값 | 누가 갱신 |
|---|---|---|
| `ticket` | Jira 키 | plan (고정) |
| `title` | 티켓 제목 | plan (고정) |
| `status` | 아래 상태값 | start, pr |
| `branch` | 작업 브랜치명 | start (생성 시) |
| `base` | PR 대상 브랜치 (기본 `main`) | plan |
| `host` | `bitbucket` \| `forgejo` | plan (git remote로 감지) |
| `plan_version` | 재계획 시 증가 | plan |
| `created` / `updated` | 날짜 | 각 갱신 시 |
| `pr` | PR URL (없으면 `null`) | pr |

## 상태 전이

```
planned ──start──> in-progress ──모든 슬라이스 완료──> review
                             ↑                                 │
                             └──── 슬라이스 추가/실패 ──────────┘
                                                               │
                                                   review 통과
                                                               ↓
                                                   pr ─> pr-open ──cleanup──> done
```

- `planned` — 플랜만 있음. 브랜치 없음
- `in-progress` — 브랜치 생성됨, 슬라이스 진행 중
- `review` — 슬라이스 전부 완료, 셀프 리뷰 대기/진행
- `pr-open` — PR 생성됨 (`pr` 필드에 URL)
- `done` — 머지되고 브랜치·후속 티켓까지 정리됨 (`cleanup`)
- `blocked` — 진행 불가. **`## 로그`에 이유를 반드시 남긴다**

**상태를 건너뛰지 않는다.** `planned`에서 바로 `pr-open`이 되면 어딘가 잘못된 것이다.

## 갱신 규칙

- **슬라이스를 끝낼 때마다 즉시 파일을 갱신한다.** 마지막에 몰아서 쓰지 않는다 —
  중단되면 어디까지 했는지 사라지고, 이 플랜의 재개 가능성이 통째로 무너진다
- 체크박스 `- [ ]` → `- [x]`, `커밋:` 뒤에 해시 기록
- 요구사항 표의 상태도 `☐` → `☑`
- 계획과 실제가 달라지면 **플랜을 고친다.** 플랜을 방치하고 코드만 진행하지 않는다
- 슬라이스를 추가·삭제했으면 `## 로그`에 이유를 남긴다

## 로그 섹션

한 줄씩 append만 한다. 지우지 않는다.

```
- 2026-08-03 플랜 작성
- 2026-08-03 S1 완료 (a1b2c3d)
- 2026-08-03 S2 진행 중 — 정규화 위치를 엔티티 생성자로 변경 (서비스에 두면 Import 경로가 우회함)
- 2026-08-04 S4 보류 — 기존 중복 데이터 정리 티켓(PROJ-140) 선행 필요. status=blocked
```

이 로그가 나중에 PR 설명의 "왜 이렇게 했나"가 되고, 중단된 작업을 남이 이어받는 근거가 된다.

## config (선택) — 글로벌 + 프로젝트 레이어

설정은 세 곳에 나뉜다. `/work:setting`으로 잡는다.

| 어디 | 무엇 |
|---|---|
| 셸 env (`~/.zshrc`) | `FORGEJO_TOKEN`, `FORGEJO_URL` — 비밀. 전 프로젝트 공통 |
| 글로벌 `~/.work/config.json` | 회사 공통값: `git.host`·`git.forgejoUrl`·`git.branchPrefix`, `jira.defaultIssueType`·전이명, `pr.reviewers`·`pr.draft` |
| 프로젝트 `.work/config.json` | repo 고유값: `jira.projectKey`, `git.owner`·`git.repo`·`git.base` |

**병합 순서: 프로젝트 > 글로벌 > env > 감지 > 질문.** 두 config 파일은 같은 스키마이고,
프로젝트 값이 글로벌을 덮어쓴다. 설정을 읽을 때 글로벌을 먼저 읽고 프로젝트로 덮는다.

```bash
# 병합 (프로젝트가 글로벌을 덮어쓴다). 둘 중 하나만 있어도 동작한다.
CFG=$(jq -s '.[0] * .[1]' <(cat ~/.work/config.json 2>/dev/null || echo '{}') \
                          <(cat .work/config.json 2>/dev/null || echo '{}'))
```

전체 스키마 (어느 파일이든 이 모양의 부분집합):

```json
{
  "jira": {
    "projectKey": "PROJ",
    "defaultIssueType": "Task",
    "inProgressTransition": "In Progress",
    "inReviewTransition": "In Review"
  },
  "git": {
    "base": "main",
    "branchPrefix": "feature/",
    "host": "forgejo",
    "forgejoUrl": "https://git.example.com",
    "owner": "team",
    "repo": "service"
  },
  "pr": {
    "reviewers": ["alice", "bob"],
    "draft": false
  }
}
```

값이 감지 가능하면(owner/repo/base는 git remote에서) config에 안 써도 된다. 없으면 매번 감지·질문한다.

**토큰은 어느 파일에도 쓰지 않는다.** 환경변수(`FORGEJO_TOKEN`)로 둔다. 두 config 파일 모두 커밋될 수 있다.
