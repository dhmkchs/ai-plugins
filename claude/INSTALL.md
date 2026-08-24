# 설치 안내

이 저장소(`dhmkchs/ai-plugins`)는 Claude Code **마켓플레이스**다. 안에 `work` 플러그인(스킬 21종)이
들어 있고, Claude Code(CLI)와 Cowork(데스크톱 앱) 양쪽에서 쓸 수 있다.

마켓플레이스 카탈로그(`.claude-plugin/marketplace.json`)는 **저장소 루트**에 있고, 플러그인 실체는
`claude/plugins/work` 아래에 있다. 카탈로그의 `source`가 `./claude/plugins/work`를 가리킨다.

```
ai-plugins/
├── .claude-plugin/
│   └── marketplace.json      ← 카탈로그 (마켓플레이스 이름: dhmkchs)
└── claude/
    └── plugins/
        └── work/
            ├── .claude-plugin/plugin.json   ← 플러그인 정의 (work, v0.8.0)
            ├── commands/                     ← 슬래시 커맨드 21종
            └── skills/                       ← 스킬 21종
```

---

## Claude Code (CLI)

### 1. GitHub 저장소로 설치 — 권장

```bash
claude plugin marketplace add dhmkchs/ai-plugins
claude plugin install work@dhmkchs
```

세션 안에서는 슬래시 커맨드로도 같다.
```
/plugin marketplace add dhmkchs/ai-plugins
/plugin install work@dhmkchs
```

확인:
```bash
claude plugin list
# > work@dhmkchs   Version: 0.8.0   Scope: user   Status: enabled
```

스킬은 `work:ticket`, `work:review`처럼 `work:` 네임스페이스로 등록된다.
비공개 저장소면 설치하는 쪽이 읽기 권한(SSH 키 또는 토큰)을 가지고 있어야 한다.

### 2. 로컬 경로로 설치 — 개발·수정할 때

카탈로그가 있는 **저장소 루트**를 등록한다 (`claude/`가 아니라 루트).

```bash
claude plugin marketplace add ~/Documents/GitHub/ai-plugins
claude plugin install work@dhmkchs
```

> **로컬 경로 설치는 심볼릭이 아니라 등록이다.** 폴더를 옮기거나 지우면 깨진다.
> 옮겼다면 `marketplace remove dhmkchs` 후 새 경로로 다시 `add`.

### 3. 프로젝트 단위 자동 설정 — 저장소를 여는 모두에게

프로젝트의 `.claude/settings.json`에 선언하면 팀원이 별도 설치 없이 쓴다.

```json
{
  "extraKnownMarketplaces": {
    "dhmkchs": {
      "source": {
        "source": "github",
        "repo": "dhmkchs/ai-plugins"
      }
    }
  },
  "enabledPlugins": {
    "work@dhmkchs": true
  }
}
```

로컬 경로로 쓸 때는 `source`를 아래 객체 형태로 쓴다 (CLI가 실제로 기록하는 형식).
절대 경로라 팀 공유에는 맞지 않으니, 공유하려면 위 github 방식을 쓴다.

```json
{
  "extraKnownMarketplaces": {
    "dhmkchs": {
      "source": {
        "source": "directory",
        "path": "/Users/<사용자>/Documents/GitHub/ai-plugins"
      }
    }
  },
  "enabledPlugins": { "work@dhmkchs": true }
}
```

### 확인 · 업데이트 · 제거

```bash
claude plugin marketplace list              # 등록된 마켓플레이스
claude plugin list                          # 설치된 플러그인
claude plugin validate .                    # 저장소 루트에서 마켓플레이스 검증
claude plugin validate claude/plugins/work  # 플러그인 단독 검증
claude plugin marketplace update dhmkchs    # 카탈로그 최신으로 갱신
claude plugin marketplace remove dhmkchs    # 제거
```

플러그인을 고친 뒤 세션에 반영하려면 `/reload-plugins`.

> **버전 갱신에는 재설치가 필요하다.** `marketplace update`만으로는 안 올라간다.
> ```bash
> claude plugin marketplace update dhmkchs
> claude plugin uninstall work@dhmkchs
> claude plugin install work@dhmkchs
> ```
> 새 버전을 배포하려면 `plugin.json`과 루트 `marketplace.json`의 `version`을 같이 올리고 push한다.

---

## 플러그인 없이 스킬만 쓰기

플러그인 관리가 번거로우면 스킬 폴더만 복사해도 동작한다.

```bash
# 개인 — 모든 프로젝트에서
mkdir -p ~/.claude/skills
cp -R claude/plugins/work/skills/* ~/.claude/skills/

# 프로젝트 — 이 저장소에서만 (팀과 커밋으로 공유)
mkdir -p .claude/skills
cp -R claude/plugins/work/skills/* .claude/skills/
```

> **차이 한 가지**: 이렇게 넣으면 네임스페이스(`work:`)가 없어져 `debug`, `browser`처럼 노출된다.
> 다른 스킬과 이름이 겹칠 수 있고 어느 세트에서 왔는지 구분되지 않는다. 계속 쓸 거면 플러그인 방식이 낫다.

---

## Cowork (데스크톱 앱)

`work.plugin` 파일을 대화창에 올려 설치 버튼을 누른다.
`.plugin`은 `claude/plugins/work/` 내용을 그대로 zip으로 묶은 것이다. 다시 만들려면:

```bash
cd claude/plugins/work && zip -r ../../../work.plugin . -x "*.DS_Store"
```

Claude Code와 Cowork는 플러그인 저장소를 공유하지 않는다. **각각 설치한다.**
Cowork 클라우드 세션은 내 머신의 `~/.claude/skills/`를 읽지 않는 것도 같은 이유다.
버전이 갈리지 않게, 이 저장소를 단일 원본으로 두고 `.plugin`은 항상 위 명령으로 다시 만든다.

---

## 문제가 생기면

| 증상 | 원인 · 대응 |
|---|---|
| `marketplace add` 실패 | 저장소 **루트**에 `.claude-plugin/marketplace.json`이 있는지 확인. `claude plugin validate .` |
| 설치는 됐는데 스킬이 안 보임 | `/reload-plugins`, 그래도 안 되면 세션 재시작 |
| 스킬이 두 벌 보임 | 같은 스킬을 플러그인 + `~/.claude/skills/` 양쪽에 넣었다. 한쪽을 지운다 |
| 폴더를 옮긴 뒤 깨짐 | `marketplace remove dhmkchs` 후 새 경로로 다시 `add` |
| 팀원만 설치 실패 | 저장소 접근 권한, `marketplace.json`이 커밋됐는지 확인 |
