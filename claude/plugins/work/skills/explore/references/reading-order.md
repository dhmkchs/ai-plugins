# 아키텍처 유형별 읽는 순서

코드베이스 구조를 먼저 분류하면 읽는 순서가 정해진다. `find . -type d -not -path "*/node_modules/*"` 결과로 판별한다.

## 레이어드 / Spring 스타일

디렉터리에 `controller`, `service`, `repository`, `entity`, `dto`가 보인다.

**읽는 순서**: Entity → Repository 인터페이스 → Service → Controller

이유: 도메인 모델(Entity)이 나머지 전부를 규정한다. 필드와 관계를 알면 서비스 로직이 예측된다.
Controller는 마지막에 봐도 된다 — 대개 얇다.

**핵심 확인 지점**
- Entity의 관계 매핑 (`@OneToMany`, `fetch` 전략, `cascade`)
- Service의 `@Transactional` 경계 — 어디서 시작하고 어디서 끝나는가
- DTO ↔ Entity 변환 위치 (수동/MapStruct/생성자)
- 예외를 어디서 잡아 어떤 응답으로 바꾸는가 (`@ControllerAdvice`)

## React / Next.js 프런트엔드

`components`, `pages` 또는 `app`, `hooks`, `store`, `lib`.

**읽는 순서**: 라우트 정의 → 페이지 컴포넌트 → 데이터 훅 → API 클라이언트 → 하위 컴포넌트

이유: 화면에서 시작해 데이터로 내려가는 것이 사용자 관점과 일치하고, 버그 리포트와 기능 요청도 대개 화면 기준으로 들어온다.

**핵심 확인 지점**
- 서버/클라이언트 컴포넌트 경계 (`"use client"`)
- 데이터 페칭 방식 (React Query / SWR / 서버 컴포넌트 / useEffect)
- 전역 상태의 위치와 갱신 경로
- 폼 처리와 검증 (react-hook-form + zod 등)
- 로딩·에러 상태를 어디서 처리하는지 (없으면 내가 추가해야 할 부분이다)

## Node 백엔드 (Express / NestJS / Fastify)

**읽는 순서**: 서버 부트스트랩 → 미들웨어 체인 → 라우터 → 핸들러 → 데이터 계층

**핵심 확인 지점**
- 미들웨어 순서 (인증·검증·에러 핸들러의 위치가 동작을 결정)
- 에러 핸들러가 마지막에 등록돼 있는가
- 비동기 에러가 잡히는가 (`express@4`는 async 에러를 자동으로 못 잡음)
- 요청 스코프 컨텍스트 (요청 ID, 트랜잭션)

## 모노레포

`packages/`, `apps/`, `libs/` + 루트에 워크스페이스 설정.

**읽는 순서**: 루트 워크스페이스 설정 → 대상 앱의 `package.json` → 의존하는 내부 패키지 → 공유 타입 패키지

먼저 답할 질문: **내가 수정할 코드가 어느 패키지에 있고, 그 패키지를 누가 쓰는가.**
공유 패키지를 고치면 여러 앱이 깨진다. 앱 로컬 코드를 고치는 편이 안전하다.

```bash
cat pnpm-workspace.yaml turbo.json nx.json 2>/dev/null
grep -rn "\"@myorg/" apps/*/package.json | head -20
```

## CLI / 배치 / 스크립트

**읽는 순서**: 인자 파서 → 커맨드 디스패치 → 각 커맨드 핸들러 → 공용 유틸

**핵심 확인 지점**: 종료 코드, stdout/stderr 분리, 스트리밍 여부(큰 입력을 한 번에 메모리에 올리는지)

## 유형 판별이 안 될 때

디렉터리 구조가 특이하거나 이름만으로 판단이 안 되면 테스트 디렉터리부터 본다.
테스트는 항상 "이 코드를 어떻게 쓰는가"를 보여주고, 테스트 파일 구조가 소스 구조를 반영한다.

```bash
find . -path "*test*" -name "*.java" -o -path "*__tests__*" -o -name "*.spec.*" -o -name "*.test.*" | grep -v node_modules | head -30
```

## 읽기 예산

어떤 유형이든 **파일 5개 / 총 400줄**을 넘겨 읽고 있으면 멈춘다.
그건 길을 잃은 신호다. 4단계(수정 지점 국소화)로 돌아가 문자열 검색으로 다시 좁힌다.
