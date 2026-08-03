# 설치 안내

이 저장소는 **마켓플레이스**다. 안에 `work` 플러그인이 들어 있고,
Claude Code(CLI)와 Cowork(데스크톱 앱) 양쪽에서 쓸 수 있다.

```
work-marketplace/
├── .claude-plugin/
│   └── marketplace.json      ← 카탈로그 (마켓플레이스 정의)
├── plugins/
│   └── work/
│       ├── .claude-plugin/
│       │   └── plugin.json   ← 플러그인 정의
│       └── skills/           ← 스킬 7종
└── INSTALL.md
```

---

## Claude Code (CLI)

### 1. 로컬 경로로 설치 — 혼자 쓸 때

```bash
claude plugin marketplace add ~/Documents/work-kit/work-marketplace
claude plugin install work@my-plugins
```

Claude Code 세션 안에서는 슬래시 커맨드로도 같다.
```
/plugin marketplace add ~/Documents/work-kit/work-marketplace
/plugin install work@my-plugins
```

확인:
```bash
claude plugin list
# > work@my-plugins   Version: 0.2.0   Scope: user   Status: enabled
```

스킬은 `work:bug-hunt`, `work:browser-check` 형태로 등록된다.

> **로컬 경로 설치는 심볼릭이 아니라 등록이다.** 마켓플레이스 폴더를 옮기거나 지우면
> 플러그인이 깨진다. 계속 쓸 자리에 두고 등록한다.

### 2. Git 저장소로 배포 — 팀과 공유할 때

이 폴더를 그대로 저장소로 만들어 푸시한다.

```bash
cd work-marketplace
git init && git add -A && git commit -m "chore: work 플러그인 마켓플레이스"
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```

팀원은 한 줄로 설치한다.
```bash
claude plugin marketplace add <org>/<repo>
claude plugin install work@my-plugins
```

업데이트를 배포하려면 `plugin.json`의 `version`과 `marketplace.json`의 `version`을
같이 올리고 푸시한다. 팀원은:
```bash
claude plugin marketplace update my-plugins
```

### 3. 프로젝트 단위 자동 설정 — 저장소를 여는 모두에게

프로젝트의 `.claude/settings.json`에 선언하면 별도 설치 없이 적용된다.

```json
{
  "extraKnownMarketplaces": {
    "my-plugins": {
      "source": {
        "source": "github",
        "repo": "<org>/<repo>"
      }
    }
  },
  "enabledPlugins": {
    "work@my-plugins": true
  }
}
```

로컬 경로로 쓸 때의 형식은 이렇다. **문서의 짧은 문자열 형태(`"source": "./plugins"`)가 아니라
아래 객체 형태로 써야 한다** — CLI가 실제로 기록하는 형식이 이것이다.

```json
{
  "extraKnownMarketplaces": {
    "my-plugins": {
      "source": {
        "source": "directory",
        "path": "/Users/<사용자>/Documents/work-kit/work-marketplace"
      }
    }
  },
  "enabledPlugins": { "work@my-plugins": true }
}
```

절대 경로라 팀 공유에는 맞지 않는다. **팀에 공유할 거면 git 저장소 방식(2번)을 쓴다.**

### 확인 · 업데이트 · 제거

```bash
claude plugin marketplace list              # 등록된 마켓플레이스
claude plugin list                          # 설치된 플러그인
claude plugin validate .                    # 이 마켓플레이스 검증
claude plugin validate plugins/work         # 플러그인 단독 검증
claude plugin marketplace update my-plugins # 최신으로 갱신
claude plugin marketplace remove my-plugins # 제거
```

플러그인을 고친 뒤 세션에 반영하려면 `/reload-plugins`.

---

## 플러그인 없이 스킬만 쓰기

플러그인 관리가 번거로우면 스킬 폴더만 복사해도 동작한다.

```bash
# 개인 — 모든 프로젝트에서
mkdir -p ~/.claude/skills
cp -R plugins/work/skills/* ~/.claude/skills/

# 프로젝트 — 이 저장소에서만 (팀과 커밋으로 공유)
mkdir -p .claude/skills
cp -R plugins/work/skills/* .claude/skills/
```

**차이 한 가지**: 이렇게 넣으면 네임스페이스가 없어져 `bug-hunt`, `browser-check`로 노출된다.
다른 스킬과 이름이 겹칠 수 있고, 어느 세트에서 온 스킬인지 구분되지 않는다.
계속 쓸 거면 플러그인 방식이 낫다.

---

## Cowork (데스크톱 앱)

`work.plugin` 파일을 대화창에 올려 설치 버튼을 누른다.
`.plugin`은 `plugins/work/` 내용을 그대로 zip으로 묶은 것이다. 다시 만들려면:

```bash
cd plugins/work && zip -r ../../work.plugin . -x "*.DS_Store"
```

### 양쪽에서 같이 쓸 때

Claude Code와 Cowork는 플러그인 저장소를 공유하지 않는다. **각각 설치해야 한다.**
Cowork 클라우드 세션은 내 머신의 `~/.claude/skills/`를 읽지 않는다는 점도 같은 이유다.

버전이 갈리지 않게 하려면 이 마켓플레이스 폴더를 단일 원본으로 두고,
Cowork용 `.plugin`은 항상 위 명령으로 다시 만들어 쓴다.

---

## 문제가 생기면

| 증상 | 원인 · 대응 |
|---|---|
| `marketplace add` 실패 | 경로에 `.claude-plugin/marketplace.json`이 있는지 확인. `claude plugin validate <경로>` |
| 설치는 됐는데 스킬이 안 보임 | `/reload-plugins`, 그래도 안 되면 세션 재시작 |
| 스킬이 두 벌 보임 | 같은 스킬을 플러그인 + `~/.claude/skills/` 양쪽에 넣었다. 한쪽을 지운다 |
| 폴더를 옮긴 뒤 깨짐 | `marketplace remove` 후 새 경로로 다시 `add` |
| 팀원만 설치 실패 | 저장소 접근 권한, 그리고 `marketplace.json`이 커밋됐는지 확인 |
