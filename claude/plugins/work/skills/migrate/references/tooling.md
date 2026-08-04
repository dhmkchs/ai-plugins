# 마이그레이션 도구별 명령과 함정

## Prisma (JS/TS)

```bash
npx prisma migrate status                 # 적용 상태
npx prisma migrate dev --name add_handle  # 개발: 마이그레이션 생성 + 적용
npx prisma migrate diff \                  # 실제 SQL 미리보기 (실행 전 반드시)
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma --script
npx prisma migrate deploy                  # 프로덕션: 생성된 마이그레이션만 적용 (dev 금지)
```

함정:
- `migrate dev`는 드리프트 감지 시 **DB를 리셋할 수 있다** — 프로덕션·공유 DB에서 절대 금지. 배포는 `migrate deploy`
- Prisma는 down 마이그레이션이 없다 → 역방향 SQL을 손으로 `migration.sql`에 준비해 둔다
- 파괴적 변경은 경고를 내지만 생성된 SQL을 사람이 확인해야 한다

## TypeORM (JS/TS)

```bash
npm run typeorm migration:generate -- -n AddHandle   # 엔티티 diff로 생성
npm run typeorm migration:run
npm run typeorm migration:revert                      # 마지막 마이그레이션 롤백 (down 실행)
```

함정: `synchronize: true`는 개발 편의 기능 — **프로덕션에서 끈다**(무통제 스키마 변경). `up`/`down` 둘 다 채운다.

## Flyway (Java)

```bash
./gradlew flywayInfo        # 적용 상태
./gradlew flywayMigrate     # 대기 마이그레이션 적용
./gradlew flywayValidate    # 체크섬 검증
./gradlew flywayUndo        # 롤백 (Teams 에디션만 — 커뮤니티는 역방향 마이그레이션 수동)
```

- 버전드 마이그레이션 `V2__add_handle.sql`은 **불변** — 적용 후 수정하면 체크섬 깨짐. 고칠 게 있으면 새 버전을 추가
- 반복 마이그레이션 `R__view.sql`은 체크섬 바뀌면 재실행 (뷰·함수용)
- 커뮤니티 에디션은 undo 없음 → `V3__revert_handle.sql`로 역방향을 새 버전으로

## Liquibase (Java)

```bash
liquibase status
liquibase update
liquibase rollbackCount 1        # 마지막 changeset 롤백
liquibase updateSQL              # 적용될 SQL 미리보기 (실행 전)
```

- changeset마다 `rollback` 블록을 명시 (자동 롤백이 안 되는 변경은 필수)
- `updateSQL`로 항상 미리보기

## Postgres 무중단 팁 (도구 무관)

```sql
CREATE INDEX CONCURRENTLY idx_users_handle ON users(handle);  -- 락 없이 (트랜잭션 밖에서)
ALTER TABLE users ADD CONSTRAINT chk NOT VALID;               -- 검증 미루기
ALTER TABLE users VALIDATE CONSTRAINT chk;                    -- 나중에 락 짧게 검증
```

- `CONCURRENTLY`는 트랜잭션 안에서 못 돈다 → 마이그레이션 도구의 트랜잭션 래핑을 꺼야 할 수 있음
- 컬럼 default 추가: PG 11+ 는 메타데이터만 → 빠름. 그 이하는 전체 rewrite
