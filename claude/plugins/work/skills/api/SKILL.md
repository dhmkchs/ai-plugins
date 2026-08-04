---
name: api
description: >
  REST/GraphQL API 계약을 리소스·요청/응답 스키마·에러 shape·인증/인가·페이지네이션·버저닝까지
  계약 우선(contract-first)으로 설계하고 OpenAPI 문서로 남긴다.
  Use when designing or reviewing an API — a new endpoint, a request/response contract,
  auth/authz flow, error format, pagination, versioning — or the user says "API 설계",
  "엔드포인트 만들어야 해", "API 계약 정하자", "응답 형식 어떻게", "에러 포맷 통일",
  "이 API 리뷰해줘", "REST 규약", "GraphQL 스키마". 프론트 요구만이 아니라 데이터 구조·권한 흐름을
  함께 설계한다. 대상: REST · GraphQL (JS/TS·Java).
---

# API Design

**구현부터 하지 않는다. 계약을 먼저 정한다.** 요청/응답 스키마와 에러 형식이 흔들리면
프론트·백엔드가 서로를 기다리고, 나중에 바꾸면 이미 붙은 클라이언트가 다 깨진다.
계약 우선이면 프론트는 목으로, 백엔드는 실제로 병렬 진행하고, 계약이 곧 문서가 된다.

## 1. 리소스 모델링 — 명사는 URL, 동사는 메서드

리소스(명사)를 정하고 동작은 HTTP 메서드로 표현한다. URL에 동사를 넣지 않는다.

| 나쁨 | 좋음 |
|---|---|
| `POST /createUser` | `POST /users` |
| `GET /getUserOrders?id=1` | `GET /users/1/orders` |
| `POST /users/1/activate` | `POST /users/1/activation` (상태를 리소스로) 또는 `PATCH /users/1 {status}` |

- 컬렉션은 복수형: `/users`, `/orders`
- 계층은 중첩으로: `/users/1/orders/9` (단, 3단계 넘으면 평탄화 고려)
- 진짜 동사형 액션(도메인 명령)은 예외적으로 허용하되 최소화: `POST /orders/9/refund`

메서드 의미를 지킨다: `GET` 안전·멱등, `PUT`/`DELETE` 멱등, `POST` 비멱등, `PATCH` 부분 수정.

## 2. 계약 먼저 — 스키마와 상태코드를 못 박는다

엔드포인트마다 **요청 스키마 · 응답 스키마 · 상태코드**를 구현 전에 적는다.

```
POST /users
요청:  { email: string, name: string }
응답 201: { id: string, email: string, name: string, createdAt: string }
       400: 검증 실패 (에러 shape는 §4)
       409: 이메일 중복
```

상태코드는 의미대로:

| 코드 | 언제 |
|---|---|
| 200 / 201 / 204 | 성공 / 생성됨(Location 헤더) / 성공·본문없음 |
| 400 / 401 / 403 | 검증 실패 / 인증 안 됨 / 인증됐지만 권한 없음 |
| 404 / 409 / 422 | 없음 / 충돌(중복·상태모순) / 의미 검증 실패 |
| 429 / 5xx | 레이트리밋 / 서버 오류 (클라 잘못 아님) |

401(누구인지 모름)과 403(누구인지 알지만 권한 없음)을 헷갈리지 않는다.

## 3. 인증/인가 — 어디서 검증하나

- **인증(Authentication)**: 누구인가. 토큰·세션 검증. 미들웨어/필터에서 한 번.
- **인가(Authorization)**: 이걸 할 권한이 있나. **리소스 접근 시점마다** 확인한다.

핵심 함정: **인가를 프론트에서만 하면 뚫린다.** 버튼을 숨겨도 API를 직접 때리면 통과된다.
서버가 "이 사용자가 이 리소스에 권한이 있나"를 매 요청 검증해야 한다.

```
GET /users/1/orders   ← 토큰의 사용자 == 1 인가? (또는 admin인가?)
                         아니면 403. 이 검사가 없으면 IDOR 취약점.
```

토큰 흐름·저장 위치·리프레시 상세는 `references/auth-flows.md`.

## 4. 에러 shape — 하나로 통일한다

에러 응답이 엔드포인트마다 다르면 클라이언트가 매번 다르게 파싱한다. **한 형식으로 고정한다.**

```json
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "이미 가입된 이메일입니다",
    "details": [{ "field": "email", "issue": "duplicate" }]
  }
}
```

- `code`: 기계가 분기할 안정적 문자열 (메시지 텍스트로 분기 금지 — 문구 바뀌면 깨짐)
- `message`: 사람이 읽을 설명 (그대로 노출 가능한지 확인)
- `details`: 필드 검증 오류 등 구조화 정보 (선택)
- **내부 예외·스택트레이스·SQL을 응답에 노출하지 않는다** — 정보 유출

## 5. 페이지네이션·필터·정렬 — 규약을 하나로

목록 응답은 처음부터 페이지네이션을 전제한다. 나중에 넣으면 계약이 깨진다.

| 방식 | 언제 | 형태 |
|---|---|---|
| offset | 페이지 점프 필요, 데이터 적음 | `?page=2&size=20` |
| cursor | 무한스크롤, 큰/실시간 데이터 | `?cursor=xxx&limit=20` (일관성·성능 우위) |

```json
{ "data": [ ... ], "page": { "nextCursor": "xxx", "hasMore": true } }
```

- 필터·정렬 규약 고정: `?status=active&sort=-createdAt` (`-`는 내림차순)
- 필드 화이트리스트로만 정렬 허용 (임의 컬럼 정렬 = 인덱스 없는 풀스캔 위험)

## 6. 버저닝·하위호환 — 붙은 클라이언트를 깨지 않는다

- 버전은 URL 또는 헤더: `/v1/users` (단순·명시적) vs `Accept: application/vnd.api.v1+json`
- **하위호환 변경**(필드 추가, optional 파라미터)은 버전을 안 올려도 된다
- **파괴적 변경**(필드 제거·의미 변경·필수화)은 새 버전 또는 expand-contract:
  1. 새 필드 추가(구 필드 유지) → 2. 클라이언트 이전 → 3. 구 필드 제거
- 스키마 마이그레이션이 동반되면 `migrate` 스킬의 배포 순서 규칙을 따른다

## 7. 문서화 — OpenAPI가 계약의 정본

계약을 OpenAPI(Swagger)로 남긴다. 이게 G2 산출물이자 프론트 목 생성·클라 타입 생성의 소스다.

- 코드에서 생성(springdoc, zod-to-openapi, tsoa) 또는 스펙 우선 후 코드 검증
- 프론트는 이 스펙으로 타입/목을 생성 → 계약과 구현 불일치를 컴파일 타임에 잡음
- 예시 요청/응답을 스펙에 포함 — 문장 설명보다 예시가 오해를 줄인다

REST 상세 규약은 `references/rest-conventions.md`, 인증 흐름은 `references/auth-flows.md`.

## work 사슬 연결

- `plan`/`feature`에서 새 엔드포인트가 필요하면 → 구현 전에 여기서 계약을 먼저 정한다.
- API 스타일 선택(REST vs GraphQL vs RPC)이 되돌리기 비싸면 → `adr`로 근거를 남긴다.
- 스키마 변경이 동반되면 → `migrate`로 안전하게, 배포 순서를 `pr` 본문 경고로 올린다.

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| URL에 동사 (`/getUser`) | 메서드 의미가 죽고 캐시·멱등성 규약이 깨짐 |
| 인가를 프론트에서만 | API 직접 호출로 우회됨 (IDOR·권한 상승) |
| 에러 형식 제각각 | 클라가 매번 다르게 파싱, 처리 누락 |
| 메시지 텍스트로 분기 | 문구·번역 바뀌면 클라 로직이 깨짐 (`code`로 분기) |
| 내부 예외/스택 노출 | 정보 유출, 공격 표면 확대 |
| 목록에 페이지네이션 없음 | 데이터 늘면 응답 폭발, 나중에 넣으면 계약 파괴 |
| 파괴적 변경을 그냥 배포 | 붙어 있던 클라이언트가 전부 깨짐 |

## 참고 파일

- `references/rest-conventions.md` — 리소스 네이밍·메서드·상태코드·멱등성·캐싱 상세
- `references/auth-flows.md` — 인증 방식 비교(세션/JWT), 토큰 저장·리프레시, 인가 패턴(RBAC·리소스 소유권)
