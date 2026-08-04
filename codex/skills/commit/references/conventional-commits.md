# Conventional Commits 실전

## 형식

```
<type>[optional scope][!]: <subject>

[optional body]

[optional footer(s)]
```

`!` 또는 `BREAKING CHANGE:` footer는 major 버전 상승을 의미한다 (`release`의 semver와 연동).

## 타입별 예시

```
feat(auth): add refresh token rotation
fix(order): prevent double charge on retry
refactor(user): extract validation into value object
perf(list): batch N+1 queries with DataLoader
test(payment): cover timeout and partial-failure paths
docs(api): document pagination cursor contract
build(deps): bump prisma to 5.9
ci: run e2e on PR to main
chore(release): v1.4.0
```

## 파괴적 변경

```
feat(api)!: remove deprecated /v1/login

BREAKING CHANGE: /v1/login 제거됨. 클라이언트는 /v2/auth/login 으로 이전할 것.
구 엔드포인트는 2026-06-01 까지 410 을 반환한다.
```

## 커밋 분할 — git add -p 실전

한 작업 디렉터리에 두 관심사가 섞였을 때:

```bash
git add -p           # 헝크마다 y/n/s(split)/e(edit)
#   버그 수정 헝크만 y → 나머지 n
git commit -m "fix(cart): clamp quantity to stock on add"
git add -p           # 이제 리팩터 헝크만 y
git commit -m "refactor(cart): extract stock check into service"
```

- `s`: 헝크를 더 잘게 쪼갠다
- `e`: 헝크를 직접 편집(부분 라인만 스테이징)
- 파일 전체가 한 관심사면 `git add <file>`

## subject 다시 쓰기 체크

| 나쁨 | 왜 | 좋음 |
|---|---|---|
| `Added login` | 과거형, 대문자 | `feat(auth): add login` |
| `fix bug.` | 무엇인지 모름, 마침표 | `fix(auth): reject expired token` |
| `updates` | 정보 0 | `refactor(auth): rename token util` |
| `feat: add login and fix logout and update styles` | 3개 관심사 | 커밋 3개로 분할 |

## body를 쓸 때 / 안 쓸 때

- **쓴다**: 왜가 자명하지 않을 때, 트레이드오프가 있을 때, 다른 접근을 버린 이유가 있을 때
- **안 쓴다**: 오타·포맷·자명한 소변경. subject로 충분하면 억지 body를 만들지 않는다

## 티켓 연결

```
fix(order): prevent double charge on retry

Refs: PROJ-123
```

`start`가 브랜치명(`feature/PROJ-123-...`)에서 키를 알고 있으면 footer에 자동으로 넣는다.
Bitbucket은 커밋 메시지의 Jira 키로 자동 연결한다.
