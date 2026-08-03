# Java 심화

## 버전별 문법 가용성 (먼저 확인)

```bash
grep -E "sourceCompatibility|<java.version>|release|toolchain" pom.xml build.gradle* 2>/dev/null
java -version
```

| 기능 | 최소 버전 |
|---|---|
| `var` 지역 변수 | 10 |
| switch 표현식 (`->`, `yield`) | 14 |
| `record` | 16 |
| 텍스트 블록 (`"""`) | 15 |
| 패턴 매칭 `instanceof` | 16 |
| sealed 인터페이스 | 17 |
| switch 패턴 매칭 | 21 |
| 가상 스레드 | 21 |
| `Stream.toList()` | 16 |

**프로젝트 버전을 초과하는 문법을 쓰면 컴파일이 깨진다.** AI가 최신 문법을 제안하는 흔한 실패 모드다.

Java 8 프로젝트라면: `var` 불가, `record` 불가, `List.of` 불가(`Arrays.asList`), `Stream.toList()` 불가(`collect(Collectors.toList())`), 텍스트 블록 불가.

## equals / hashCode

```java
// record면 자동 생성 — 값 객체는 record가 정답
public record Point(int x, int y) {}

// 클래스라면 쌍으로 반드시
@Override public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Point p)) return false;      // Java 16+ 패턴 매칭
    return x == p.x && y == p.y;
}
@Override public int hashCode() { return Objects.hash(x, y); }
```

`equals`만 구현하고 `hashCode`를 빼면 `HashMap`/`HashSet`에서 **조용히** 오동작한다. 컴파일 에러도 예외도 없어서 가장 발견하기 어려운 버그다.

JPA 엔티티는 ID 기반으로 구현한다 (지연 로딩 프록시 때문에 `getClass()` 비교 대신 `instanceof`).

## 숫자

```java
// 오버플로 — Java int는 조용히 넘어간다
int  sum = a + b;                          // 위험
long sum = (long) a + b;                   // 안전
Math.addExact(a, b);                       // 넘치면 ArithmeticException — 명시적

// 스트림 합산
long total = orders.stream().mapToLong(Order::amount).sum();   // mapToInt 아님

// Integer 캐시 함정
Integer a = 1000, b = 1000;
a == b            // false! (-128..127만 캐시됨)
a.equals(b)       // true — 항상 equals

// 나눗셈
5 / 2             // 2 (정수 나눗셈)
5 / 2.0           // 2.5
Math.floorDiv(-5, 2)   // -3 (일반 나눗셈은 -2)
-5 % 2            // -1 (음수 나머지 — Math.floorMod는 1)
```

## 금액 (BigDecimal)

```java
new BigDecimal(0.1)              // 0.1000000000000000055511151231257827... 금지
BigDecimal.valueOf(0.1)          // 0.1
new BigDecimal("0.1")            // 0.1 — 문자열 생성자가 가장 안전

BigDecimal a = new BigDecimal("10.00");
BigDecimal b = new BigDecimal("10.0");
a.equals(b)          // false! (scale이 다름)
a.compareTo(b) == 0  // true — 비교는 항상 compareTo

// 나눗셈은 scale과 반올림을 반드시 지정 (안 하면 ArithmeticException)
a.divide(b, 2, RoundingMode.HALF_UP);
```

더 단순한 대안: **금액을 `long` 최소 단위(원/전)로 저장.** 반올림 정책을 한 곳으로 모을 수 있어 실무에서는 이쪽이 자주 낫다.

## 날짜 / 시간

```java
// 저장은 UTC Instant, 표시는 타임존 적용
Instant       now  = Instant.now(clock);
ZonedDateTime seoul = now.atZone(ZoneId.of("Asia/Seoul"));
LocalDate     today = LocalDate.now(clock);          // Clock 주입 필수

// 기간 계산
ChronoUnit.DAYS.between(from, to);
today.minusDays(30);
Duration.between(t1, t2).toMillis();

// 파싱·포맷
LocalDate.parse("2026-07-30");
DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.of("Asia/Seoul"));
```

`Date`, `Calendar`, `SimpleDateFormat`은 쓰지 않는다. `SimpleDateFormat`은 스레드 안전하지도 않다 (정적 필드로 공유하면 실제 버그).

## 컬렉션 선택

| 필요 | 선택 |
|---|---|
| 순서 없는 조회 | `HashMap` / `HashSet` |
| 삽입 순서 유지 | `LinkedHashMap` / `LinkedHashSet` |
| 정렬 유지 | `TreeMap` / `TreeSet` |
| 큐 | `ArrayDeque` (`Stack`, `LinkedList` 대신) |
| 우선순위 | `PriorityQueue` |
| 불변 | `List.of` / `Map.of` / `List.copyOf` |
| 동시 접근 | `ConcurrentHashMap` |

```java
// 카운팅
map.merge(key, 1L, Long::sum);
map.computeIfAbsent(key, k -> new ArrayList<>()).add(item);
map.getOrDefault(key, 0L);
```

`Stack`과 `Vector`는 레거시다. 쓰면 지적받는다.

## 스트림 심화

```java
// 그룹핑 + 집계
Map<String, Long> byUser = orders.stream()
    .collect(groupingBy(Order::userId, summingLong(Order::amount)));

// 분할
Map<Boolean, List<Order>> parts = orders.stream()
    .collect(partitioningBy(o -> o.amount() > 10_000));

// Map으로 변환 (중복 키 처리를 지정하지 않으면 IllegalStateException)
Map<String, Order> byId = orders.stream()
    .collect(toMap(Order::id, o -> o, (a, b) -> b));

// flatMap
List<Item> all = orders.stream().flatMap(o -> o.items().stream()).toList();

// 최대/최소
Optional<Order> max = orders.stream().max(comparing(Order::amount));

// 정렬 (다중 키)
orders.stream().sorted(comparing(Order::userId).thenComparing(Order::amount, reverseOrder()));
```

**쓰지 말 것**: `peek`로 부수효과, 스트림 안에서 예외 던지기, 3단계 이상 중첩. 그럴 때는 for 루프가 낫다.

## 동시성

```java
// 원자적 갱신
AtomicLong counter = new AtomicLong();
counter.incrementAndGet();

// 병렬 실행
ExecutorService pool = Executors.newFixedThreadPool(4);
try {
    List<Future<R>> futures = pool.invokeAll(tasks);
} finally {
    pool.shutdown();
}

// Java 21 가상 스레드 + 구조적 동시성
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    var f1 = executor.submit(() -> fetchA());
    var f2 = executor.submit(() -> fetchB());
    return combine(f1.get(), f2.get());
}

// CompletableFuture
CompletableFuture.supplyAsync(this::fetchA)
    .thenCombine(CompletableFuture.supplyAsync(this::fetchB), this::combine)
    .exceptionally(e -> fallback());
```

- 가시성: 여러 스레드가 공유하는 필드는 `volatile` 또는 동기화
- `ExecutorService`는 반드시 `shutdown` (try-with-resources는 Java 19+)
- 불변 객체를 공유하면 동기화가 필요 없다 — 가장 좋은 해법

## JPA / Spring Data 함정

```java
// N+1 해결
@Query("select o from Order o join fetch o.items where o.userId = :userId")
List<Order> findWithItems(@Param("userId") String userId);

@EntityGraph(attributePaths = "items")
List<Order> findByUserId(String userId);
```

| 함정 | 증상 | 대응 |
|---|---|---|
| N+1 | 쿼리가 목록 크기만큼 반복 | `join fetch`, `@EntityGraph`, `@BatchSize` |
| `LazyInitializationException` | 트랜잭션 밖에서 연관 접근 | 트랜잭션 안에서 조회, DTO 프로젝션 |
| 내부 호출 `@Transactional` | 트랜잭션이 시작되지 않음 | 다른 빈으로 분리 |
| `save` 반환값 무시 | 변경이 반영 안 됨 | 반환된 엔티티를 사용 |
| 양방향 연관 동기화 누락 | 한쪽만 반영 | 편의 메서드로 양쪽 설정 |
| `@Transactional`이 `private`에 | 동작하지 않음 | `public`으로 |
| `readOnly` 미사용 | 불필요한 더티 체킹 | 조회는 `@Transactional(readOnly = true)` |
| 엔티티 직접 반환 | 순환 참조, 민감 필드 노출 | DTO 변환 |

SQL 로그를 켜고 **쿼리 개수를 눈으로 세는 것**이 N+1을 잡는 가장 확실한 방법이다.

```yaml
spring.jpa.show-sql: true
logging.level.org.hibernate.SQL: DEBUG
logging.level.org.hibernate.orm.jdbc.bind: TRACE
```

## 리소스 / 예외

```java
// try-with-resources
try (var reader = Files.newBufferedReader(path)) {
    return reader.lines().toList();
}

// 원인 체이닝 — 스택트레이스를 잃지 않는다
try { parse(raw); }
catch (ParseException e) { throw new InvalidInputException("bad payload", e); }

// 절대 하지 말 것
catch (Exception e) { }                   // 삼킴
catch (Exception e) { e.printStackTrace(); }   // 로거를 써라
```

`InterruptedException`을 잡으면 `Thread.currentThread().interrupt()`로 플래그를 복원한다. 이걸 알면 동시성 이해도가 드러난다.

## 유용한 명령

```bash
./gradlew clean build                      # clean 필수 (캐시 착시 방지)
./gradlew test --tests "*FooTest*" -i
./gradlew dependencies --configuration compileClasspath | head -40
./gradlew bootRun --debug-jvm              # 5005 원격 디버그
javap -p -cp build/classes/java/main com.example.Foo   # 실제 메서드 확인
jstack <pid> | head -60                    # 데드락·행 진단

mvn clean verify
mvn dependency:tree | head -40
mvn test -Dtest=FooTest#method -Dsurefire.useFile=false
```
