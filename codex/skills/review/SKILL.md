---
name: review
description: >
  푸시·PR·머지 직전에 내 변경을 적대적으로 훑어 문제를 잡아내는 셀프 리뷰 게이트.
  Use before pushing, opening a PR, or merging — "커밋하기 전에 봐줄래", "PR 올리기 전",
  "리뷰해줘", "다 됐는데 확인", "머지해도 될까", "final check", "배포 전 점검" —
  or right after finishing an implementation. Runs mechanical checks first, then reads
  the diff as a hostile reviewer, then verifies every line is explainable.
---

# Self Review

리뷰어가 잡는 문제의 절반은 **기계가 30초에 잡을 수 있는 것**이다.
그걸 먼저 걸러내면 리뷰어는 설계와 로직에 시간을 쓸 수 있고, 리뷰 왕복이 줄어든다.

순서를 지킨다: 기계적 검사 → 적대적 리뷰 → 설명 가능성 → 푸시.

## 1단계: 기계적 검사 (자동)

사람 눈보다 명령어가 빠르고 정확하다. 전부 돌린다.

```bash
# 변경 범위 파악 — 이것부터
git diff --stat
git diff origin/main --name-only

# 디버그 잔여물
grep -rn "console\.log\|console\.debug\|debugger;\|System\.out\.println\|printStackTrace()" \
  $(git diff origin/main --name-only --diff-filter=ACM | grep -E "\.(ts|tsx|js|jsx|java)$") 2>/dev/null

# 비활성화된 테스트 — CI를 초록색으로 만든 채 커버리지를 비운다
grep -rn "\.only(\|\.skip(\|xit(\|xdescribe(\|@Disabled\|@Ignore" \
  $(git diff origin/main --name-only --diff-filter=ACM) 2>/dev/null

# 새로 들어간 TODO
git diff origin/main | grep "^+" | grep -n "TODO\|FIXME\|XXX\|HACK"

# 자격증명·비밀값
git diff origin/main | grep "^+" | grep -niE "(api[_-]?key|password|secret|token)\s*[:=]\s*['\"][^'\"]{8,}"
git ls-files | grep -E "\.env$|\.pem$|credentials|id_rsa"

# 커밋되면 안 되는 것
git status --porcelain
git ls-files | grep -E "\.idea|\.vscode/|\.DS_Store|node_modules|/build/|/target/|\.class$"

# 빌드·타입·린트·테스트 전체
npx tsc --noEmit && npm run lint && npm test && npm run build
./gradlew clean build          # clean을 붙여야 캐시 착시를 피한다
```

### 최신 base에서 검증 (생략 금지)

```bash
git fetch origin && git rebase origin/main
npm ci && npm test            # 또는 ./gradlew clean build
```

내 브랜치에서만 통과하는 변경은 머지 후에 main을 깨뜨린다.
리베이스 후 테스트가 깨지면 그건 남의 변경과의 충돌이고, 지금 아는 게 훨씬 싸다.

## 2단계: 적대적 diff 리뷰

`git diff`를 **떨어뜨리려는 리뷰어의 눈으로** 읽는다. 내가 쓴 코드라는 애착을 버린다.

```bash
git diff origin/main            # 전체
git log --oneline origin/main..HEAD   # 커밋 이력이 읽히는가
```

아래 순서로 본다. 각 항목마다 "여기서 트집을 잡는다면?"을 스스로 묻는다.

**범위**
- diff에 이 작업과 무관한 변경이 섞여 있지 않은가 (포매팅, 이름 변경, 다른 버그 수정)
- 리팩터링과 기능 변경이 같은 커밋에 있지 않은가
- 400줄을 넘으면 쪼갤 수 있는지 다시 본다

**정확성**
- 새로 추가한 모든 분기에 대응하는 테스트가 있는가
- 빈 입력 / null / 경계값에 가드가 있는가
- 에러 경로가 실제로 의도한 응답을 내는가 (테스트로 확인했는가)
- 시그니처를 바꿨다면 호출부를 전부 고쳤는가

**영향 범위**
- 이 변경이 기존 동작을 바꾸는가 (바꾼다면 의도한 것인가, PR에 적었는가)
- 마이그레이션·설정 추가가 필요한가 (배포 순서 의존성이 있으면 PR 맨 위에 쓴다)
- 롤백 가능한가

**일관성**
- 코드베이스의 네이밍·에러 처리·로깅 방식을 따랐는가
- 내가 추가한 파일들끼리도 일관적인가

**군더더기**
- 요구사항에 없는 기능·추상화·설정을 넣지 않았는가
- 안 쓰는 import·변수·함수·파일이 남아있지 않은가
- 복사해서 만든 뒤 안 고친 이름이 없는가 (`UserServiceCopy`, `test2`, `result2`)
- 새 의존성을 추가했다면 정말 필요한가

**커밋**
- 커밋 메시지가 무엇을 왜 했는지 말하는가
- 커밋 단위가 논리적인가 (커밋별로 읽을 수 있는가)
- 실험 흔적·되돌린 커밋이 어지럽게 남아있지 않은가

전체 목록은 `references/checklist.md`. 시간이 있으면 그것으로 한 번 더 훑는다.

### UI 변경이 포함됐다면

`browser`를 돌려 실제 화면을 확인한다. diff만 읽고 통과시키지 않는다.
렌더링·콘솔 에러·실패한 요청은 코드를 읽어서 알 수 없다.

```bash
node check.mjs http://localhost:3000/<변경된 경로>
```

### 지적을 두 축으로 분류한다

찾은 것마다 **심각도**와 **자동 수정 가능 여부**를 따로 매긴다. 이 둘은 직교한다 —
Critical인데 자동 수정 가능한 것도, Minor인데 사람이 정해야 하는 것도 있다.

| 축 | 값 |
|---|---|
| 심각도 | Critical (동작이 깨짐·보안) / Major (버그 가능성·유지보수) / Minor (가독성) |
| 수정 주체 | **AUTO-FIX** (정답이 하나, 동작 불변) / **HUMAN-REQUIRED** (선택지가 여럿, 판단 필요) |

판정 원칙 세 가지. 이 순서로 적용한다.

1. **확신이 없으면 HUMAN-REQUIRED.** 잘못된 자동 수정이 방치보다 위험하다
2. **동작이 바뀌면 HUMAN-REQUIRED.** 수정 전후로 사용자가 보는 것이 달라지면 자동 금지
3. **자동 수정했다가 검증에 실패하면 HUMAN-REQUIRED로 격상.** 되돌리고 사람에게 넘긴다

AUTO-FIX 예: 안 쓰는 import 제거, `useEffect` cleanup 추가, 인덱스 key → 고유 id,
`setX(x+1)` → `setX(x => x+1)`, 오타.

HUMAN-REQUIRED 예: 에러 처리 전략(리다이렉트 vs 토스트 vs 재시도), 상태 관리 위치,
컴포넌트 분리, 데이터 흐름, **HTML 태그 변환**(`div onClick` → `button`은 기본 스타일이
달라져 레이아웃이 틀어진다 — 옳은 수정이지만 자동으로 할 수는 없다).

**확신도 80 미만은 보고하지 않는다.** 애매한 지적을 늘리면 진짜 문제가 묻힌다.

### 자동 수정 루프 (요청받았을 때만)

사용자가 "고쳐줘"라고 했을 때만 실행한다. 리뷰는 기본이 읽기 전용이다.

**한 건 고칠 때마다 즉시 검증하고, 실패하면 그 건만 되돌린다.**

```bash
# 1. 고치기 전에 원본을 백업한다 — 이게 안전장치다
cp src/foo.ts /tmp/work-fix-backup-foo.ts

# 2. 수정

# 3. 즉시 검증
npx tsc --noEmit && npx eslint src/foo.ts     # 또는 ./gradlew compileJava

# 4. 실패하면 백업에서 복원하고 HUMAN-REQUIRED로 격상
cp /tmp/work-fix-backup-foo.ts src/foo.ts
```

**`git checkout -- <파일>`로 되돌리지 않는다.** 그 파일에는 아직 커밋되지 않은 사용자의 작업이
통째로 들어있고, `git checkout`은 그것까지 전부 날린다. 반드시 사본에서 복원한다.

한 번에 한 건씩 고친다. 여러 건을 고치고 한 번에 검증하면 어느 수정이 깨뜨렸는지 알 수 없다.
같은 파일을 두 번 되돌리게 되면 멈추고 사람에게 넘긴다.

자동 수정 후에는 반드시 다시 리뷰한다 — 수정이 새 문제를 만들었을 수 있다. **재검토는 최대 2회**.
그 이상 반복되면 자동 수정으로 해결할 문제가 아니다.

## 3단계: 설명 가능성 게이트

**모든 변경 라인**에 대해 답할 수 있어야 한다. AI가 쓴 코드에 특히 엄격하게 적용한다.

1. 이 라인이 왜 필요한가
2. 지우면 무슨 일이 생기는가
3. 다른 방법이 있는데 왜 이걸 골랐나

답을 못하는 라인이 있으면 둘 중 하나를 한다: 이해하거나, 내가 이해하는 형태로 다시 쓴다.
**6개월 뒤 이 코드를 고칠 사람은 나다.**

추가로 PR 설명에 미리 답해둘 것:
- 가장 자신 없는 부분은 어디이고 왜인가 (리뷰 포인트로 지목한다)
- 이 설계의 알려진 약점은 무엇인가
- 후속으로 필요한 작업은 무엇인가

### 플랜이 있는 작업이라면

`.agents/plans/<TICKET>.md`가 있으면 리뷰 결과를 반영한다.

- 요구사항 표가 전부 ☑인지 대조한다. 코드에 없는데 ☑면 그게 첫 번째 지적 사항이다
- 리뷰에서 새로 고친 게 있으면 `## 로그`에 한 줄 남긴다
- 차단 항목이 0건이면 `status: review` 유지, PR로 넘어간다 → `/work:pr`

## 4단계: PR 확인

- 무엇을 왜 바꿨는지가 첫 문단에 있는가
- 요구사항 충족 표에 상태가 채워져 있는가
- 가정·미구현·후속 작업이 적혀 있는가
- 리뷰 포인트를 지목했는가
- 배포 주의사항(마이그레이션 순서, 설정 추가, 롤백 불가)이 맨 위에 있는가
- 이슈 링크가 걸려 있는가

## 리뷰 결과 보고

사용자에게 아래 형식으로 보고한다. 심각도 순으로 정렬한다.

```
## 셀프 리뷰
### 반드시 고칠 것 (푸시 차단)
1. <파일:라인> — <문제> → <조치>  [Critical/AUTO-FIX]

### 고치면 좋은 것
1. <파일:라인> — <문제>  [Major/HUMAN-REQUIRED]
   선택지: (a) ... (b) ...

### 확인만 (의도된 것인지)
1. ...

기계적 검사: 디버그 잔여물 0 / 비활성 테스트 0 / 자격증명 0 / 리베이스 후 빌드 통과
설명 가능성: 전 라인 통과 (또는 <파일:라인> 미통과)
diff 규모: N개 파일 / +M -K 줄
```

문제가 없으면 없다고 명확히 말한다. 억지로 지적을 만들어내지 않는다.

**결과와 무관하게 다음 단계를 항상 제시한다.** "아직 지적이 남았으니 PR 얘기는 꺼내지 말자" 같은
자체 판단을 하지 않는다 — 넘어갈지 말지는 사용자가 정한다.
그리고 사용자가 다음 단계를 고르면 **안내만 출력하고 끝내지 말고 그 자리에서 실행한다.**

## 참고 파일

- `references/checklist.md` — 전체 체크리스트 (JS/TS, Java 항목 분리)
