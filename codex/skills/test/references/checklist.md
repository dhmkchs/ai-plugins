# 스멜 체크리스트

테스트를 넘기기 전에 **쓰거나 고친 테스트 전부**를 이 목록으로 훑는다.
하나라도 걸리면 고치고 다시 훑는다.

- [ ] 이름이 조건 + 행동 + 기대 결과를 말한다 (언어는 저장소 관례)
- [ ] 테스트 하나에 행위 하나. 단정들이 모두 같은 결과를 설명한다. 순서 Act는 순서 자체가 행위일 때만
- [ ] 실제 시간·난수·네트워크·파일시스템 없음. 실행 순서 의존 없음. sleep 없음
- [ ] 행위를 보존하는 리팩터링에도 살아남는다 (private 이름 변경·내부 순서 변경에 안 깨진다)
- [ ] 더블은 내가 소유한 경계에만. 목 메아리 단정 없음
- [ ] 에러 경로와 경계를 덮었다. 정상 경로만 있지 않다
- [ ] 엣지 케이스를 입력별로 도출했다 (분할 → 경계 → 트랩 값 → 거부 → 조합), 관련 없는 건 쳐냈다
- [ ] 실패 출력이 처음 보는 사람에게 무엇이 깨졌는지 말한다
- [ ] 테스트 본문에 분기가 없다
- [ ] 각 테스트가 맞는 레벨에 있다 (로직 → 단위, 배선·접착 → 통합)
- [ ] 비동기는 신호로 기다리고, 시간은 가짜 클럭으로 제어한다
- [ ] **전부 실제로 돌려서 통과를 봤다.** 버그 수정 테스트는 실패하는 것도 봤다
- [ ] 기존 코드에서 발견한 버그는 박제하거나 몰래 고치지 않고 보고했다
- [ ] 프로젝트 관례를 따른다 (러너, 헬퍼, 파일 이름·위치)

---

# 흔한 스멜과 교정

## 목 메아리 — 자기 설정을 검증한다

```
// BEFORE
repo.findById.mockReturnValue({ id: 1 })
svc.get(1)
expect(repo.findById).toHaveBeenCalledWith(1)   // 내가 넣은 값을 내가 확인

// AFTER — 단위가 만든 결과에 단정
repo.findById.mockReturnValue({ id: 1, name: "Ada", deletedAt: "2026-01-01" })
expect(svc.get(1)).toBeNull()                    // 삭제된 사용자는 안 보인다 ← 행위
```

## 조건부 단정 — 테스트가 스스로 판단한다

```
// BEFORE
const res = svc.calc(input)
if (input > 0) expect(res).toBe(1)
else expect(res).toBe(0)

// AFTER — 테이블 테스트로 분리
it.each([[1, 1], [0, 0], [-1, 0]])("입력 %i면 %i를 반환한다", (input, expected) => {
  expect(svc.calc(input)).toBe(expected)
})
```

분기가 있으면 그 테스트가 실제로 무엇을 검증했는지 실행해봐야만 알 수 있다.

## 숨겨진 준비 — 보이지 않는 이유로 통과한다

```
// BEFORE
beforeEach(() => { seedUsers(); seedOrders(); enableFeature("x"); })
it("주문을 취소한다", () => { ... })      // 무엇에 의존하는지 본문에 없다

// AFTER — 이 행위에 필요한 것만, 본문에서
it("배송 전 주문 → 취소하면 환불이 예약된다", () => {
  const order = anOrder({ status: "PAID", shippedAt: null })
  ...
})
```

## 통짜 스냅샷 — 모든 변경에 실패한다

```
// BEFORE
expect(renderPage(data)).toMatchSnapshot()

// AFTER — 계약만
expect(screen.getByRole("heading")).toHaveTextContent("주문 내역")
expect(screen.getAllByRole("row")).toHaveLength(3)
```

## sleep 대기 — 느리고 flaky

```
// BEFORE
await new Promise(r => setTimeout(r, 1000))
expect(retryCount).toBe(3)

// AFTER — 가짜 클럭을 명시적으로 진행
vi.useFakeTimers()
const p = client.callWithRetry()
await vi.advanceTimersByTimeAsync(1000)
await p
expect(transport.attempts).toBe(3)
```

## 삼킨 비동기 실패 — 엉뚱한 이유로 통과한다

```
// BEFORE — await 없음. 거절해도 테스트는 초록
it("실패하면 예외를 던진다", () => {
  expect(svc.load()).rejects.toThrow()
})

// AFTER
it("응답이 500이면 UpstreamError를 던진다", async () => {
  await expect(svc.load()).rejects.toThrow(UpstreamError)
})
```

## 과잉 정확 단정 — 무해한 변경에 깨진다

```
// BEFORE
expect(res.body.message).toBe("이메일이 이미 사용 중입니다. 다른 주소를 입력해 주세요.")

// AFTER — 계약은 코드다. 문구는 계약이 아니다
expect(res.status).toBe(409)
expect(res.body.code).toBe("DUPLICATE_EMAIL")
```

## 비활성 테스트 — 있는 척하는 빈자리

`skip`·`only`·주석 처리된 테스트는 커밋에 남기지 않는다.
`start`가 커밋 전에, `review`가 PR 전에 이걸 잡는다.
정말 남겨야 하면 **이유와 티켓 번호**를 주석으로 붙인다.

```
// TODO(PROJ-140): 기존 중복 데이터 47건 정리 후 활성화
it.skip("동시 요청에서도 중복 계정이 생기지 않는다", ...)
```
