# 테스트 전략

## 원칙

- **요구사항 1개 = 테스트 최소 1개.** 커버리지 숫자가 아니라 요구사항 표를 채운다.
- 테스트 이름은 요구사항 문장으로. 목록만 읽어도 명세가 되게 한다.
- 실패 메시지가 원인을 말해야 한다. `expect(true).toBe(true)` 같은 테스트는 없는 게 낫다.
- **테스트당 단정 하나의 개념.** 여러 개를 묶으면 첫 실패에서 멈춰 나머지를 못 본다.
- 시간·랜덤·네트워크는 주입하거나 모킹한다. 이게 flaky의 원인 전부다.

## 구조: Given–When–Then

```typescript
it('중복된 이메일이면 409를 반환한다', async () => {
  // given
  await repo.save({ email: 'a@b.com' });

  // when
  const res = await request(app).post('/users').send({ email: 'a@b.com' });

  // then
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('DUPLICATE_EMAIL');
});
```

주석 3개를 실제로 쓴다. 리뷰어가 테스트를 읽는 속도가 달라지고, 실패했을 때 어느 단계가 문제인지 바로 보인다.

---

## JavaScript / TypeScript

### 단위 테스트 (Vitest / Jest)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('calculateDiscount', () => {
  it.each([
    [0, 0],
    [1000, 0],
    [10000, 500],
    [100000, 10000],
  ])('금액 %i원이면 할인은 %i원이다', (amount, expected) => {
    expect(calculateDiscount(amount)).toBe(expected);
  });

  it('음수 금액이면 예외를 던진다', () => {
    expect(() => calculateDiscount(-1)).toThrow(/negative/i);
  });
});
```

`it.each`로 경계값을 한 번에 처리한다. 테이블 테스트는 "경계값을 체계적으로 검토했다"는 증거다.

### 시간 고정
```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});
afterEach(() => vi.useRealTimers());
```

### 모킹 — 최소한으로
```typescript
// 외부 경계만 모킹한다. 내부 로직을 모킹하면 테스트가 구현에 묶인다.
const mailer = { send: vi.fn().mockResolvedValue(undefined) };
const svc = new UserService(repo, mailer);   // 생성자 주입이 테스트를 쉽게 한다

expect(mailer.send).toHaveBeenCalledWith(
  expect.objectContaining({ to: 'a@b.com' })
);
```

모킹이 많이 필요하면 설계가 결합돼 있다는 신호다. 테스트가 어려우면 설계를 의심한다.

### API 통합 테스트 (Supertest)
```typescript
import request from 'supertest';

it('생성 후 조회하면 같은 값이 반환된다', async () => {
  const created = await request(app).post('/users').send({ email: 'a@b.com' }).expect(201);
  const found = await request(app).get(`/users/${created.body.id}`).expect(200);
  expect(found.body.email).toBe('a@b.com');
});
```

통합 테스트 1개는 단위 테스트 10개보다 "실제로 동작한다"는 증거로 강하다. 반드시 하나는 넣는다.

### React 컴포넌트 (Testing Library)
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('빈 폼으로 제출하면 검증 에러가 표시된다', async () => {
  render(<SignupForm />);
  await userEvent.click(screen.getByRole('button', { name: '가입' }));
  expect(await screen.findByText(/이메일을 입력/)).toBeInTheDocument();
});
```

`getByRole` / `getByLabelText`를 쓴다. `getByTestId`는 최후 수단 — 접근성 인식을 함께 보여줄 수 있다.

### 실행
```bash
npx vitest run                     # CI 모드
npx vitest --coverage
npm test -- -t "중복된 이메일"
```

---

## Java

### 단위 테스트 (JUnit 5)

```java
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.assertj.core.api.Assertions.*;

class DiscountCalculatorTest {

    private DiscountCalculator sut;

    @BeforeEach
    void setUp() {
        sut = new DiscountCalculator();
    }

    @ParameterizedTest(name = "{0}원이면 할인 {1}원")
    @CsvSource({ "0,0", "1000,0", "10000,500", "100000,10000" })
    void 금액별_할인액을_계산한다(long amount, long expected) {
        assertThat(sut.calculate(amount)).isEqualTo(expected);
    }

    @Test
    void 음수_금액이면_예외를_던진다() {
        assertThatThrownBy(() -> sut.calculate(-1))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("negative");
    }

    @Nested
    @DisplayName("등급 할인")
    class TierDiscount {
        @Test void VIP는_추가_10퍼센트를_받는다() { /* ... */ }
    }
}
```

AssertJ(`assertThat`)가 JUnit 기본 단정보다 실패 메시지가 훨씬 명확하다. 있으면 쓴다.
`@Nested`로 그룹화하면 테스트 리포트가 명세처럼 읽힌다.

### 시간 고정
```java
// Clock을 주입한다 — LocalDateTime.now()를 직접 부르면 테스트 불가
Clock fixed = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneId.of("UTC"));
var sut = new OrderService(repo, fixed);
```

`LocalDateTime.now()`를 직접 부르는 코드는 테스트할 방법이 없다. `Clock` 주입은 그 코드를 검증 가능하게 만드는 가장 값싼 방법이다.

### Mockito
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository repo;
    @Mock MailSender mailer;
    @InjectMocks UserService sut;

    @Test
    void 중복_이메일이면_저장하지_않는다() {
        given(repo.existsByEmail("a@b.com")).willReturn(true);

        assertThatThrownBy(() -> sut.register("a@b.com"))
            .isInstanceOf(DuplicateEmailException.class);

        then(repo).should(never()).save(any());
        verifyNoInteractions(mailer);
    }
}
```

`never()` / `verifyNoInteractions`로 **하지 않아야 할 일을 하지 않았음**을 검증하는 것이 차별점이다.

### Spring 통합 테스트 (MockMvc)
```java
@SpringBootTest
@AutoConfigureMockMvc
@Transactional          // 테스트마다 롤백 — 격리 확보
class UserApiTest {

    @Autowired MockMvc mvc;

    @Test
    void 사용자를_생성하면_201과_Location을_반환한다() throws Exception {
        mvc.perform(post("/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"a@b.com","name":"희식"}
                    """))
           .andExpect(status().isCreated())
           .andExpect(header().exists("Location"))
           .andExpect(jsonPath("$.email").value("a@b.com"));
    }

    @Test
    void 이메일_형식이_틀리면_400을_반환한다() throws Exception {
        mvc.perform(post("/users").contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"not-an-email"}"""))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.errors[0].field").value("email"));
    }
}
```

`@SpringBootTest`는 느리다. 컨트롤러만 볼 거면 `@WebMvcTest` + `@MockBean`이 훨씬 빠르고, 그 선택 자체가 판단력의 증거다.

### 저장소 테스트
```java
@DataJpaTest       // 인메모리 DB, JPA만 로딩
class UserRepositoryTest {
    @Autowired UserRepository repo;
    @Autowired EntityManager em;

    @Test
    void 이메일로_조회한다() {
        repo.save(new User("a@b.com"));
        em.flush(); em.clear();          // 영속성 컨텍스트 비우기 — 실제 쿼리를 타게

        assertThat(repo.findByEmail("a@b.com")).isPresent();
    }
}
```

`em.flush(); em.clear();`가 핵심이다. 이걸 빼면 1차 캐시에서 읽어 쿼리가 실제로 검증되지 않는다.

### 실행
```bash
./gradlew test
./gradlew test --tests "*UserApiTest*"
./gradlew test --tests "*.UserApiTest.사용자를_생성하면_201과_Location을_반환한다"
mvn test -Dtest=UserApiTest
```

---

## 테스트를 안 써도 되는 경우

시간이 정말 없다면 우선순위는 이렇다.

1. **통합 테스트 1개** (정상 흐름 관통) — 이게 없으면 동작한다는 근거가 없다
2. 요구사항 표의 필수 항목 중 로직이 복잡한 것 2~3개
3. 에러 경로 1~2개

그리고 PR 설명에 명시한다:
```
일정 제약으로 통합 테스트 1개와 핵심 도메인 로직 테스트만 작성했습니다.
미검증 영역은 다음 순서로 보강 예정입니다 (#1242): (1) 검증 실패 경로 전체,
(2) 동시 요청 시 중복 생성, (3) 저장소 계층 쿼리 검증.
```

이렇게 쓰면 리뷰어가 무엇이 검증되지 않았는지 알고 리뷰하고, 후속 티켓으로 남는다.
