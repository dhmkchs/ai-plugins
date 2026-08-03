---
name: host
description: >
  OS별 시스템 hosts 파일(로컬 도메인 → IP 매핑)을 조회·추가·삭제·토글한다. macOS/Linux는
  `/etc/hosts`, Windows는 `C:\Windows\System32\drivers\etc\hosts`. Use for local dev domain
  mapping — "hosts 파일 수정", "로컬 도메인 추가", "127.0.0.1 myapp.local 매핑", "hosts에 추가해줘",
  "이 도메인 로컬로 돌려줘", "etc hosts 봐줘", "hosts 파일 어디", "hosts 되돌려줘". 시스템 파일이라
  수정 전 백업하고 diff를 보여주고 승인을 받는다. 프로덕션 도메인을 로컬로 돌리는 매핑은 특히 확인한다.
---

# Host

로컬 개발에서 `myapp.local` 같은 도메인을 `127.0.0.1`로 보내려면 OS의 hosts 파일을 고친다.
이 파일은 **시스템 파일**이고 DNS 해석을 바꾼다. 잘못 건드리면 인터넷·사내 서비스 접속이 끊긴다.
그래서 이 스킬은 항상 **읽기 → 백업 → diff → 승인 → 쓰기** 순서를 지킨다.

## 0. OS 감지 — 경로와 권한이 다르다

```bash
case "$(uname -s 2>/dev/null)" in
  Darwin) HOSTS=/etc/hosts;                                       SUDO=sudo ;;   # macOS
  Linux)  HOSTS=/etc/hosts;                                       SUDO=sudo ;;   # Linux/WSL
  *)      HOSTS="$SYSTEMROOT/System32/drivers/etc/hosts";         SUDO= ;;       # Windows (Git Bash 등)
esac
echo "OS=$(uname -s) HOSTS=$HOSTS"
```

| OS | 경로 | 권한 |
|---|---|---|
| macOS / Linux | `/etc/hosts` | `sudo` 필요 (root 소유) |
| Windows | `C:\Windows\System32\drivers\etc\hosts` | **관리자 권한** PowerShell/편집기 |

`uname`이 없거나 `MINGW`/`MSYS`/`CYGWIN`이면 Windows로 본다. 확신이 안 서면 사용자에게 OS를 묻는다.

## 1. 조회 — 먼저 현재 상태를 본다

수정 전에 항상 읽는다. 무엇이 이미 있는지 모르고 고치지 않는다.

```bash
cat "$HOSTS"                              # 전체
grep -nE '^\s*[0-9a-fA-F:.]+\s' "$HOSTS"  # 주석 아닌 실제 매핑만, 줄번호와
```

특정 도메인이 이미 매핑돼 있는지:

```bash
grep -nw "myapp.local" "$HOSTS" || echo "매핑 없음"
```

## 2. 관리 영역 — 마커 블록으로 격리

이 스킬이 넣는 항목은 **마커 블록 안**에만 둔다. 사용자가 손으로 넣은 줄이나 OS 기본 항목
(`127.0.0.1 localhost`, `::1 localhost`)은 절대 건드리지 않는다.

```
# >>> work managed (수동 편집 금지 — /work:host 가 관리)
127.0.0.1   myapp.local
127.0.0.1   api.myapp.local
# <<< work managed
```

블록이 없으면 파일 끝에 새로 만든다. 있으면 그 안에서만 추가/삭제한다.

## 3. 안전 점검 — 쓰기 전에 반드시

- **백업**: 매 수정 전 타임스탬프 사본을 남긴다.
  ```bash
  $SUDO cp "$HOSTS" "$HOSTS.bak.$(date +%Y%m%d-%H%M%S)"
  ```
- **IP 검증**: 추가하는 IP가 형식에 맞나 (`127.0.0.1`, `::1`, 사설망 등). 임의 공인 IP로 보내는 매핑은 확인받는다.
- **위험 매핑 경고**: 진짜 서비스 도메인(은행·회사 SSO·`*.com` 실서비스)을 로컬/임의 IP로 돌리는 건
  피싱·MITM에 쓰일 수 있다. 로컬 개발용(`*.local`, `*.test`, `localhost` 서브도메인)이 아니면
  **왜 필요한지 확인하고 진행 여부를 명시적으로 승인받는다.** 애매하면 하지 않는다.
- **localhost 보존**: `127.0.0.1 localhost` / `::1 localhost` 줄을 지우거나 바꾸지 않는다.

## 4. diff → 승인 → 쓰기

새 내용을 임시 파일로 만들고 **diff를 보여준 뒤** 승인받아 쓴다. 인플레이스로 바로 쓰지 않는다.

```bash
# 1) 현재 파일을 임시로 복사해 편집
cp "$HOSTS" /tmp/hosts.new     # Windows Git Bash면 임시 경로만 바꾼다
#   → /tmp/hosts.new 의 마커 블록 안에서만 추가/삭제 (Edit 도구로)

# 2) 무엇이 바뀌는지 보여준다
diff -u "$HOSTS" /tmp/hosts.new || true
```

승인받은 뒤에만 반영한다.

```bash
# macOS / Linux — sudo 필요
$SUDO cp /tmp/hosts.new "$HOSTS"
# sudo가 비대화형으로 막히면 사용자에게 직접 실행하도록 안내:
#   ! sudo cp /tmp/hosts.new /etc/hosts
```

Windows는 **관리자 권한**이 필요하다. 비관리자 셸에서는 쓰기가 조용히 실패하거나 거부된다.
관리자 PowerShell에서 실행하도록 안내한다:

```powershell
Copy-Item $env:SystemRoot\System32\drivers\etc\hosts.new $env:SystemRoot\System32\drivers\etc\hosts -Force
```

## 5. 반영 확인 · 캐시 플러시

```bash
grep -nw "myapp.local" "$HOSTS"   # 들어갔나
getent hosts myapp.local 2>/dev/null || ping -c1 myapp.local   # 해석되나 (Linux/macOS)
```

DNS 캐시 때문에 바로 안 잡히면 플러시한다.

| OS | 플러시 |
|---|---|
| macOS | `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` |
| Linux (systemd) | `sudo resolvectl flush-caches` (또는 `systemd-resolve --flush-caches`) |
| Windows (관리자) | `ipconfig /flushdns` |

## 6. 되돌리기

- 방금 수정을 되돌리려면 3절 백업으로 복원한다.
  ```bash
  ls -t "$HOSTS".bak.* | head -1              # 가장 최근 백업
  $SUDO cp "<그 백업>" "$HOSTS"
  ```
- 관리 영역만 통째로 비우려면 마커 블록(`# >>> work managed` ~ `# <<< work managed`)을 지운다.
  마커 밖 줄은 그대로 둔다.

## 보고

무엇을 추가/삭제했는지, 백업 경로, 캐시 플러시 여부, (Windows·sudo) 사용자가 직접 실행해야 하는 명령을
한 줄로 요약한다. 위험 매핑을 승인 없이 넣지 않았음을 확인한다.
