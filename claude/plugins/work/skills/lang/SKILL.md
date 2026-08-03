---
name: lang
description: >
  JavaScript/TypeScript와 Java의 관용구·함정·빠른 프로젝트 세팅.
  Use when writing or reviewing TypeScript/JavaScript or Java code — choosing idioms,
  handling null/errors/dates/money, structuring async code, avoiding language-specific
  pitfalls, or setting up a runnable project fast. Triggers on "이거 자바로 어떻게",
  "TS에서 관용적으로", "이 코드 자바스럽게", "프로젝트 빨리 세팅", "이게 관용적인 방식이야?",
  or any decision between language-level options.
---

# Stack Playbook

동작이 같아도 관용구를 벗어난 코드는 리뷰에서 되돌아오고, 6개월 뒤 읽는 사람을 헷갈리게 한다.
여기 있는 것만 지키면 대부분 커버된다.

## 언어 선택 (새 서비스·도구를 시작할 때)

| 작업 성격 | 권장 | 이유 |
|---|---|---|
| API·도메인 로직·트랜잭션 | Java (Spring) | 계층·트랜잭션·검증이 프레임워크로 표준화돼 있어 팀 간 인수인계가 쉽다 |
| 프런트엔드·풀스택·CLI | TypeScript | 세팅이 빠르고 반복 주기가 짧다 |
| 데이터 변환·스크립트 | TypeScript | 표준 라이브러리로 충분, 코드량이 적다 |

**팀이 이미 쓰는 스택을 고른다.** 새 스택은 운영·모니터링·온보딩 비용까지 따라온다. 기술적 이점이 그 비용을 명확히 넘을 때만 도입한다.

---

## TypeScript 필수 관용구

### 타입은 좁게, `any`는 금지

```typescript
// 나쁨 — 타입이 아무것도 보장하지 않는다
function process(data: any) { return data.items.map((i: any) => i.id); }

// 좋음 — 계약이 드러난다
type Item = { id: string; qty: number };
function process(data: { items: Item[] }): string[] {
  return data.items.map(i => i.id);
}
```

외부 입력은 `unknown`으로 받고 파싱해서 좁힌다. `any`는 검사를 끄는 것이고, `unknown`은 검사를 강제한다.

```typescript
// 런타임 검증 — 외부 경계에서 한 번만
function parseItem(raw: unknown): Item {
  if (typeof raw !== 'object' || raw === null) throw new Error('invalid item');
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string') throw new Error('id must be string');
  if (typeof o.qty !== 'number' || !Number.isInteger(o.qty)) throw new Error('qty must be int');
  return { id: o.id, qty: o.qty };
}
```
zod가 이미 프로젝트에 있으면 zod를 쓴다. 없으면 위처럼 손으로 쓰고, "외부 경계에서만 검증한다"고 설명한다.

### 판별 유니온으로 상태를 표현

```typescript
// 나쁨 — 불가능한 조합이 타입으로 허용된다 (loading이면서 error인 상태)
type State = { loading: boolean; data?: Item[]; error?: string };

// 좋음 — 불가능한 상태가 표현 불가능하다
type State =
  | { status: 'loading' }
  | { status: 'success'; data: Item[] }
  | { status: 'error'; message: string };
```

로딩과 에러가 동시에 참인 상태 같은 버그가 타입 레벨에서 사라진다. 프런트엔드 상태 관리에서 특히 효과가 크다.

### 불변으로 다루기

```typescript
// mutate하는 메서드들 — 원본을 바꾼다
[...arr].sort((a, b) => a - b);   // sort 전에 복사
[...arr].reverse();
arr.toSorted?.((a, b) => a - b);  // Node 20+ 이면 이게 더 명확

// 추가·갱신
const next = [...items, newItem];
const updated = items.map(i => i.id === id ? { ...i, qty: 0 } : i);
```

`sort()`가 원본을 바꾸는 것은 React에서 "화면이 갱신 안 됨" 버그의 최대 원인이다.

### 비동기

```typescript
// 순차 실행 — 루프 안 await는 느리다
for (const id of ids) await fetchOne(id);

// 병렬 — 독립적이면 이쪽
const results = await Promise.all(ids.map(fetchOne));

// 부분 실패를 허용해야 하면
const settled = await Promise.allSettled(ids.map(fetchOne));
const ok = settled.filter(r => r.status === 'fulfilled').map(r => r.value);

// 동시 실행 수 제한이 필요할 때 (외부 API 보호)
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return out;
}
```

`Promise.all`은 하나 실패하면 전체가 reject된다는 점을 알고 선택했음을 말할 수 있어야 한다.

### 에러

```typescript
// 도메인 에러를 타입으로 구분한다
class DuplicateEmailError extends Error {
  readonly code = 'DUPLICATE_EMAIL';
  constructor(email: string) {
    super(`email already exists: ${email}`);
    this.name = 'DuplicateEmailError';
  }
}

// catch의 err는 unknown이다 — 좁혀서 쓴다
try { /* ... */ } catch (err) {
  if (err instanceof DuplicateEmailError) return res.status(409).json({ code: err.code });
  throw err;   // 모르는 에러는 삼키지 않고 올린다
}
```

빈 `catch {}`는 버그를 숨긴다. 삼켜야 한다면 이유를 주석으로 남긴다.

### 숫자·날짜·금액

```typescript
Number.isInteger(x)                    // typeof x === 'number' 만으로는 부족
Number.isSafeInteger(x)                // 2^53 초과 검사
const cents = Math.round(won * 100);   // 금액은 정수로. 0.1+0.2 !== 0.3
BigInt(x)                              // 큰 정수

// 날짜는 UTC로 저장하고 표시할 때만 로컬로
new Date().toISOString();
new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul' }).format(d);
```

`new Date("2026-01-01")`은 UTC, `new Date("2026/01/01")`은 로컬로 파싱된다. 이 차이가 하루 밀림 버그를 만든다.

### 빠른 세팅
```bash
npm create vite@latest app -- --template react-ts   # 프런트
npm init -y && npm i -D typescript tsx vitest @types/node && npx tsc --init
npx tsc --init --strict                              # strict를 켠다
npm i -D vitest && npx vitest run
```
`tsconfig.json`에 `"strict": true`를 확인한다. 꺼져 있으면 켠다 — 켜져 있는 게 기본 기대치다.

---

## Java 필수 관용구

### 불변 + 생성자 검증

```java
public record Money(long cents, Currency currency) {
    public Money {                                  // compact constructor
        if (cents < 0) throw new IllegalArgumentException("cents must be >= 0");
        Objects.requireNonNull(currency, "currency");
    }
    public Money plus(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalArgumentException("currency mismatch");
        return new Money(cents + other.cents, currency);
    }
}
```

`record`는 `equals`/`hashCode`/`toString`을 자동 생성한다. DTO·값 객체는 `record`가 기본이다.
생성자에서 불변식을 검증하면 유효하지 않은 객체가 존재할 수 없다 — 설계 점수를 받는 지점이다.

### null 처리

```java
// 반환값에만 Optional. 필드·파라미터에는 쓰지 않는다
Optional<User> findByEmail(String email);

// get() 대신
user.map(User::name).orElseThrow(() -> new UserNotFoundException(email));
user.orElseGet(() -> createDefault());     // orElse는 항상 평가된다, orElseGet은 지연
user.ifPresentOrElse(this::send, this::log);

// 파라미터 검증
Objects.requireNonNull(email, "email");
```

`Optional.get()`을 그냥 부르면 `NoSuchElementException`이 나고, 리뷰에서 반드시 지적된다.

### 컬렉션

```java
// 불변 반환 — 캡슐화가 깨지지 않게
public List<Item> items() { return List.copyOf(items); }

// 순회 중 삭제
items.removeIf(i -> i.qty() == 0);          // ConcurrentModificationException 회피

// 그룹핑·집계
Map<String, List<Order>> byUser = orders.stream()
    .collect(Collectors.groupingBy(Order::userId));

Map<String, Long> totals = orders.stream()
    .collect(Collectors.groupingBy(Order::userId,
             Collectors.summingLong(Order::amount)));   // long으로 합산 (오버플로 회피)

// 순서 보장이 필요하면
new LinkedHashMap<>();  new TreeMap<>();
```

`Arrays.asList`는 고정 크기, `List.of`는 불변 + null 금지다. `add`가 필요하면 `new ArrayList<>(List.of(...))`.

### 스트림 — 쓸 곳과 안 쓸 곳

```java
// 좋음: 변환·필터·집계
var names = users.stream().filter(User::active).map(User::name).toList();

// 나쁨: 부수효과, 복잡한 분기, 인덱스 필요
// → 그냥 for 루프가 읽기 쉽다. 스트림 남용은 가독성만 해친다.
```

`peek`으로 부수효과를 내지 않는다 (지연 평가로 실행되지 않을 수 있다).

### 에러

```java
public class DuplicateEmailException extends RuntimeException {
    private final String email;
    public DuplicateEmailException(String email) {
        super("email already exists: " + email);
        this.email = email;
    }
    public String email() { return email; }
}

// Spring: 예외 → 응답 매핑을 한 곳에 모은다
@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(DuplicateEmailException.class)
    ResponseEntity<ErrorResponse> onDuplicate(DuplicateEmailException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("DUPLICATE_EMAIL", e.getMessage()));
    }
}
```

빈 `catch (Exception e) {}`는 최악이다. 최소한 로깅하고, 원인 예외를 체이닝한다: `throw new XException(msg, e)`.

### 날짜·금액

```java
// java.time만 쓴다. Date/Calendar는 쓰지 않는다
LocalDate    d  = LocalDate.now(clock);        // Clock 주입 — 테스트 가능
Instant      t  = Instant.now(clock);          // 저장은 Instant(UTC)
ZonedDateTime z = t.atZone(ZoneId.of("Asia/Seoul"));   // 표시할 때만 타임존

// 금액
BigDecimal amount = BigDecimal.valueOf(0.1);   // new BigDecimal(0.1) 금지 — 부정확
amount.setScale(2, RoundingMode.HALF_UP);
amount.compareTo(other) == 0                   // equals는 scale까지 비교한다
```

`Clock`을 주입하면 "최근 N일" 같은 로직을 시간 고정 테스트로 검증할 수 있다. 직접 `now()`를 부르는 코드는 테스트할 방법이 없다.

### Spring 계층 관례

```java
@RestController
@RequiredArgsConstructor          // Lombok이 있으면. 없으면 생성자 직접 작성
class UserController {
    private final UserService userService;      // 필드 주입(@Autowired) 대신 생성자 주입

    @PostMapping("/users")
    ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest req) {
        var user = userService.register(req.email(), req.name());
        return ResponseEntity.created(URI.create("/users/" + user.id()))
                             .body(UserResponse.from(user));
    }
}
```

- 생성자 주입 (`final` 필드) — 필드 주입은 테스트가 어렵고 관례 위반이다
- `@Valid`로 DTO 검증, 도메인 규칙은 서비스에서
- 엔티티를 직접 반환하지 않고 응답 DTO로 변환
- `@Transactional`은 서비스의 `public` 메서드에 (같은 클래스 내부 호출은 프록시를 우회해 동작하지 않는다)
- 조회 전용은 `@Transactional(readOnly = true)`

### 빠른 세팅
```bash
# Spring 프로젝트 생성
curl -s https://start.spring.io/starter.zip \
  -d dependencies=web,validation,data-jpa,h2 \
  -d type=gradle-project -d language=java \
  -d javaVersion=21 -d bootVersion=3.3.0 \
  -d groupId=com.example -d artifactId=demo -o demo.zip && unzip demo.zip -d demo

cd demo && ./gradlew build
```
`validation`을 빼먹으면 `@Valid`가 조용히 동작하지 않는다. 반드시 포함한다.

---

## 두 언어 공통 원칙

1. **경계에서 검증, 내부에서는 신뢰.** 검증을 곳곳에 흩뿌리면 어디가 진실인지 모른다.
2. **불변을 기본으로.** 변경이 필요한 지점만 명시적으로 둔다.
3. **의존성은 주입한다.** `new`로 직접 만들면 테스트할 수 없다. `Clock`, 랜덤, 외부 클라이언트가 특히 그렇다.
4. **에러는 타입으로 구분한다.** 문자열 비교로 에러를 분기하지 않는다.
5. **하나의 함수는 하나의 추상화 수준.** HTTP 파싱과 도메인 계산이 같은 함수에 있으면 쪼갠다.
6. **관례 > 취향.** 코드베이스가 이미 정한 방식을 따른다.

## 참고 파일

- `references/typescript.md` — 타입 레벨 패턴, 설정, 자주 쓰는 유틸리티 타입
- `references/java.md` — 동시성, JPA, 스트림 심화, 버전별 문법 가용성
