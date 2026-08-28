---
name: explore
description: >
  낯선 코드베이스나 처음 보는 모듈을 빠르게 파악해서 수정 지점을 찾아내는 절차.
  Use when the user must understand unfamiliar code before changing it — joining a new
  repo, picking up someone else's module, "이 코드베이스 파악", "이 레포 구조",
  "어디를 고쳐야 하나", "이거 어떻게 동작하는지", "온보딩", "인수인계 받았어",
  right after cloning a project, or before implementing a ticket in code they haven't
  touched. Includes JavaScript/TypeScript and Java specific exploration commands.
---

# Codebase Recon

목표는 코드베이스를 **전부 이해하는 것이 아니다.** 수정할 지점과 그 지점의 계약을 찾는 것이다.
전체를 읽으려 들면 하루가 간다. 아래 순서를 지킨다.

## 0. 절대 규칙

- **넓게 스캔하고, 좁게 읽는다.** 처음에는 파일을 열지 말고 목록·이름·설정만 본다.
- **실행 가능 상태를 먼저 만든다.** 빌드·테스트가 도는지 확인하기 전에 코드를 읽지 않는다. 실행되지 않는 코드베이스에 대한 추론은 대부분 틀린다.
- **테스트가 최고의 문서다.** README보다 테스트 파일이 정확하다. README는 낡고 테스트는 CI가 강제한다.

## 1. 지형 파악

```bash
# 프로젝트 정체 확인
ls -la
cat README.md 2>/dev/null | head -40
cat package.json 2>/dev/null | head -40 || cat pom.xml 2>/dev/null | head -40 || cat build.gradle* 2>/dev/null

# 규모와 언어 분포
git ls-files | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -15

# 가장 큰 파일 = 대개 핵심 로직 또는 신 클래스
git ls-files | xargs wc -l 2>/dev/null | sort -rn | head -20

# 최근 변경 = 지금 살아있는 부분
git log --oneline -20
git log --name-only --pretty=format: -50 | sort | uniq -c | sort -rn | head -15
```

마지막 명령의 결과가 **작업이 실제로 일어나는 파일**이다. 여기가 대체로 수정 지점이고,
반대로 오랫동안 아무도 손대지 않은 파일은 건드릴 때 더 조심해야 한다 (테스트가 없을 확률이 높다).

**여러 파일이 매번 함께 바뀐다면** 하나의 개념이 여러 곳에 흩어져 있다는 신호다.
지금 작업과 무관하면 메모만 하고 지나가고, 그게 이번 마찰의 원인이면 `refactor`로 넘긴다.

## 2. 실행 경로 확보

빌드·테스트 명령을 찾아 실제로 돌린다. 스택별 명령은 `references/stack-commands.md`.

```bash
# 스크립트/태스크 목록
cat package.json | python3 -c "import json,sys;print(json.load(sys.stdin).get('scripts',{}))"
./gradlew tasks --all 2>/dev/null | head -30
```

**테스트를 먼저 돌린다.** 이유:
- 통과하면 이후 내 변경이 뭘 깨뜨렸는지 알 수 있는 **기준선**이 생긴다
- 원래 깨져 있으면 그 사실을 지금 아는 게 낫다 (나중에 내 탓이 된다)
- 테스트 이름 목록만으로 기능 명세를 읽을 수 있다

```bash
# 테스트 이름만 뽑아보기 = 사실상 요구사항 명세
grep -rhoE "(it|test|describe)\(['\"\`][^'\"\`]+" --include=*.test.* --include=*.spec.* . | head -40
grep -rhoE "void [a-zA-Z0-9_]+\(\)" --include=*Test.java . | head -40
```

기준선을 메모해둔다: `테스트 142 passed / 3 failed (기존 실패)`.

## 3. 진입점 → 데이터 흐름

진입점을 찾고, 거기서 한 요청/한 호출이 지나가는 길만 따라간다.

```bash
# 진입점 후보
grep -rn "public static void main" --include=*.java . | head
grep -rn "@SpringBootApplication\|@RestController\|@Controller" --include=*.java . | head -20
grep -rn "createServer\|app.listen\|export default\|createRoot" --include=*.ts --include=*.tsx --include=*.js . | head -20

# 라우트/엔드포인트 목록 = 기능 목록
grep -rnE "@(Get|Post|Put|Delete|Request)Mapping" --include=*.java . | head -30
grep -rnE "\.(get|post|put|delete|patch)\(['\"\`]/" --include=*.ts --include=*.js . | head -30
```

그다음 **한 줄기만** 추적한다: 진입점 → 서비스/핸들러 → 데이터 접근 → 응답.
갈라지는 가지는 무시한다. 한 줄기를 끝까지 보면 나머지는 같은 패턴이다.

## 4. 수정 지점 국소화

작업이 지목한 기능의 이름·에러 메시지·화면 문구를 그대로 검색한다. 이게 가장 빠르다.

```bash
# 사용자에게 보이는 문자열로 역추적 — 가장 신뢰도 높은 방법
grep -rn "화면에 보이는 문구\|error message text" --include=* .

# 심볼 정의 위치
grep -rn "class Foo\|interface Foo\|function foo\|const foo =" .

# 호출부 (영향 범위)
grep -rn "\bfoo(" . | grep -v "function foo"
```

수정 지점을 찾으면 그 함수의 **계약**을 3줄로 적는다: 입력 / 출력 / 부수효과.
그리고 **호출부를 모두 센다.** 호출부 수가 곧 리스크다. 5곳 이상이면 시그니처를 바꾸지 않는 방향을 먼저 찾는다.

이 지점의 이력도 30초만 본다. 왜 이렇게 되어 있는지 대개 여기에 답이 있다.
```bash
git log -L 40,80:src/service/Foo.java     # 해당 라인 범위의 변경 이력
git blame -L 40,80 src/service/Foo.java
```

## 5. 관례 파악

**내 스타일이 아니라 그 코드베이스의 스타일로 쓴다.** 이걸 어기면 리뷰가 길어진다.

- 에러 처리: 예외를 던지나, Result 객체를 반환하나, null을 쓰나
- 로깅: 어떤 로거, 어떤 레벨, 어떤 포맷
- 테스트: 어떤 프레임워크, 픽스처 방식, 모킹 방식
- 네이밍: `getUser` vs `fetchUser` vs `findUser` — 다수를 따른다
- 비동기: Promise/async, CompletableFuture, 콜백 중 무엇

가장 최근에 머지된, 내 작업과 비슷한 변경을 찾아 **그 diff를 템플릿으로 쓰는 것**이 가장 안전하다.
```bash
git log --oneline -20 -- src/service/    # 이 영역의 최근 변경
git show <commit>                        # 어떤 스타일로 쓰는지 확인
```

## 6. 산출물: 정찰 노트

아래 형식으로 정리한다. 작업 시작 전 팀에 공유하면 "그 부분은 X라서 조심해야 해" 같은 정보가 돌아온다.

```
## 정찰 노트
- 스택: <언어/프레임워크/빌드도구>
- 실행: build=`...` test=`...` run=`...`
- 테스트 기준선: N passed / M failed (기존 실패 목록)
- 진입점: <파일:라인>
- 데이터 흐름: A → B → C → D
- 수정 지점: <파일:라인> — 계약: 입력 X, 출력 Y, 부수효과 Z
- 호출부: N곳 (<파일 목록>)
- 관례: 에러=<...> 로깅=<...> 테스트=<...>
- 미해결 질문: <2~3개>
- 리스크: <이 변경이 깨뜨릴 수 있는 것>
```

"미해결 질문"을 비워두지 않는다. 모르는 것을 명시하는 것이 정찰의 품질 지표이고,
그 목록이 팀에 물어볼 질문이 된다.

## 읽기 예산

**파일 5개 / 총 400줄**을 넘겨 읽고 있으면 멈춘다.
그건 길을 잃은 신호다. 4단계로 돌아가 문자열 검색으로 다시 좁힌다.

## 흔한 실수

| 실수 | 결과 |
|---|---|
| 파일을 위에서부터 순서대로 읽기 | 시간만 쓰고 맥락은 안 생김 |
| 테스트 안 돌리고 수정 시작 | 내가 깨뜨린 건지 원래 깨진 건지 모름 |
| 전체 아키텍처 다이어그램 그리기 | 지금 작업과 무관한 곳에 시간 소모 |
| 코드베이스 관례 무시하고 내 스타일로 | 리뷰 왕복이 늘어남 |
| 호출부 확인 없이 시그니처 변경 | 컴파일 에러 폭발 또는 조용한 회귀 |
| 오래된 파일을 최신 관례로 착각 | 이미 폐기된 패턴을 복사 |

## 참고 파일

- `references/stack-commands.md` — JS/TS·Java 프로젝트 탐색·빌드·테스트 명령 모음
- `references/reading-order.md` — 아키텍처 유형별(레이어드, MVC, 모노레포) 읽는 순서
