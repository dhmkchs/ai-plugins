# 스택별 탐색·실행 명령

## JavaScript / TypeScript

### 프로젝트 정체 파악
```bash
cat package.json                       # scripts, deps, engines
ls | grep -E "pnpm-lock|yarn.lock|package-lock|bun.lockb"   # 패키지 매니저 결정
cat tsconfig.json                      # strict 여부, paths 별칭, target
ls apps packages 2>/dev/null           # 모노레포인지
cat .nvmrc 2>/dev/null                 # Node 버전
```

락파일이 결정한다: `pnpm-lock.yaml` → `pnpm`, `yarn.lock` → `yarn`, 그 외 `npm`.
잘못된 매니저로 install하면 락파일 전체가 다시 쓰이고, 그 diff가 PR에 섞여 리뷰가 불가능해진다.

### 실행
```bash
npm ci                    # 락파일 그대로 설치 (install보다 안전)
npx tsc --noEmit          # 타입 오류만 빠르게 — 가장 값싼 전체 점검
npm test
npm test -- <파일패턴>     # 좁혀서 실행
npm test -- --watch
npx vitest run --reporter=verbose
npx jest --listTests      # 어떤 테스트가 있는지만
npm run lint
npm run build
```

### 구조 파악
```bash
# 라우트/엔드포인트
grep -rnE "\.(get|post|put|delete|patch)\(['\"\`]/" src | head -30
grep -rn "export const (GET|POST|PUT|DELETE)" app src 2>/dev/null   # Next.js route handlers

# 타입 정의 = 도메인 모델
grep -rn "^export (interface|type) " src | head -40

# 상태 관리·전역
grep -rn "createContext\|createStore\|zustand\|redux\|signal(" src | head

# 외부 호출 지점
grep -rn "fetch(\|axios\.\|http\.\|prisma\.\|knex(" src | head -20

# 순환 참조·의존 그래프
npx madge --circular src 2>/dev/null

# 미사용 export
npx ts-prune 2>/dev/null | head -20
```

### 함정
- `strict: false`면 타입이 거짓말을 한다. `any`가 흐르는 경로를 의심한다.
- `==` vs `===`, `0`/`""`/`NaN`의 falsy 처리
- 배열·객체 mutation (`sort`, `reverse`, `splice`는 원본을 바꾼다)
- `async` 함수에서 `await` 누락 → 조용한 실패
- `Promise.all`의 부분 실패 (`allSettled`가 필요한 경우)
- `for...in`은 인덱스가 문자열, 프로토타입까지 순회
- `parseInt("08")`, `Number.MAX_SAFE_INTEGER` 초과
- 이벤트 핸들러의 `this` 바인딩

---

## Java

### 프로젝트 정체 파악
```bash
cat pom.xml | head -60                      # Maven
cat build.gradle build.gradle.kts 2>/dev/null | head -60   # Gradle
cat gradle/wrapper/gradle-wrapper.properties 2>/dev/null   # Gradle 버전
grep -E "sourceCompatibility|<java.version>|release" pom.xml build.gradle* 2>/dev/null  # JDK 버전
java -version; ./gradlew -version 2>/dev/null
```

### 실행
```bash
# Gradle (wrapper를 반드시 쓴다)
./gradlew build -x test        # 컴파일만
./gradlew test
./gradlew test --tests "*FooTest*"
./gradlew test --tests "*.FooTest.barMethod"
./gradlew bootRun
./gradlew dependencies --configuration compileClasspath | head -40

# Maven
mvn -q compile
mvn test
mvn test -Dtest=FooTest
mvn test -Dtest=FooTest#barMethod
mvn spring-boot:run
mvn dependency:tree | head -40
```

빌드가 느리면 `-x test`로 컴파일만 먼저 확인한다. 컴파일이 통과하면 절반은 안전하다.

### 구조 파악
```bash
# 진입점
grep -rn "public static void main" --include=*.java src | head
grep -rn "@SpringBootApplication" --include=*.java src

# 엔드포인트 = 기능 목록
grep -rnE "@(Get|Post|Put|Delete|Patch|Request)Mapping" --include=*.java src | head -30

# 레이어 구조
find src/main -type d | head -30
grep -rln "@Service\|@Component" --include=*.java src | head -20
grep -rln "@Repository\|extends JpaRepository" --include=*.java src | head -20
grep -rln "@Entity" --include=*.java src | head -20

# 설정
find . -name "application*.yml" -o -name "application*.properties" | head
cat src/main/resources/application.yml 2>/dev/null

# 트랜잭션 경계 — 버그가 자주 숨는 곳
grep -rn "@Transactional" --include=*.java src | head -20

# 클래스의 실제 메서드 확인 (환각 API 검증)
javap -cp build/classes/java/main com.example.Foo
```

### 함정
- `equals`/`hashCode` 미구현 → `HashMap`/`Set`에서 조용히 오동작
- `int` 오버플로 (합계는 `long`, 곱은 특히 위험)
- `Integer` 캐시 (`-128..127`만 `==` 우연히 동작) → 항상 `equals`
- `double`로 금액 계산 → `BigDecimal` 필수, `new BigDecimal(0.1)` 대신 `BigDecimal.valueOf(0.1)`
- 리스트 순회 중 `remove` → `ConcurrentModificationException` (`Iterator.remove` 또는 `removeIf`)
- `Arrays.asList`는 고정 크기, `List.of`는 불변 + null 금지
- `Optional`을 필드·파라미터에 쓰는 것은 안티패턴 (반환값에만)
- `@Transactional`이 같은 클래스 내부 호출에서는 동작하지 않음 (프록시)
- JPA N+1 쿼리 (`fetch join` 또는 `@EntityGraph`)
- 스트림에서 `peek`으로 부수효과 (지연 평가로 실행 안 될 수 있음)
- 날짜: `Date`/`Calendar` 대신 `java.time`, 타임존 명시

---

## 공통: 빨리 답 찾는 검색 패턴

```bash
# 사용자에게 보이는 문자열로 역추적 (가장 강력)
grep -rn "정확한 화면 문구" . --exclude-dir={node_modules,build,target,.git}

# TODO/FIXME = 알려진 미완성 지점
grep -rn "TODO\|FIXME\|XXX\|HACK" . --exclude-dir={node_modules,build,target,.git} | head -20

# 최근에 손댄 파일 (git이 있으면 가장 신뢰도 높은 신호)
git log --name-only --pretty=format: -30 | sort | uniq -c | sort -rn | head

# 특정 함수를 누가 부르는지
grep -rn "\bmyFunction\s*(" . --exclude-dir={node_modules,build,target,.git}

# 환경변수 의존성
grep -rn "process.env\.\|System.getenv\|@Value(" . --exclude-dir={node_modules,build,target} | head -20
```

`--exclude-dir`을 빼먹으면 `node_modules`/`target`에 묻혀 결과를 못 본다. 항상 붙인다.
