# 실행 실패와 오진단

## 실행이 아예 안 될 때

### `Executable doesn't exist at .../chrome-headless-shell`

패키지 버전과 설치된 브라우저 빌드가 어긋났다. 가장 흔한 실패다.

```bash
npx playwright install chromium        # 정석
npx playwright install --with-deps     # 리눅스에서 시스템 라이브러리까지
```

브라우저를 새로 내려받을 수 없는 환경(샌드박스, 오프라인, 사내 프록시)이면
기존 바이너리를 직접 지정한다.

```javascript
chromium.launch({ executablePath: process.env.PW_CHROME })
```
```bash
PW_CHROME=/path/to/chrome node check.mjs http://localhost:3000
```

`PLAYWRIGHT_BROWSERS_PATH`가 설정된 환경에서는 그 아래를 먼저 확인한다.
```bash
echo $PLAYWRIGHT_BROWSERS_PATH; ls $PLAYWRIGHT_BROWSERS_PATH
```

### `browserType.launch: Host system is missing dependencies`

```bash
npx playwright install-deps chromium     # 또는
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2
```

### 컨테이너/CI에서 즉시 죽는다

```javascript
chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
```
`--disable-dev-shm-usage`가 없으면 `/dev/shm`이 작은 컨테이너에서 무작위로 크래시한다.

### `npx playwright --version`과 `package.json`이 다르다

전역 설치와 프로젝트 설치가 섞였다. 항상 프로젝트 것을 쓴다.
```bash
./node_modules/.bin/playwright --version
```

---

## 셀렉터가 안 잡힐 때

### 한글 텍스트로 못 찾는다 → **먼저 charset을 확인한다**

```javascript
console.log(await page.evaluate(() => document.characterSet));
```

`windows-1252`나 `ISO-8859-1`이 나오면 문서에 `<meta charset="utf-8">`이 없거나
서버가 `Content-Type: text/html; charset=utf-8`을 보내지 않는 것이다.
브라우저가 한글을 깨뜨려 읽으므로 `getByRole('button', { name: '가입' })`은 영원히 실패한다.

**이건 셀렉터 문제가 아니라 실제 버그다.** 사용자 화면에서도 깨져 보인다. 문서·서버 설정을 고친다.

### role/이름을 추측하지 않는다

```javascript
console.log(await page.locator('body').ariaSnapshot());          // 전체
console.log(await page.locator('form').ariaSnapshot());          // 일부
console.log(await page.getByRole('button').allTextContents());   // 버튼 목록
```

접근 가능한 이름은 화면 텍스트와 다를 수 있다 (`aria-label`이 우선한다).

### 요소가 있는데 클릭이 안 된다

| 원인 | 확인 |
|---|---|
| 다른 요소가 위를 덮고 있다 | `await page.locator('sel').screenshot()` 또는 trace |
| 애니메이션 중 이동한다 | `reducedMotion: 'reduce'` |
| iframe 안에 있다 | `page.frameLocator('#iframe').getByRole(...)` |
| Shadow DOM | Playwright는 기본 관통한다. 안 되면 `>>` 조합 |
| `disabled` 상태 | `await expect(loc).toBeEnabled()`로 먼저 확인 |
| 화면 밖 | `await loc.scrollIntoViewIfNeeded()` |

### 여러 개가 잡힌다 (`strict mode violation`)

에러 메시지가 잡힌 요소를 모두 보여준다. **그걸 읽고 좁힌다.**
`.first()`로 덮는 것은 순서 의존을 만들어 나중에 조용히 틀린 요소를 검증한다.

---

## 결과를 잘못 판정할 때

### 콘솔 에러가 내 변경 때문인지 모르겠다

변경 전 상태에서 한 번 더 돌려 비교한다. 30초짜리 확실한 방법이다.
```bash
node check.mjs http://localhost:3000/page > after.txt
git stash && node check.mjs http://localhost:3000/page > before.txt && git stash pop
diff before.txt after.txt
```

### 노이즈가 너무 많다

`check.mjs`의 `IGNORE` 배열에 추가하거나 실행 시 지정한다.
```bash
node check.mjs http://localhost:3000 --ignore "analytics|hotjar|sentry|third-party"
```

**단, 무엇을 걸렀는지 항상 출력에 남긴다** (`IGNORED AS NOISE`).
조용히 거르면 진짜 에러를 거른 것을 알 수 없다.

### 로컬은 되는데 CI는 실패한다

| 원인 | 대응 |
|---|---|
| 서버가 아직 안 떴다 | `webServer` 설정 또는 `wait-on` 사용 |
| 폰트 없음 → 레이아웃 다름 | 스크린샷 비교 대신 aria 스냅샷으로 판정 |
| 타임존·로케일 | `timezoneId`, `locale` 명시 |
| 머신이 느려 타임아웃 | 타임아웃을 늘리기 전에 **무엇을 기다리는지** 명시했는지 확인 |
| 헤드리스에서만 실패 | `--headed`로 재현 시도, 안 되면 trace 확인 |

`@playwright/test`를 쓴다면 서버 기동은 러너에 맡긴다.
```javascript
// playwright.config.ts
webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true }
```

### 간헐적으로 실패한다 (flaky)

거의 항상 원인은 하나다: **고정 대기 또는 대기 누락.**

1. `waitForTimeout`을 전부 제거한다
2. 무엇을 기다리는지 조건으로 명시한다 (`waitForResponse`, `waitFor`, `expect`)
3. 액션 전에 요청 리스너를 먼저 걸었는지 확인한다 (순서가 중요하다)
4. 테스트 간 공유 상태(로그인, DB, 로컬스토리지)를 확인한다
5. 그래도 못 잡으면 trace를 켜고 실패를 재현한다

자세한 진단 절차는 `debug` 스킬의 flaky 체크 항목을 따른다.

---

## 정리 (확인 끝나면)

```bash
# 남은 프로세스·포트 정리 — --headed로 띄웠을 때 자주 남는다
pkill -f "chrome.*--remote-debugging" 2>/dev/null

# 산출물이 커밋되지 않게
cat >> .gitignore <<'EOF'
check-*.png
trace.zip
auth.json
test-results/
playwright-report/
EOF
```

`auth.json`에는 세션 토큰이 들어 있다. **반드시 `.gitignore`에 넣는다.**
