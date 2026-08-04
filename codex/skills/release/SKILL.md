---
name: release
description: >
  머지된 변경을 semver 버전·태그·changelog로 릴리즈하고, 배포 순서·배포 후 확인·롤백 계획까지 챙긴다.
  Use when cutting a release or deploying — tagging a version, writing a changelog, promoting to
  staging/prod, planning rollback — or the user says "릴리즈해줘", "배포하자", "버전 올려",
  "태그 만들어", "changelog 생성", "프로덕션 배포", "롤백 계획", "이거 내보내자". `cleanup` 다음,
  머지 후 단계다. 대상: semver · Conventional Commits 기반 changelog.
---

# Release

**배포는 되돌리기 어렵고 사용자에게 직접 닿는다.** 그래서 릴리즈는 (1) 무엇이 나가는지 changelog로
명확히 하고 (2) 배포 순서를 지키고 (3) 나간 뒤 확인하고 (4) 문제 시 되돌릴 계획을 미리 가진 채로 한다.
"머지됐으니 배포"로 끝내면, 마이그레이션 순서 하나로 프로덕션이 죽는다.

## 1. 릴리즈 전 체크 — 하나라도 실패하면 멈춘다

```bash
git checkout main && git pull
git log --oneline $(git describe --tags --abbrev=0)..HEAD   # 지난 태그 이후 무엇이 들어왔나
```

- `main`(또는 릴리즈 브랜치)이 green인가 — CI 통과, 빌드 성공
- 스키마 마이그레이션이 포함됐나 → `migrate`의 **배포 순서**를 확인 (코드 먼저 vs 스키마 먼저)
- 배포 순서 의존이 있는 다른 티켓이 있나 (PR 본문 경고에서)
- 환경 설정·시크릿·피처 플래그가 대상 환경에 준비됐나

## 2. 버저닝 — semver

`MAJOR.MINOR.PATCH`. Conventional Commits가 버전 상승을 결정한다.

| 커밋 | 상승 |
|---|---|
| `fix:` | PATCH (1.2.3 → 1.2.4) |
| `feat:` | MINOR (1.2.3 → 1.3.0) |
| `feat!:` / `BREAKING CHANGE:` | MAJOR (1.2.3 → 2.0.0) |

- 지난 태그 이후 커밋 타입을 훑어 상승 단계를 정한다
- 0.x 는 예외 — 파괴적 변경도 MINOR로 두는 관례가 흔하다 (팀 규약)

## 3. changelog — 커밋에서 생성, 사용자 언어로

`commit` 스킬의 Conventional Commits가 여기서 값을 한다 — changelog를 자동 생성할 수 있다.

```
## [1.3.0] - 2026-08-04

### Added
- 회원가입 시 이메일 중복 검사 (PROJ-123)

### Fixed
- 재시도 시 이중 결제 방지 (PROJ-140)

### Changed
- 업스트림 타임아웃 15s → 30s

### ⚠️ Breaking
- /v1/login 제거. /v2/auth/login 으로 이전 (BREAKING CHANGE)
```

- `feat`→Added, `fix`→Fixed, `refactor`/`perf`→Changed, `!`/BREAKING→Breaking
- **커밋 메시지 그대로가 아니라 사용자 관점으로** 다듬는다 (내부 리팩터·chore·test는 대개 생략)
- 도구: `git-cliff`, `changesets`, `standard-version`, `release-please` — 팀 관례 따름

## 4. 태그 → 배포

```bash
git tag -a v1.3.0 -m "Release 1.3.0"
git push origin v1.3.0        # 태그 push가 보통 릴리즈 파이프라인을 트리거
```

- **배포 순서 준수**: 마이그레이션이 있으면 §1에서 확인한 순서대로 (스키마→코드 또는 코드→스키마). 반대면 실패
- 환경 승격: staging에서 스모크 통과 → prod. 로컬/CI green ≠ prod 안전
- 점진 배포(가능하면): 카나리·블루그린으로 폭발 반경을 줄인다

## 5. 배포 후 확인 — 나갔으면 본다

배포는 "파이프라인 초록"에서 끝나지 않는다. 실제로 도는지 확인한다.

- 헬스체크·핵심 엔드포인트 200
- 스모크: 가장 중요한 유저 플로우 하나를 실제로 밟아본다 (`e2e` 스모크 스위트가 있으면 prod 대상 실행)
- 에러율·레이턴시 대시보드를 배포 직후 몇 분간 지켜본다 (배포 전 대비 급증?)
- 마이그레이션이 있었으면 데이터가 예상대로인지 샘플 확인

## 6. 롤백 계획 — 배포 전에 준비한다

되돌리는 방법을 **배포 후가 아니라 전에** 정해둔다.

- 코드: 직전 태그로 재배포 (`v1.2.x`) 또는 파이프라인 롤백 버튼
- **스키마가 얽히면 코드 롤백만으로 안 된다** — 구 코드가 새 스키마와 안 맞을 수 있다. `migrate`의 expand-contract가 이래서 중요(각 단계가 독립적이라 안전하게 멈춤)
- 되돌릴 수 없는 변경(데이터 삭제)은 롤백 불가 → 피처 플래그로 끄는 경로를 미리 확보
- 롤백 트리거 기준을 미리 정한다 (에러율 X% 초과 시 등)

## 승인 게이트

프로덕션 배포 전 멈추고 보여준다: 버전·changelog·배포 순서·롤백 방법. 승인 후 실행한다.

## work 사슬 연결

- `cleanup`(머지 후 정리) 다음 단계. 여러 티켓이 한 릴리즈로 나갈 수 있다.
- 마이그레이션 배포 순서는 `migrate`·`pr` 본문 경고에서 이어받는다.
- changelog 품질은 `commit`의 Conventional Commits에 달렸다.
- 배포 후 스모크는 `e2e` 스위트를 prod 대상으로 재사용한다.

## 하지 말 것

| 안티패턴 | 실제 비용 |
|---|---|
| 머지됐으니 바로 배포 | 마이그레이션 순서·환경 설정 누락으로 프로덕션 장애 |
| 배포 순서 무시 | 코드-스키마 불일치 구간에서 500 |
| staging 건너뛰고 prod | 규모·데이터 문제를 사용자가 처음 만남 |
| 배포 후 확인 안 함 | 장애를 사용자가 먼저 발견, 대응 지연 |
| 롤백 계획 없이 배포 | 문제 시 즉흥 대응, 다운타임 연장 |
| changelog에 내부 잡무 나열 | 사용자에게 노이즈, 정작 중요한 변경이 묻힘 |
| 버전 임의 상승 | semver 계약 깨짐, 소비자가 파괴적 변경을 예측 못 함 |

## 참고 파일

- `references/checklist.md` — 릴리즈 전/중/후 체크리스트, changelog 도구, 롤백 시나리오별 대응
