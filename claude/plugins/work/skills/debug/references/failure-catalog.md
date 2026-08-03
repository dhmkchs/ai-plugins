# 증상 → 원인 후보 대조표

증상이 익숙하면 여기서 후보를 좁힌 뒤 가설을 세운다. 가설 검증은 생략하지 않는다.

## 값이 예상과 다르다

| 증상 | 우선 의심 |
|---|---|
| 결과가 1씩 어긋난다 | off-by-one: `<=` vs `<`, 0-based vs 1-based, `slice` 끝 인덱스 |
| 정확히 2배 / 개수만큼 크다 | 이중 카운트, 중첩 루프, 이벤트 핸들러 중복 등록 |
| 부호가 뒤집힌다 | 비교 함수 반환값, `a-b` vs `b-a` |
| 소수점 오차 | 부동소수점. `0.1+0.2`, 금액은 정수 또는 `BigDecimal` |
| 큰 수에서만 틀린다 | 오버플로: Java `int`→`long`, JS `>2^53`→`BigInt` |
| 문자열 비교가 실패 | 공백·개행·BOM·대소문자·유니코드 정규화(NFC/NFD) |
| 정렬 결과가 이상하다 | JS `sort()`는 기본이 문자열 비교 → `sort((a,b)=>a-b)` |
| 첫/마지막 원소만 틀리다 | 경계 처리, 루프 초기값/종료 조건 |
| 빈 입력에서 터진다 | 가드 없음, `arr[0]`, `reduce` without initial value |

## null / undefined / 예외

| 증상 | 우선 의심 |
|---|---|
| `Cannot read property of undefined` | 옵셔널 체이닝 누락, 비동기 결과를 기다리지 않음 |
| `NullPointerException` | 초기화 순서, `Optional.get()`, 주입 실패, 맵 조회 결과 |
| 특정 필드만 null | DTO 매핑 누락, 직렬화 시 필드 이름 불일치, `@JsonProperty` |
| 값이 `undefined`가 아니라 `null` (또는 반대) | JSON 왕복, DB null, 기본값 처리 정책 불일치 |
| 예외가 안 잡힌다 | 비동기 경계 (`async` 콜백, `setTimeout`, 스레드), 미들웨어 순서 |

## 컬렉션 / 자료구조

| 증상 | 우선 의심 |
|---|---|
| `Set`/`Map`에 중복이 들어간다 | Java: `equals`/`hashCode` 미구현. JS: 객체 키는 참조 비교 |
| 조회가 항상 실패 | 키 타입 불일치 (문자열 `"1"` vs 숫자 `1`), trailing 공백 |
| 순회 중 예외 | `ConcurrentModificationException` → `removeIf` / `Iterator.remove` |
| 원본이 바뀌어 있다 | JS `sort`/`reverse`/`splice`/`push`는 mutate. Java `Collections.sort` |
| 리스트에 add가 안 된다 | `Arrays.asList`(고정 크기), `List.of`(불변) |
| 순서가 뒤죽박죽 | `HashMap`/`HashSet`은 순서 미보장 → `LinkedHashMap`/`TreeMap` |
| 얕은 복사 문제 | `{...obj}`, `Object.assign`은 1단계만 복사 |

## 비동기 / 동시성

| 증상 | 우선 의심 |
|---|---|
| 값이 아직 비어 있다 | `await` 누락, 콜백 밖에서 읽음 |
| 간헐적 실패 (flaky) | 경쟁 조건, 테스트 간 상태 공유, 시간·타임존 의존, 순서 의존 |
| Promise가 조용히 실패 | `.catch` 누락, `Promise.all` 부분 실패 → `allSettled` |
| 반복 호출이 쌓인다 | 리스너/타이머 정리 누락 (`useEffect` cleanup, `removeEventListener`) |
| 순차 실행인데 느리다 | 루프 안 `await` → `Promise.all`로 병렬화 |
| Java에서 값이 보이지 않는다 | 가시성: `volatile`, 동기화 누락 |
| 데드락 | 락 획득 순서 불일치, `@Transactional` 중첩 |

## 스프링 / JPA 특화

| 증상 | 우선 의심 |
|---|---|
| `@Transactional`이 안 먹는다 | 같은 클래스 내부 호출 (프록시 우회), `private` 메서드 |
| 저장했는데 DB에 없다 | 트랜잭션 롤백, flush 안 됨, 자동 커밋 아님 |
| 조회가 폭발적으로 느리다 | N+1 → `fetch join`, `@EntityGraph`, `@BatchSize` |
| `LazyInitializationException` | 트랜잭션 밖에서 지연 로딩 접근 |
| 변경이 반영 안 된다 | detached 엔티티, `save` 반환값을 안 씀 |
| 빈 주입 실패 | 컴포넌트 스캔 범위, 순환 의존, 프로파일 조건 |
| 검증이 동작 안 함 | `@Valid` 누락, `@Validated` 클래스 레벨 필요 |

## React / 프런트엔드 특화

| 증상 | 우선 의심 |
|---|---|
| 화면이 갱신 안 됨 | 상태를 직접 mutate (새 객체를 만들어야 함) |
| 무한 렌더링 루프 | `useEffect` 의존성에 매 렌더 새로 만들어지는 값 |
| 오래된 값이 보인다 | stale closure → 함수형 업데이트 `setX(x => ...)` |
| 입력이 한 글자씩 밀린다 | controlled/uncontrolled 혼용, `value` 없이 `onChange` |
| 리스트가 이상하게 재사용됨 | `key`에 인덱스 사용 |
| 서버/클라이언트 불일치 | hydration mismatch: 시간·랜덤·`window` 접근 |

## 빌드 / 환경

| 증상 | 우선 의심 |
|---|---|
| 내 로컬은 되는데 CI는 안 된다 | Node/JDK 버전, 대소문자 구분 파일시스템, 환경변수, 타임존, 로케일 |
| import를 못 찾는다 | tsconfig `paths`, 확장자, ESM/CJS 혼용, 대소문자 |
| 의존성이 이상하게 동작 | 버전 충돌 → `npm ls <pkg>` / `mvn dependency:tree` |
| 갑자기 전부 깨졌다 | 락파일 없이 install, 다른 패키지 매니저 사용 |

## Flaky 테스트 전용 체크

1. 단독 실행은 통과하는가 → 통과하면 테스트 간 상태 공유
2. 순서를 바꾸면 결과가 바뀌는가 → 순서 의존
3. 현재 시간·랜덤·UUID를 쓰는가 → 고정값 주입 필요
4. 타임아웃/`sleep`에 의존하는가 → 조건 대기로 변경
5. 병렬 실행 중인가 → 공유 리소스(포트, 파일, DB) 충돌
6. 외부 네트워크를 타는가 → 모킹 필요
