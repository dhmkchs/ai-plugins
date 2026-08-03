# TypeScript 심화

## tsconfig 최소 기준

새 프로젝트라면 아래는 켜고 시작한다. 기존 프로젝트라면 끄기 전에 왜 껐는지 확인한다.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "skipLibCheck": true
  }
}
```

`noUncheckedIndexedAccess`는 `arr[0]`을 `T | undefined`로 만든다. 귀찮지만 인덱스 버그를 컴파일 타임에 잡는다.
켠 상태로 통과시키면 인덱스 접근 버그가 런타임까지 살아남지 않는다.

## 자주 쓰는 타입 패턴

### 유틸리티 타입
```typescript
Pick<User, 'id' | 'email'>          // 일부만
Omit<User, 'password'>              // 응답 DTO 만들 때
Partial<User>                       // 부분 업데이트
Required<Config>
Readonly<User>
Record<string, number>
NonNullable<T>
Awaited<ReturnType<typeof fn>>      // 비동기 반환 타입 추출
```

### 브랜드 타입 — ID 혼용 방지
```typescript
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };

const asUserId = (s: string) => s as UserId;

function getUser(id: UserId) { /* ... */ }
// getUser(orderId)  ← 컴파일 에러. 실제 버그를 막는다
```

같은 `string`인 여러 ID를 섞어 넘기는 버그는 흔하다. 브랜드 타입은 눈에 띄는 방어책이다.

### 타입 가드
```typescript
function isItem(x: unknown): x is Item {
  return typeof x === 'object' && x !== null
    && typeof (x as Item).id === 'string';
}

// 배열 필터에서 타입이 좁혀진다
const items = raw.filter(isItem);

// null 제거
const defined = maybe.filter((x): x is Item => x !== null);
```

### 망라 검사 (exhaustive check)
```typescript
function render(s: State): string {
  switch (s.status) {
    case 'loading': return '...';
    case 'success': return s.data.length + '건';
    case 'error':   return s.message;
    default: {
      const _never: never = s;      // 케이스 추가 시 컴파일 에러
      throw new Error(`unhandled: ${JSON.stringify(_never)}`);
    }
  }
}
```

이 패턴은 "새 상태를 추가하면 처리를 강제한다"는 설계 의도를 보여준다.

### satisfies
```typescript
// 타입 검사는 받고, 리터럴 타입은 유지한다
const config = {
  port: 3000,
  host: 'localhost',
} satisfies { port: number; host: string };

config.host;   // 'localhost' (string이 아니라 리터럴)
```

## 함정 정리

| 함정 | 실제 결과 | 대응 |
|---|---|---|
| `arr.sort()` | 문자열 비교 → `[1,10,2]` | `sort((a,b)=>a-b)`, 원본 보존은 `[...arr]` |
| `arr.sort()` 원본 변경 | React 화면 미갱신 | 복사 후 정렬, 또는 `toSorted` |
| `reduce` 초기값 없음 | 빈 배열에서 예외 | 항상 초기값 지정 |
| `for...in` | 인덱스가 문자열, 프로토타입 순회 | `for...of`, `Object.entries` |
| `NaN === NaN` | `false` | `Number.isNaN` |
| `typeof null` | `'object'` | `x === null` 명시 |
| `[] == false` | `true` | `===`만 사용 |
| `parseInt('08')` | 구형 환경에서 8진수 해석 | `Number(x)` 또는 `parseInt(x, 10)` |
| `0.1 + 0.2` | `0.30000000000000004` | 정수(cent) 계산 |
| `JSON.parse` 결과 | `any` | `unknown`으로 받아 파싱 |
| `Object.keys` 반환 | `string[]` (키 타입 소실) | `as (keyof T)[]` 또는 `Object.entries` |
| 얕은 복사 | `{...obj}`는 1단계만 | `structuredClone(obj)` |
| `await` 누락 | 조용히 Promise가 흘러감 | `no-floating-promises` 린트 규칙 |
| `Promise.all` 부분 실패 | 전체 reject | `allSettled` |
| `setTimeout` 정리 누락 | 메모리 누수, 중복 실행 | cleanup에서 `clearTimeout` |
| 화살표 아닌 함수의 `this` | `undefined` | 화살표 함수 또는 `bind` |

## Node 실행 팁

```bash
npx tsx src/index.ts            # 컴파일 없이 TS 실행 (ts-node보다 빠름)
node --watch --experimental-strip-types src/index.ts   # Node 22+
node --env-file=.env src/index.js                       # Node 20+, dotenv 불필요
```

## React 특화

```typescript
// 상태 갱신은 항상 새 객체
setItems(prev => prev.map(i => i.id === id ? { ...i, done: true } : i));

// stale closure 회피 — 함수형 업데이트
setCount(c => c + 1);          // setCount(count + 1) 아님

// useEffect: 의존성 정확히 + cleanup
useEffect(() => {
  const ctrl = new AbortController();
  fetch(url, { signal: ctrl.signal }).then(/* ... */);
  return () => ctrl.abort();      // 언마운트 시 취소 — 경쟁 조건 방지
}, [url]);

// 파생 상태는 state로 두지 않는다
const total = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
// useState + useEffect로 total을 동기화하는 것은 안티패턴

// key에 인덱스 사용 금지
{items.map(i => <Row key={i.id} item={i} />)}
```

로딩·에러·빈 상태를 모두 처리한다. 정상 상태만 만들고 나머지를 나중에 붙이면, 그 "나중"에 구조를 다시 짜게 된다.

```typescript
if (state.status === 'loading') return <Spinner />;
if (state.status === 'error')   return <ErrorMessage message={state.message} onRetry={retry} />;
if (state.data.length === 0)    return <EmptyState />;
return <List items={state.data} />;
```

접근성은 값싸게 확보된다: `<button>`을 `<div onClick>` 대신 쓰고, 폼에 `<label htmlFor>`를 붙이고, 이미지에 `alt`를 준다. 나중에 소급 적용하는 비용이 훨씬 크다.
