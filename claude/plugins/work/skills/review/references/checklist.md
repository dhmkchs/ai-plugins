# 푸시 전 전체 체크리스트

각 항목에 ☑ 또는 "해당 없음"을 붙인다. 빈칸을 남기지 않는다.

## A. 차단 항목 (하나라도 실패하면 푸시 불가)

- [ ] 최신 base로 리베이스한 상태에서 빌드 성공
- [ ] 테스트 전체 통과 (기준선과 비교 — 원래 깨진 것 외에 새로 깨진 것 없음)
- [ ] 자격증명·`.env`·비밀키가 커밋되지 않음
- [ ] 커밋 안 된 변경 없음 (`git status --porcelain`이 비어 있음)
- [ ] 비활성화된(skip/only/@Disabled) 테스트 없음
- [ ] 작업과 무관한 변경이 diff에 섞이지 않음

## B. 코드 위생

- [ ] `console.log` / `System.out.println` / `printStackTrace` 없음
- [ ] `debugger;` 없음
- [ ] 주석 처리된 코드 블록 없음
- [ ] 안 쓰는 import·변수·함수·파일 없음
- [ ] 복사 흔적 없음 (`test2`, `result2`, `FooCopy`, `temp`)
- [ ] 매직 넘버가 상수로 추출됨
- [ ] 포매터·린터 통과 (설정이 있으면 반드시 실행)
- [ ] 빌드 산출물(`build/`, `target/`, `dist/`, `.class`)이 커밋되지 않음
- [ ] IDE 설정(`.idea`, `.vscode`)·`.DS_Store` 커밋되지 않음

## C. 정확성

- [ ] 새 분기마다 테스트 존재
- [ ] 시그니처를 바꿨다면 호출부를 전부 고침
- [ ] 빈 입력 / null / undefined 가드
- [ ] 경계값 처리 (0, 1, 최대, 음수)
- [ ] 에러 경로가 의도한 응답·예외를 냄 (테스트로 확인)
- [ ] 요구사항 표의 모든 필수 항목이 실제 코드에 존재
- [ ] 통합 테스트 최소 1개 (전체 흐름 관통)
- [ ] 기존 동작을 바꿨다면 의도한 것이고 PR에 명시함

## D. 설계

- [ ] 기존 코드베이스 관례를 따름 (네이밍·에러·로깅·테스트 스타일)
- [ ] 요구사항에 없는 추상화·기능 없음 (과설계 없음)
- [ ] 함수가 한 화면을 넘지 않음
- [ ] 이름이 도메인 용어로 되어 있음
- [ ] 엔티티를 API 응답으로 직접 노출하지 않음 (DTO 분리)
- [ ] 3회 이상 반복되는 코드는 추출됨

## E. PR 설명

- [ ] 무엇을 왜 바꿨는지가 첫 문단에
- [ ] 이슈 링크
- [ ] 요구사항 충족 표 (상태 채워짐)
- [ ] 설계 판단과 근거 2~3개
- [ ] 명시한 가정
- [ ] 리뷰 포인트 지목 (어디를 집중해서 볼지)
- [ ] 미구현·후속 작업 (티켓 번호)
- [ ] 배포 주의사항 — 마이그레이션 순서, 설정 추가, 롤백 불가 여부

## F. 커밋 이력

- [ ] 커밋 메시지가 무엇/왜를 말함
- [ ] 커밋 단위가 논리적 (커밋별로 읽을 수 있음)
- [ ] 리팩터링 커밋과 기능 변경 커밋이 섞이지 않음
- [ ] 실험 흔적·되돌린 커밋이 정리됨
- [ ] diff 400줄 이내 (넘으면 쪼갤 수 있는지 재검토)
- [ ] 브랜치명·커밋 규칙이 팀 컨벤션대로

---

## JavaScript / TypeScript 전용

- [ ] `npx tsc --noEmit` 통과
- [ ] `any` 남용 없음 (있다면 근거 주석)
- [ ] `@ts-ignore` / `@ts-expect-error` 없음 (있다면 근거 주석)
- [ ] `==` 대신 `===`
- [ ] `async` 함수 호출에 `await` 누락 없음
- [ ] Promise `.catch` 또는 `try/catch` 존재
- [ ] 배열 mutation 부작용 없음 (`sort`/`reverse`/`splice` 전 복사)
- [ ] `useEffect` 의존성 배열 정확 + cleanup 존재
- [ ] React 리스트 `key`에 인덱스 사용 안 함
- [ ] 락파일이 커밋됨, 올바른 패키지 매니저 사용 (락파일 전체가 재작성되지 않았는지 diff 확인)
- [ ] `package.json`의 `engines` 또는 `.nvmrc` 명시

```bash
npx tsc --noEmit
grep -rn ": any\|as any\|@ts-ignore" src | head
grep -rn "\.sort(\|\.reverse(\|\.splice(" src | head
```

## Java 전용

- [ ] `./gradlew clean build` 또는 `mvn clean verify` 통과 (`clean` 필수)
- [ ] `equals`/`hashCode` 쌍으로 구현 (컬렉션 키로 쓰는 타입)
- [ ] `int` 오버플로 위험 없음 (합계·곱은 `long`)
- [ ] 금액 계산에 `double` 사용 안 함 (`BigDecimal` 또는 정수)
- [ ] `Optional`을 필드·파라미터에 쓰지 않음
- [ ] `@Transactional`이 `public` 메서드에, 내부 호출 아님
- [ ] 예외를 빈 `catch`로 삼키지 않음
- [ ] N+1 쿼리 없음 (SQL 로그로 확인)
- [ ] `java.time` 사용 (`Date`/`Calendar` 아님), 타임존 명시
- [ ] 리소스 `try-with-resources`로 닫음
- [ ] 개인정보가 로그에 평문으로 남지 않음

```bash
./gradlew clean build
grep -rn "catch (Exception e) {\s*}" --include=*.java src
grep -rn "new Date()\|Calendar.getInstance" --include=*.java src
grep -rn "double .*amount\|double .*price" --include=*.java src
grep -rn "Optional<.*> [a-z]" --include=*.java src | grep -v "return\|="
```

---

## 배포까지 가는 변경이면 추가로

- [ ] 롤백 방법이 있는가 (없으면 단계를 나눈다)
- [ ] 마이그레이션이 역방향으로 안전한가
- [ ] 배포 순서 의존성이 있으면 PR 맨 위에 명시했는가
- [ ] 새 설정·환경변수가 배포 환경에 준비돼 있는가
- [ ] 기능 플래그 뒤에 둘 수 있는가 (리스크가 크면 그게 낫다)
- [ ] 문제가 생겼을 때 확인할 로그·지표가 있는가

**"내 로컬에서는 됩니다"의 대부분은 설정과 데이터 차이다.** 배포 환경의 차이를 먼저 확인한다.
