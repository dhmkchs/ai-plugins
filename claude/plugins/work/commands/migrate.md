---
description: DB 스키마 마이그레이션을 expand-contract·롤백·배포순서까지 무중단으로 수행한다
argument-hint: [변경 내용, 예: users에 handle 컬럼 추가 또는 username 리네임]
---

`migrate` 스킬을 사용해 진행한다. 스킬의 절차를 건너뛰지 말고 순서대로 따른다.

사용자가 전달한 변경:
$ARGUMENTS

파괴적 변경은 expand-contract로 쪼갠다. 롤백과 배포 순서(코드 vs 스키마)를 항상 함께 설계한다.
프로덕션 실행 전, 적용될 SQL 전문·배포 순서·롤백 방법을 보여주고 승인받는다.
비어 있으면 어떤 테이블을 어떻게 바꿀지, 테이블 규모와 대상 DB를 먼저 묻는다.
