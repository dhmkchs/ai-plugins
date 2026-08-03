---
description: OS별 시스템 hosts 파일 조회·수정 (macOS/Linux /etc/hosts · Windows drivers\etc\hosts)
argument-hint: [예: add myapp.local 127.0.0.1 | remove myapp.local | list]
---

`host` 스킬을 사용해 진행한다. 스킬의 절차를 건너뛰지 말고 순서대로 따른다.

사용자가 전달한 요청:
$ARGUMENTS

시스템 파일이다. 수정 전 백업하고 diff를 보여주고 승인을 받는다.
비어 있으면 현재 hosts 파일을 먼저 조회해 보여주고 무엇을 바꿀지 묻는다.
