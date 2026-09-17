# 골프 스코어 (Simple Golf Score Card)

라운드 중 **홀당 두 번의 터치**로 기록하고, 나머지 통계는 계산으로 유도하는 개인용 골프 스코어 웹앱.

## 이 앱의 설계 전제

사용자는 **핸디캡 10 이하, 베스트 73타**의 싱글 골퍼다. 초보용 앱이 아니다.
이전에 만든 앱은 입력 항목이 많아 게임에 집중할 수 없어서 실패했다. 그래서 다음이 절대 원칙이다.

- **입력은 타수 + 퍼트 두 가지뿐.** 항목을 추가하자는 요구가 나오면 먼저 "계산으로 유도할 수 없는가"를 따진다
- 그린 적중(GIR), 스크램블링, 3퍼트는 **입력받지 않는다.** `타수 - 퍼트 <= 파 - 2` 로 GIR이 나오고 나머지가 따라 나온다
- 티샷 방향과 벌타는 **접혀 있는 선택 항목**이다. 안 눌러도 통계가 깨지면 안 된다
- 컨시드(OK)는 그냥 1퍼트로 센다. 별도로 기록하지 않는다
- 홀 난이도(핸디캡)는 저장하지 않는다. 홀별 누적 성적으로 대체한다

## 기술 구성

빌드 도구 없음. 프레임워크 없음. 정적 파일 그대로 배포한다.

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 셸. 상단바와 `#view` 하나뿐 |
| `storage.js` | localStorage 읽기/쓰기. 골프장·코스·라운드 |
| `app.js` | 화면 전환과 모든 화면의 그리기 |
| `boot.js` | 첫 화면 그리기 + 서비스워커 등록. **반드시 마지막에 로드** |
| `sw.js` | 오프라인 캐시 |
| `style.css` | 스타일 |

### 화면 구조

`screens.<이름>` 함수가 `{ title, html, action?, after? }` 를 돌려주면 `render()` 가 그린다.
클릭은 전부 `data-act` 속성으로 `actions.<이름>` 에 연결된다. 개별 addEventListener를 쓰지 않는다.

화면: `home` `clubs` `club` `course` `newRound` `play` `card` `summary` `settings`

### 데이터 구조

```
골프장 = { id, name, courses: [ { id, name, pars: [9] } ] }
라운드 = { id, date, clubId, clubName,
           front: {courseId, name, pars}, back: {...}|null,
           holes: [ { par, strokes, putts, tee, penalty } ],
           currentHole, finished }
```

- **코스는 9홀 단위로만 등록한다.** 18홀짜리 코스는 `크리크 OUT`, `크리크 IN` 처럼 둘로 나눠 넣는다
- 라운드를 만들 때 코스 이름과 파 배치를 **복사해서 넣는다(스냅샷)**. 나중에 코스 설정을 고쳐도 지난 기록은 변하지 않는다
- 파생 통계(GIR, 스크램블링 등)는 **저장하지 않는다.** 계산식을 고치면 과거 라운드에 소급 적용되어야 하기 때문

## 수정 워크플로우

```bash
cd "/Users/seungwon/Claude Vibe Coding Outputs/Simple Golf Score Card"
python3 -m http.server 8765    # http://localhost:8765 에서 확인
```

배포:

```bash
git add -A && git commit -m "설명" && git push
```

## 함정

- **`sw.js` 의 `CACHE` 이름을 올리지 않으면 폰에 옛 버전이 남는다.** 파일을 고쳐 배포할 때마다 `golf-score-v1` → `v2` 로 숫자를 올린다
- `boot.js` 는 `index.html` 에서 항상 마지막에 로드해야 한다. `render()` 가 화면 등록보다 먼저 돌면 안 된다
- 새 화면을 추가할 때는 `screens` 와 `actions` 양쪽에 등록한다
- localStorage는 **기기 안에만** 있다. 서버 동기화가 없으므로 백업은 설정 화면의 내보내기가 유일하다

## 남은 작업 (2단계)

1단계(입력 + 저장 + 배포)는 완료. 실제 라운드에서 입력 속도를 검증한 뒤 아래를 붙인다.

- 파생 통계: 그린 적중률, GIR 시 평균 퍼트, 스크램블링, 3퍼트, 파3/4/5별 평균
- 전반 vs 후반 비교, 코스별·홀별 누적 성적
- 타수 손실 분해 (퍼팅 / 숏게임 / 아이언 / 티샷)
- 클로드 붙여넣기용 라운드 요약 텍스트 → `~/Downloads/golf-round-analysis.skill` 의 분석 스킬과 연결.
  그 스킬은 총타수 수준의 거친 입력을 전제로 쓰여 있으므로, 홀별 데이터를 받도록 입력 규격을 함께 고쳐야 한다
