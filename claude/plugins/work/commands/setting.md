---
description: work 설정을 잡는다 (글로벌 ~/.work/config.json · 프로젝트 .work/config.json · 셸 env 토큰)
argument-hint: [global | project | 비우면 자동]
---

`setting` 스킬을 사용해 진행한다. 스킬의 절차를 건너뛰지 말고 순서대로 따른다.

사용자가 전달한 범위:
$ARGUMENTS

비어 있으면 처음 세팅인지(글로벌 + 셸 env) 특정 repo 감지 문제인지 먼저 확인한다.
비밀 토큰은 어느 config 파일에도 쓰지 않고 셸 환경변수로 안내한다.
