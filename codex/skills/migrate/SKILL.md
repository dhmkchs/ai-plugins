---
name: migrate
description: >
  DB 스키마 마이그레이션을 expand-contract·백필·롤백·배포순서까지 무중단 원칙으로 안전하게 수행한다.
  Use when changing a database schema — add/drop/rename a column or table, change a type or
  constraint, backfill data, index a large table — or the user says "마이그레이션", "스키마 변경",
  "컬럼 추가/삭제", "테이블 바꿔야 해", "DB 스키마 고쳐", "prisma migrate", "flyway", "백필",
  "무중단 배포로 스키마 바꾸기". 롤백과 배포 순서를 항상 함께 설계한다. 대상: Prisma · TypeORM · Flyway · Liquibase.
---

# Schema Migration

**스키마 변경은 코드 배포와 타이밍이 얽힌다.** 코드가 새 컬럼을 읽는데 마이그레이션이 아직 안 돌았거나,
컬럼을 지웠는데 구버전 코드가 아직 떠 있으면 프로덕션이 죽는다. 그래서 마이그레이션은 항상
**되돌릴 수 있게 + 배포 순서를 명시해서 + 한 번에 파괴하지 않고** 한다.

## 1. 변경 전 — 현재를 고정한다

```bash
# 현재 스키마·적용된 마이그레이션 상태 확인
npx prisma migrate status          # Prisma
./gradlew flywayInfo               # Flyway
```

- 프로덕션 데이터 백업이 있나 (있어야 롤백 최후수단이 생긴다)
- 바꾸려는 테이블이 큰가 (수백만 행이면 락·백필 전략이 달라진다 — §4)
- 이 컬럼/테이블을 읽는 코드가 어디인가 (`grep`으로 찾아 영향 범위 확정)

## 2. expand-contract — 파괴적 변경을 무중단으로 쪼갠다

컬럼 rename·타입 변경·삭제처럼 파괴적인 변경을 **한 번에 하지 않는다.** 확장 → 이전 → 수축으로 나눈다.

**예: `username` → `handle` 리네임 (무중단)**

```
1. EXPAND   : handle 컬럼 추가 (nullable). 구/신 코드 모두 동작
2. BACKFILL : username 값을 handle로 복사 (배치)
3. DUAL     : 코드가 둘 다 쓰기, handle 우선 읽기 → 배포
4. CONTRACT : 안정 확인 후 username 컬럼 제거 (다음 배포)
```

각 단계가 **독립 배포**다. 어느 시점에 멈춰도 시스템이 산다. 한 마이그레이션에 add+drop을 같이 넣으면 이 안전망이 사라진다.

| 변경 | 안전한 순서 |
|---|---|
| 컬럼 추가 | nullable 또는 default로 추가 → 백필 → (필요시) NOT NULL |
| 컬럼 삭제 | 코드에서 사용 제거·배포 → 그 다음 배포에서 컬럼 drop |
| 컬럼 rename | add new → backfill → dual-write → drop old (rename 직접 X) |
| 타입 변경 | new 컬럼 add → 변환 백필 → 전환 → old drop |
| NOT NULL 추가 | 백필로 빈 값 채우기 → 제약 추가 |

## 3. 되돌릴 수 있게 — up과 down을 함께

모든 마이그레이션에 롤백 경로를 만든다. 도구가 down을 지원하면 작성하고, 안 하면 역방향 스크립트를 남긴다.

- 자동 생성된 마이그레이션도 **사람이 읽고** down이 맞는지 확인한다
- **되돌릴 수 없는 변경**(컬럼 drop, 데이터 삭제)은 down으로 데이터를 복구 못 한다 → 그래서 §2의 contract를 마지막에, 백업이 있을 때만
- 롤백을 실제로 staging에서 한 번 돌려본다 (down이 깨지는 경우가 흔하다)

## 4. 큰 테이블 — 락과 배치

수백만 행 테이블은 순진한 마이그레이션이 테이블을 잠가 서비스를 멈춘다.

- **인덱스 생성**: `CREATE INDEX CONCURRENTLY` (Postgres) — 락 없이. 일반 `CREATE INDEX`는 쓰기를 막는다
- **백필**: 한 트랜잭션에 `UPDATE 전체` 금지 → 배치로 나눠 돈다 (1천~1만 행씩, 사이에 커밋)
- **NOT NULL/제약 추가**: 검증이 풀스캔 락을 유발 → Postgres는 `NOT VALID`로 추가 후 `VALIDATE CONSTRAINT` 분리
- **기본값 추가**: 최신 DB는 메타데이터만 바꿔 빠름. 구버전은 전체 rewrite → 큰 테이블 주의

```sql
-- 배치 백필 예 (의사코드)
UPDATE users SET handle = username
WHERE handle IS NULL AND id BETWEEN :lo AND :hi;   -- 범위를 옮겨가며 반복
```

## 5. 배포 순서 — 코드와 스키마 중 뭐가 먼저

배포 순서를 틀리면 그 사이 구간에서 죽는다. 변경 유형별로 순서가 정해져 있다.

| 변경 | 순서 |
|---|---|
| 컬럼 **추가** | 마이그레이션 **먼저**, 그 다음 코드 (코드가 새 컬럼을 읽기 전에 존재해야) |
| 컬럼 **삭제** | 코드 **먼저**(사용 제거), 그 다음 마이그레이션 (쓰는 코드가 사라진 뒤 drop) |
| NOT NULL 추가 | 백필 마이그레이션 먼저 → 코드가 항상 값 채움 → 제약 추가 |

이 순서를 **`pr` 본문 맨 위 경고로 올린다.** 반대로 배포되면 실패한다.

```
⚠️ 배포 순서: 이 마이그레이션(컬럼 추가)을 코드보다 먼저 배포. 반대면 500 발생.
```

## 6. 검증 — staging 먼저, dry-run

- 마이그레이션 SQL을 **먼저 눈으로 본다** (`prisma migrate diff`, `flyway` dry-run). 자동 생성이 파괴적 SQL을 만들 수 있다
- staging(프로덕션과 같은 규모 데이터)에서 먼저 돌린다 — 로컬 빈 DB는 락·시간 문제를 안 보여준다
- 소요 시간·락 범위를 측정한다. 배포 창(window)이 필요한지 판단
- 롤백을 staging에서 실제로 실행해본다

## 승인 게이트

프로덕션 마이그레이션은 **되돌리기 어렵다.** 실행 전 멈추고 보여준다:
- 적용될 SQL 전문
- 배포 순서 (코드 vs 스키마)
- 롤백 방법
- 큰 테이블이면 예상 락·시간

승인 후에만 실행한다. 도구별 실행 명령은 `references/tooling.md`.

## work 사슬 연결

- `feature`/`start`에서 스키마 변경이 나오면 → 이 스킬로 안전하게 쪼갠다.
- API 스키마와 얽히면 → `api`의 하위호환·버저닝과 함께 설계한다.
- 배포 순서 의존은 `pr` 본문 경고 + `release`의 릴리즈 전 체크에 반영한다.
- 되돌리기 비싼 데이터 모델 결정(soft delete, 정규화 정도)은 `adr`로 근거를 남긴다.

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| add + drop을 한 마이그레이션에 | 무중단 안전망 사라짐, 롤백 불가 구간 발생 |
| 컬럼 직접 rename | 구버전 코드가 즉시 깨짐 (expand-contract로) |
| 한 트랜잭션 전체 UPDATE 백필 | 큰 테이블 락, 서비스 정지 |
| 일반 CREATE INDEX (대형 테이블) | 쓰기 차단, 다운타임 |
| down/롤백 없이 배포 | 실패 시 복구 경로 없음 |
| 배포 순서 미명시 | 반대로 배포돼 프로덕션 500 |
| 로컬 빈 DB만 테스트 | 락·소요시간·데이터 문제를 프로덕션에서 처음 만남 |
| 자동 생성 SQL 안 읽고 실행 | 의도치 않은 파괴적 변경 |

## 참고 파일

- `references/tooling.md` — Prisma · TypeORM · Flyway · Liquibase 실행/롤백 명령과 함정
