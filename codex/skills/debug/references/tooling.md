# 디버깅 도구 실전

제한 시간 안에서는 **로그 3줄이 디버거 세팅보다 빠르다.** 도구를 고를 때 이 기준을 먼저 적용한다.

## 우선순위

1. 실패하는 최소 테스트 (반복 실행 가능해야 한다)
2. 경계 지점 로그 (입구/출구 2곳)
3. 이분 탐색으로 로그 위치 좁히기
4. 그래도 안 보이면 디버거 / 프로파일러

## JavaScript / TypeScript

### 로그
```javascript
// 구조를 보존해서 찍는다 — 객체가 [object Object]로 뭉개지지 않게
console.log('[fn:in]', JSON.stringify({ a, b }, null, 2));
console.log('[fn:out]', JSON.stringify(result));

// 깊은 구조
console.dir(obj, { depth: null });

// 표 형태 (배열 비교에 유용)
console.table(rows);

// 호출 경로가 궁금할 때
console.trace('who called me');

// 조건부 — 특정 입력에서만
if (id === 42) console.log('[hit]', state);

// 시간 측정
console.time('loop'); /* ... */ console.timeEnd('loop');
```

### 테스트 좁혀 돌리기
```bash
npm test -- -t "테스트 이름 일부"       # jest/vitest 이름 필터
npx vitest run path/to/file.test.ts
npx vitest run --reporter=verbose       # 어떤 케이스가 도는지
npx jest --runInBand                    # 병렬 끄기 (flaky 진단)
npx jest --detectOpenHandles            # 안 닫힌 핸들 찾기
```

### 디버거
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand -t "케이스"
# chrome://inspect 에서 연결
```
VS Code라면 `JavaScript Debug Terminal`에서 그냥 `npm test`를 실행하면 브레이크포인트가 걸린다. 설정 파일이 필요 없다.

### 타입 관련
```bash
npx tsc --noEmit                  # 전체 타입 오류
npx tsc --noEmit --pretty false | head -30
```
런타임 값과 타입이 다르다는 의심이 들면 `typeof` / `Array.isArray` / `Object.keys`를 실제로 찍어 확인한다. 타입 선언은 거짓말할 수 있다.

---

## Java

### 로그
```java
// stderr로 — stdout이 테스트 결과와 섞이지 않게
System.err.println("[fn:in] a=" + a + " b=" + b);
System.err.printf("[state] id=%d, size=%d%n", id, list.size());

// 컬렉션은 그냥 찍으면 읽기 어렵다
System.err.println(list.stream().map(Object::toString).collect(java.util.stream.Collectors.joining("\n")));

// 로거가 있으면 로거를 쓴다 (커밋에 println이 남으면 리뷰에서 되돌아온다)
log.debug("processing id={} size={}", id, list.size());
```

### 테스트 좁혀 돌리기
```bash
./gradlew test --tests "*.FooTest"
./gradlew test --tests "*.FooTest.barMethod"
./gradlew test --info                 # 로그 출력 보이게
./gradlew test --rerun-tasks          # 캐시 무시
./gradlew test --tests "*FooTest*" -i 2>&1 | tail -60

mvn test -Dtest=FooTest#barMethod
mvn test -Dsurefire.useFile=false     # 콘솔로 실패 상세 출력
```

Gradle이 "up-to-date"로 테스트를 건너뛰면 로그가 안 보인다. `--rerun-tasks`를 붙인다.

### 리포트 위치
```bash
open build/reports/tests/test/index.html    # Gradle
open target/surefire-reports/               # Maven
cat build/test-results/test/*.xml | grep -A5 failure | head -40
```

### 실행 중 진단
```bash
jps -l                          # 실행 중 JVM 목록
jstack <pid> | head -60         # 스레드 덤프 — 데드락·행 진단
jmap -histo <pid> | head -20    # 힙 히스토그램 — 메모리 누수 후보
jcmd <pid> Thread.print

# 클래스의 실제 메서드 (환각 API 검증)
javap -cp build/classes/java/main com.example.Foo
javap -p -cp target/classes com.example.Foo   # private 포함
```

### 원격 디버그
```bash
./gradlew bootRun --debug-jvm      # 5005 포트 대기
./gradlew test --debug-jvm
# IDE에서 Remote JVM Debug, localhost:5005
```

### SQL 확인 (JPA 문제 진단)
```yaml
# application.yml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE   # 바인딩 파라미터까지
```
N+1 진단은 이게 가장 확실하다. 쿼리 개수를 눈으로 센다.

---

## git 기반 진단

```bash
# 언제부터 깨졌는지 자동 탐색 — 예전에 동작했다면 최우선
git bisect start HEAD <good-commit>
git bisect run ./gradlew test --tests "*.FooTest.repro"
git bisect reset

# 이 라인을 누가 언제 왜 바꿨나
git log -L 40,60:src/main/java/Foo.java
git blame -L 40,60 src/main/java/Foo.java

# 특정 함수의 변경 이력
git log -S "myFunction" --oneline

# 내가 뭘 건드렸는지 (수정 범위 확인)
git diff --stat
git stash && npm test && git stash pop    # 내 변경이 원인인지 확인
```

`git stash` 후 테스트가 통과하면 원인은 확실히 내 변경이다. 30초로 절반을 배제한다.

## 정리 (푸시 전 필수)

```bash
grep -rn "console\.log\|System\.out\.println\|System\.err\.println\|debugger;\|TODO: remove" src --exclude-dir=node_modules
grep -rn "\.only(\|\.skip(\|@Disabled\|@Ignore" src
```

디버그 잔여물은 리뷰에서 반드시 지적되고, `it.only` / `@Disabled`는 CI를 초록색으로 만든 채 커버리지를 조용히 비운다. 푸시 전에 확인한다.
