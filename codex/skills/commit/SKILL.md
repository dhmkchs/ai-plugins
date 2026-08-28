---
name: commit
description: >
  변경을 원자적 커밋으로 쪼개고, 커밋 전 잔여물·시크릿을 걸러내고, Conventional Commits 형식으로
  "무엇이 아니라 왜"를 남긴다.
  Use when committing changes — staging a diff, writing a commit message, splitting a large change
  into commits — or the user says "커밋해줘", "커밋 메시지 써줘", "이거 커밋", "커밋 나눠줘",
  "conventional commit", "스테이징 정리". `start`가 슬라이스마다 이 규율로 커밋한다. 대상: 모든 스택.
---

# Commit

**커밋은 히스토리에 영구히 남는다.** 나중에 `git blame`·`bisect`·리뷰가 이걸 읽는다.
좋은 커밋은 (1) 하나의 논리 변경만 담고 (2) 왜 그렇게 했는지를 남긴다. 이 둘이 없으면
히스토리가 "여러 개 수정" 무더기가 되어 되돌리기도 추적도 안 된다.

## 1. 원자적 커밋 — 한 논리 변경 = 한 커밋

여러 관심사를 한 커밋에 섞지 않는다. 버그 수정과 리팩터를 같이 커밋하면, 나중에 버그 수정만
되돌릴 수 없고 리뷰어가 무엇이 무엇인지 못 가른다.

```bash
git add -p          # 헝크 단위로 골라 담는다. git add . 로 뭉치지 않는다
git diff --staged   # 커밋 직전 스테이징된 것만 다시 본다
```

- 무관한 변경이 섞였으면 → 나눠서 각각 커밋
- "그리고"로 이어지는 커밋 메시지가 나오면 → 커밋을 쪼개야 한다는 신호
- 포맷팅·정리는 로직 변경과 분리 (리뷰 노이즈)

## 2. 커밋 전 검사 — 들어가면 안 되는 것

스테이징된 diff를 커밋 전에 훑는다. `review`의 축소판이다.

```bash
git diff --staged
```

- 디버그 잔여물: `console.log`, `System.out.println`, `debugger`, 주석 처리한 코드
- 시크릿: 토큰·비밀번호·`.env`·키 파일 (한 번 커밋되면 히스토리에 영원히 남는다)
- 관계없는 파일: 에디터 설정, 빌드 산출물, `.DS_Store`
- 비활성 테스트: `.skip`, `.only`, 주석 처리한 테스트

시크릿이 이미 스테이징됐으면 커밋 전에 빼고, **이미 커밋했으면 히스토리 재작성 + 키 폐기**가 필요하다(단순 삭제 커밋으로는 안 지워짐).

## 3. 메시지 형식 — Conventional Commits

```
<type>(<scope>): <subject>

<body — 왜 이 변경이 필요한가>

<footer — BREAKING CHANGE / 티켓 참조>
```

**타입:**

| type | 언제 |
|---|---|
| `feat` | 사용자 관점 새 기능 |
| `fix` | 버그 수정 |
| `refactor` | 동작 불변, 구조 개선 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가·수정 |
| `docs` | 문서만 |
| `build` / `ci` | 빌드·의존성 / CI 설정 |
| `chore` | 그 외 잡무 (릴리즈·설정) |

**규칙:**
- subject: 명령형 현재시제, 소문자 시작, 마침표 없음, **50자 이내** — "add" not "added"/"adds"
- scope: 영향 범위 (선택) — `feat(auth):`
- body: **72자에서 줄바꿈**, 무엇(What)이 아니라 **왜(Why)**를 쓴다 (What은 diff가 이미 보여줌)
- 파괴적 변경: footer에 `BREAKING CHANGE: <설명>` 또는 타입 뒤 `!` — `feat!:`

## 4. 무엇이 아니라 왜

diff는 "무엇을 바꿨나"를 이미 보여준다. 커밋 메시지는 diff가 답 못 하는 **"왜"**를 남긴다.

```
나쁨:  fix: update timeout value
       (무엇을 — diff에 이미 보임. 왜 바꿨는지 없음)

좋음:  fix(api): raise upstream timeout to 30s

       결제 프로바이더가 피크 시간대에 15s를 종종 초과해
       주문이 유령 실패로 남았다. 그쪽 p99(24s)에 여유를 둬 30s로.
```

"왜"가 자명한 사소한 변경(오타·포맷)은 body 없이 subject만으로 충분하다. **body를 위한 body를 쓰지 않는다.**

### 금지 subject — 이 문자열이 나오면 다시 쓴다

```
update            수정              minor fixes
fix bug           버그 수정          misc / 기타
wip               개선              apply feedback
change            코드 정리          address review comments
```

공통 증상은 하나다 — **목적어가 없다.** 무엇을 update 했는지, 어떤 bug 인지가 빠져 있다.
목적어를 넣으면 대개 자동으로 고쳐진다: `fix bug` → `fix(auth): reject expired refresh token`.

`apply feedback` / `address review comments`는 특히 나쁘다. 6개월 뒤 그 리뷰 코멘트를
아무도 찾지 못한다. 리뷰 때문에 **무엇이 바뀌었는지**를 쓴다.

## 5. 스테이징 리뷰 → 커밋

커밋 메시지를 만들면 **스테이징 요약 + 메시지를 보여주고** 커밋한다.

```bash
git status --short          # 무엇이 스테이징됐나
git commit -m "..." -m "..."   # 또는 에디터로 본문 작성
```

- 커밋 후 `git show --stat HEAD`로 의도한 것만 들어갔는지 확인
- 방금 커밋을 고치려면 `git commit --amend` (아직 push 전일 때만)

## work 사슬 연결

- `start`가 슬라이스를 끝낼 때마다 이 규율로 커밋한다 — 슬라이스 하나 = 커밋 하나.
- 커밋 전 검사(§2)는 `review`의 축소판. 셀프 리뷰에서 다시 전체를 훑는다.
- 커밋 이력은 `pr` 본문의 `## 커밋` 절과 `release`의 changelog 소스가 된다 — 그래서 형식이 중요하다.

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| `git add .` 로 전부 뭉치기 | 무관한 변경이 섞여 되돌리기·리뷰 불가 |
| 한 커밋에 여러 관심사 | 부분 되돌리기 불가, blame이 무의미 |
| "update", "fix bug", "wip" | 왜가 없어 히스토리가 쓸모없음 |
| 시크릿 커밋 | 히스토리에 영원히 — 키 폐기까지 필요 |
| 디버그 잔여물 포함 | 리뷰가 거기서 멈추고 프로덕션 로그 오염 |
| body에 What만 반복 | diff가 이미 보여줌 — Why를 써라 |
| push 후 amend/rebase | 남의 히스토리를 깨뜨림 |

## 참고 파일

- `references/conventional-commits.md` — 타입·스코프·파괴적 변경 표기, 커밋 분할 실전 예시
