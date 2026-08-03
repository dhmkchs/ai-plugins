# 티켓 유형별 작성 패턴

## 버그

제목은 **증상**으로 쓴다. 원인을 안다고 생각해도 제목에 박지 않는다 — 대개 틀린다.

```
제목: 로그인 후 첫 요청에서 간헐적으로 500이 반환됨

## 문제
로그인 직후 대시보드 진입 시 약 10% 확률로 500이 반환된다.
재시도하면 정상. 서버 로그에 NullPointerException (UserContext.getTenant).

## 재현
1. 로그아웃 상태에서 /login 진입
2. 정상 계정으로 로그인
3. 리다이렉트된 /dashboard 에서 네트워크 탭 확인
기대: 200   실제: 약 10% 확률로 500

## 영향
전체 로그인의 약 10%. 사용자는 새로고침으로 우회 가능하나 첫인상이 나쁨.
2026-07-28 배포 이후 발생 (그 전 로그에는 없음).

## 완료 조건
- [ ] 위 재현 절차를 100회 반복해 500이 0건
- [ ] 원인을 재현하는 회귀 테스트 추가
- [ ] 같은 패턴(UserContext 초기화 이전 접근)이 다른 곳에 있는지 확인 결과 기록

## 범위 밖
- 대시보드 성능 개선
- UserContext 전반 리팩터링

## 참고
스택트레이스: <링크>  /  발생 시작 배포: <커밋>
```

**간헐적 버그는 "간헐적"이라고 쓰고 관찰된 빈도를 숫자로 적는다.** 이게 재현 전략을 정한다.

## 기능

```
제목: 가입 시 중복 이메일을 거부한다

## 문제
현재 같은 이메일로 계정이 여러 개 생성된다. 로그인 시 어느 계정으로 붙을지 비결정적이고,
비밀번호 재설정 메일이 잘못된 계정으로 간다.

## 영향
현재 중복 계정 47건(2026-07-30 기준 쿼리). 고객문의 월 3~4건.

## 완료 조건
- [ ] 이미 존재하는 이메일로 가입 시 409와 코드 DUPLICATE_EMAIL 반환
- [ ] 대소문자가 달라도 같은 이메일로 취급 (A@b.com == a@b.com)
- [ ] 동시 요청에서도 중복이 생기지 않음
- [ ] 기존 중복 데이터 처리 방침이 문서화됨 (정리는 별도 티켓)

## 범위 밖
- 기존 중복 데이터 정리 (→ 별도 티켓)
- 이메일 인증(verification) 플로우

## 참고
중복 계정 조회 쿼리: <링크>
```

기능 티켓에서 가장 자주 비는 건 **동시성 조건**과 **기존 데이터 처리**다. 둘 다 나중에 반드시 문제가 된다.

## 리팩터링 / 기술 부채

리팩터링 티켓은 **왜 지금인지**가 없으면 영원히 안 된다. 트리거를 쓴다.

```
제목: OrderService의 트랜잭션 경계를 서비스 계층으로 정리

## 문제
현재 컨트롤러에 @Transactional이 붙어 있어 응답 직렬화까지 트랜잭션에 포함된다.
커넥션 점유 시간이 길고, 지연 로딩 예외가 응답 단계에서 터진다.

## 왜 지금
다음 스프린트의 주문 분할 기능이 이 경계를 그대로 확장해야 한다.
지금 정리하지 않으면 같은 문제가 세 곳으로 늘어난다.

## 완료 조건
- [ ] @Transactional이 서비스 계층에만 존재
- [ ] 기존 테스트 전부 통과 (동작 변경 없음)
- [ ] 커넥션 점유 시간 측정값 before/after 기록

## 범위 밖
- 쿼리 최적화
- 도메인 모델 변경
```

**"동작 변경 없음"을 완료 조건에 명시**하는 게 핵심이다. 리팩터링 티켓이 기능 변경을 끌고 들어오는 걸 막는다.

## 장애 대응 (사후)

장애 중에는 티켓을 쓰지 않는다. 수습 후에 쓴다.

```
제목: [장애] 2026-07-30 결제 API 12분 중단 — 후속 조치

## 무슨 일이
14:02~14:14 결제 API 5xx. 원인: 커넥션 풀 고갈.
직접 원인은 배치 작업이 커넥션을 반환하지 않은 것.

## 임시 조치 (완료)
배치 중단 후 애플리케이션 재시작. 14:14 복구.

## 완료 조건 (재발 방지)
- [ ] 배치의 커넥션 반환 누락 지점 수정
- [ ] 커넥션 풀 사용률 알람 추가 (80% 임계)
- [ ] 같은 패턴이 다른 배치에 있는지 점검 결과 기록

## 범위 밖
- 결제 API 전반의 회복탄력성 개선 (→ 별도 에픽)
```

**임시 조치와 재발 방지를 분리한다.** 섞으면 임시 조치로 티켓이 닫히고 재발한다.

---

## 자주 쓰는 JQL

```sql
-- 중복 확인 (생성 전 필수)
project = PROJ AND text ~ "중복 이메일" AND statusCategory != Done ORDER BY updated DESC

-- 내가 지금 잡고 있는 것
assignee = currentUser() AND statusCategory = "In Progress" ORDER BY updated DESC

-- 이번 스프린트 미완료
project = PROJ AND sprint IN openSprints() AND statusCategory != Done

-- 최근 2주 내가 만든 것
reporter = currentUser() AND created >= -14d ORDER BY created DESC

-- 특정 컴포넌트의 열린 버그
project = PROJ AND component = "payments" AND type = Bug AND statusCategory != Done

-- 라벨로
project = PROJ AND labels IN ("tech-debt") AND statusCategory != Done

-- 오래 방치된 것 (정리 대상)
project = PROJ AND statusCategory != Done AND updated <= -60d ORDER BY updated ASC
```

`statusCategory != Done`을 쓴다. `status != Done`은 팀마다 상태 이름이 달라서 빠뜨린다.

## 필드 값을 모를 때

추측하지 말고 조회한다.

```
getVisibleJiraProjects               쓸 수 있는 프로젝트
getJiraProjectIssueTypesMetadata     그 프로젝트의 이슈 타입 (Bug/작업/스토리… 팀마다 다름)
getJiraIssueTypeMetaWithFields       필수 필드 + allowedValues (커스텀 필드 포함)
lookupJiraAccountId                  담당자 accountId (이름 문자열로는 지정 안 됨)
getIssueLinkTypes                    링크 타입 (Blocks, Relates 등)
getTransitionsForJiraIssue           그 이슈에서 지금 가능한 전이
```

특히 `getJiraIssueTypeMetaWithFields`는 **필수 커스텀 필드**를 알려준다.
이걸 건너뛰면 "field 'customfield_10021' is required" 같은 오류로 생성이 실패한다.
