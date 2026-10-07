# 01. 기타 연습 교수법 리서치 (Practice Pedagogy)

> 작성일: 2026-10-07 · 대상: 독학하는 성인 완전 초보 (어쿠스틱 기타) · 목적: 체계적 연습 웹앱 설계 근거
>
> **정책 메모:** 앱은 JustinGuitar 콘텐츠를 링크/임베드하지 않고 **자체 커리큘럼**을 갖는다. 아래 1~4장은 "검증된 교수법이 실제로 어떤 숫자와 규칙을 쓰는지" 조사한 근거 자료이며, 5장 "앱 설계 시사점"은 브랜드에 의존하지 않는 일반 명칭(예: "1분 코드 체인지")으로 재구성한 자체 설계안이다.

## 0. 조사 방법과 신뢰도

- justinguitar.com 은 Cloudflare 봇 차단(HTTP 403)으로 직접 접근이 불가하여, **Internet Archive Wayback Machine 사본**(2025년 스냅샷 기준)의 페이지 내 lesson JSON(`lessonStore`)에서 본문을 추출했다. 따라서 인용문은 원문 그대로이나, 2025~2026년 사이 개정분은 반영되지 않았을 수 있다.
- 사용자가 언급한 영상 "Get FASTER Chord Changes On Guitar!"(`mAgc7hr44WM`)는 YouTube 메타데이터(길이 5:21, 2020-05-11 게시, 챕터: `00:00 1-Minute Exercise - See your progress / 01:30 How to practice your chord changes / 03:00 1-Minute Exercise to practice chord changes`)만 확인했고, 자막은 취득하지 못했다. 영상 고유 발언은 **(미확인)**이며, 동일 주제의 웹 레슨 본문으로 대체했다.
- "exact chord"는 JustinGuitar의 **Chord Perfect Practice**에 해당함을 확인했다(One Minute Changes 레슨 본문: "While the Chord Perfect Practice ... helps you with chord accuracy, the One Minute Changes Exercise is about speed").
- 3장(타 강사 커리큘럼)은 시간 제약으로 1차 출처 검증을 하지 못한 일반 지식이 많다. 해당 항목은 **(미확인)**으로 표시했다.

---

## 1. JustinGuitar 방법론 상세

### 1.1 커리큘럼 구조 (Beginner Guitar Course, Grade 1~3)

Grade = 여러 Module 묶음. 레슨 코드(`b1-1xx` = Module 1, `b1-2xx` = Module 2 …, `b2-8xx` = Module 8, `bg-15xx` = Module 15)로 구조를 복원했다. 모듈 제목은 페이지 사이드바 표기 그대로.

**Grade 1 (Modules 0–7) — 코드 도입 순서: D → A → E → Em → Am → Dm → C → G**

| Module | 제목 | 신규 코드 | 핵심 레슨/연습 |
|---|---|---|---|
| 0 | Before You Begin: Guitar Basics | – | Tuning, How To Hold Your Guitar, **Positive Finger Placement**, Reading Chord Boxes, Holding a Pick, Strumming Without a Pick |
| 1 | A & D Chords: Play Your First Song! | D, A | D chord(+Chord Perfect), A chord, **Anchor Fingers**, **One Minute Changes**, Bars & Strumming On 1, How To Strum The Correct Strings, How To Minimize Finger Pain, Super Easy 2 Chord Songs |
| 2 | Rhythm & Chord Changes + Your First Riff! | E | E Chord Anchors & Tricks, Tapping Your Foot, Strumming Mechanics, Strumming On The Beat, **Chord Changes For One**, Peter Gunn Theme(첫 riff) |
| 3 | Capo, Minor Chords & Up Strums | Em, Am | What Are Minor Chords, Counting "ands", All About Up Strums, **Strumming Patterns With Ups**, Capo, Seven Nation Army |
| 4 | Metronome, Stretches & THE Pattern | Dm | **Beginner Finger Stretches**, **Meet The Metronome**, **THE Strumming Pattern (Old Faithful)**, Reading TAB, Sunshine Of Your Love |
| 5 | Basic Theory & Strumming Development | C | Strumming Tips, Exploring Strumming, Understanding Music Notes, Your Own Songbook, Come As You Are riff |
| 6 | 6:8 Time, Fast Changes & Alternate Picking | G | **Beginner Alternate Picking**, The G Chord… Hacked(2-finger G), Time Signatures, 6/8 Strumming Pattern, Open String Note Names, **Forcing Chord Changes** |
| 7 | Air Changes, Dynamics & Consolidation | (8개 정리) | The 8 Essential Beginner Chord Grips, **Best Chord Changes To Work On**(25쌍), **Air Changes**, Open Strings Between Changes, Feel Good Strumming, Dynamic Improvements, Memorize Easy Songs, Why Do Ear Training, How To Pass Grade 1, Consolidation |

**Grade 2 (Modules 8–14)** — Module 14 연습 페이지에 "And There's Grade 2 Completed"로 명시.

| Module | 제목(확인된 것) | 핵심 내용 |
|---|---|---|
| 8 | Your First Scale, Pick Tricks & 8th Note Strumming | **Stuck 3&4 Chords**(Big G, G5, Cadd9, Dsus4, A7sus4, Em7, Dadd11/F#, F6/9), **Perfect Fast Changes**, Open E Minor Pentatonic, Muting Strings Deliberately, All-Down 8th Note Strumming, Pick Manipulation, Wish You Were Here riff, Notes In Open Position |
| 9 | The F Chord Journey & Pinky Workout | F chord, F Chord Cheats(Fmaj7 등), All Stop Mute, C Major Scale, Ups to the All-Down, **Pinky Workout**, Californication riff, Chords In Keys |
| 10 | (제목 미확인) | Weak Finger G, First Finger A(mini barre), F Chord Changes, Feeling The Frets, Alternate Picking C Major, Major Scale Improvisation, Rhythm Push, Beginner Hammer-ons, La Bamba, 5 Common Chord Progressions |
| 11 | (제목 미확인) | Chord Freedom, Sus Chords, Shifting The F, Re-Active Listening, Fingerstyle First Steps, Happy Birthday fingerstyle, Dice Songwriting |
| 12 | (제목 미확인) | Power Chords(R6/R5), **A Minor Pentatonic**, Palm Muting, Distortion, Enter Sandman, Writing Riffs |
| 13 | (제목 미확인) | Open 7th Chords, Shuffle Grooves, 12 Bar Blues, Beginner Blues Solo, Blues Improv |
| 14 | (제목 미확인) | Essential Slash Chords, **Playing Without Looking**, Thumb Muting, Jamming, Backbeat Hit, Developing Repertoire, Stand Up, Home Recording, Rut-Busting Consolidation |

**Grade 3 (Modules 15–23, 레슨 코드로 추정)** — "Advancing Beginner", 루틴을 스스로 설계하는 단계.
- M15: 6 Guitar Areas You Should Practice, D Chord Shape Explorer, **The Finger Gym**, Linking Chords Using Scales, A Capo For Two, Mindful Listening, Tone, **4 Easy Steps To Transcribing**
- M16: Chord Shapes Up The Neck, Rolling Chords, Greensleeves, Playing a Melody, Flexing Time
- M17: Goals & Destinations, C Shape Explorer, Picking Individual Strings While Strumming, Easy Triads
- M18: **Perfectly Starts Slowly**, Open Tuning, Legato Pentatonics, Triad Chips, Neuroplasticity, Transcribing Open Chords
- M19–23: G Chord Explorer, Learning To Sing, 4/4 Fingerstyle Patterns, **The Spacing Effect**, Lifted Barre, Singing & Playing, Transcribing Riffs, Record Yourself, The Objective Observer, Bridging Beginner→Intermediate Practice Routines, Easy Barre Chords
- 모듈 번호↔레슨 매핑은 레슨 코드 규칙에서의 추정 **(미확인)**.

### 1.2 One Minute Changes (OMC) — 정확한 절차

출처: "One Minute Changes Exercise" (b1-110), "How To PASS Grade 1" (b1-710), "When to move on from Module 1" (b1-118).

- **절차 (원문 3단계)**
  1. "Pick two chords and see how many times you can switch back and forth between them in one minute."
  2. "Your goal is to reach around **60 chord changes per minute**. That's one per second! It'll take you a few sessions to reach your goal — keep track of your results"
  3. "Do this exercise **every time you put a new chord** into your practice routine."
- **품질 무시, 속도/형태 집중:** "if the chords sound a bit wonky as you go through this exercise, don't worry. Our focus here is on getting the fingers into the basic chord shapes fast and on time." → 정확도는 Chord Perfect가 담당.
- **카운트 단위:** Grade 1 통과 기준에서 "30 chord changes in 1 minute. This makes for **2 seconds on each chord**" → 한 코드에서 다른 코드로 **도착할 때마다 1회**(A→D = 1, D→A = 2). 매 변경마다 한 번 스트럼하는지 여부는 영상 확인 불가 **(미확인)**, 일반적으로 도착 시 1회 스트럼으로 알려져 있다.
- **1회 1쌍:** "The key point in this lesson is to focus on **only one chord change during one minute**."
- **방향별 분리:** Module 1 루틴에 "1' One Minute Changes A to D" + "1' One Minute Changes D to A"가 별도 항목으로 존재.
- **기록:** "It's essential to keep track of your practice sessions" — 키친 타이머 + 숫자 기록, 또는 My Practice Assistant(타이머·통계·메트로놈), Beginner App(인터랙티브 OMC).
- **벤치마크/진행 기준**
  - Module 1 → 2: "try to get up to **30 chord changes per minute** between D and A"; 단 "If this seems impossible and you can't achieve it **after a few weeks, you can move**" (지루함 방지용 탈출 조항).
  - Module 2~6: "around 30 chord changes in one minute **between all chords learned so far**".
  - Grade 1 통과: 학습한 모든 쌍에서 30/분. "Eventually, you'll be able to do 60".
  - 구버전 Beginner Practice Routine(pc-501): Stage 3는 "**over 20 times** in a minute"까지 유지, 레벨 완료 시 "most chord changes at **above 25** changes in a minute (**30 is target**)", 하루 OMC 5분 = "five combinations".
- **우선순위:** 8개 코드 → 56개 방향쌍이 생기지만 전부 연습할 필요 없음. "D to Dm, E to Em" 같은 드문 쌍은 제외. **"My 25 Most Important Changes"**:
  `A–C, A–G, A–E, A–Em, A–D, A–Dm, C–G, C–E, C–D, C–Dm, C–Am, C–Em, G–E, G–D, G–Dm, G–Am, G–Em, E–D, E–Dm, E–Am, D–Am, D–Em, Dm–Am, Dm–Em, Am–Em`
- **모듈별 권장 쌍** (각 모듈 Practice 페이지)
  - M1: A↔D (양방향) · M2: A–D, A–E, D–E · M3: Am–E, Em–D, Am–Em · M4/M7: "Whichever chord changes you find most difficult" ×2 · M5: Am–C, C–Em · M6: G–C, G–D, C–D(또는 가장 어려운 것) · M8: G(4-finger)–D
- **부수 효과:** 손가락 굳은살 형성에도 도움("If your fingers hurt after this exercise, that's ok... take a break").

### 1.3 Chord Perfect Practice — 정확한 절차와 흔한 결함

출처: "How To Play The D Chord" (b1-105), "Positive Finger Placement" (b1-103), "How To Minimize Finger Pain" (b1-113).

- **4단계 절차 (D Chord Perfect Practice 원문)**
  1. **Finger Placement** — 코드 다이어그램대로 손가락 배치. 새 코드는 "putting your fingers down in this order"(손가락 번호 순서대로 하나씩).
  2. **Strum the Chord** — 눌러서 스트럼.
  3. **Individual Strings** — "Play the strings one at a time. Each note should ring out true and clear." 줄별 진단(D 예시):
     - 개방 4번줄이 먹히면 → 1번 손가락이 4번줄에 닿음
     - 3번줄이 안 울리면 → 프렛에 가깝게, 충분히 누르기 / 3번 손가락이 3번줄에 닿지 않게
     - 2번줄(3번 손가락) → 프렛 가까이 붙이기가 어려움
     - 1번줄 → 3번 손가락 밑면이 1번줄을 건드리는 경우 많음 → "play each string with your fingertips"
  4. **Strum Again** — 다시 스트럼, 개선 안 되면 1~3 반복.
  - (암묵적 5단계) 손을 떼고 다시 잡기를 반복 — Module 루틴에서 1–3분 타임박스로 수행 **(반복 횟수 지정은 미확인)**.
- **흔한 결함 체크리스트**
  - **Positive Finger Placement:** "get your finger as close to the fret as possible without actually touching it" → 적은 힘으로 깨끗한 소리. 프렛 뒤쪽(너트 쪽)일수록 더 큰 압력 필요, 프렛 위로 넘어가면 뮤트.
  - **Fingertip:** 손가락 끝으로 눌러 인접 줄 접촉 방지. 손톱은 짧게.
  - **Thumb Position:** "Keep your thumb behind the neck, and don't let it rest in the palm" (바레 대비 근육 형성).
  - **누르는 힘:** 배치 연습 중엔 "rest your fingers on top of the strings", Chord Perfect 때만 누른다(통증 최소화).
  - **뮤트해야 할 줄:** X 표시 줄은 치지 않음(How To Strum The Correct Strings), 2-finger G는 2번 손가락을 살짝 눕혀 5번줄 뮤트.
- **진행 기준:** Grade 1 통과 시 8개 코드를 "say the chord's name and play it straight away", "from memory, in any order", "Get the right sound from these chords **at least 50% of the time**".

### 1.4 그 밖의 Grade 1~3 연습

| 연습 | 절차/규칙 (원문 기반) | 수치 |
|---|---|---|
| **Anchor Fingers** (b1-109) | 두 코드 간 같은 줄/프렛을 유지하는 손가락을 축으로 이동. D→A: D를 잡고 2·3번 손가락만 들기 → 1번 손가락은 줄에서 떼지 않고 같은 프렛 안에서 살짝 뒤로 미끄러짐 → 2·3번으로 A 완성 → 반복. 이 연습에선 스트럼 불필요 | M1 루틴 2분 |
| **Air Changes** (b1-703) | 코드 모양을 공중에서 미리 만든 뒤 모든 손가락을 동시에 내려놓기. 신규 코드 학습 땐 순서대로, 체인지에선 동시 착지가 궁극 목표. 추천 쌍 G–C(모든 손가락 이동) | "some months of work" |
| **Perfect Fast Changes (PFC)** (b2-802, b1-712) | OMC + Chord Perfect 결합. ① 어려운 쌍 선택 ② 각 코드를 최대한 완벽히 하면서 최대 속도 ③ 둘 중 하나를 희생해야 하면 **quality over speed** ④ 점진 가속. 천천히 스트럼해 모든 음 확인, 먹히거나 버징하면 "slow down some more". OMC보다 횟수가 적은 것이 정상 | 1–2분/쌍 |
| **Chord Changes For One** (b1-206) | 코드 변경은 대개 마디 1박에서. "much better to be playing the chord right on beat 1 than it is to be late all the time" → 다음 1박에 맞추도록 미리 바꾸기 | – |
| **Forcing Chord Changes** (b1-606) | 메트로놈 사용, 어려운 쌍 OMC, **손을 멈추지 말 것**("Skip a chord if needed, but don't stop the strumming hand"), 멈추지 않는 반주(play-along)에 맞춰 연주 | – |
| **Strumming Patterns With Ups** (b1-307) | 줄을 손으로 감싸 뮤트하고 패턴만 연습. Pattern #1 `1 2 & 3 4` = **D DU D D**; Pattern #2 `1 2 & 3 & 4` = **D DU DU D**. "and"에 업스트럼, 손은 계속 움직이기 | – |
| **Old Faithful** (b1-404) | Step1 4 down(소리 내 카운트) → Step2 `D DU DU D` → Step3 3박 다운 생략: **D DU UDU** (1 2& &4&)\* — 생략 박에서도 손은 진자처럼 계속 움직임. 코드 없이 패턴부터 | 메트로놈 **80–100 BPM** |
| **All-Down 8th Strumming** (b2-805) | 8분음표 전부 다운, 2·4박 악센트(backbeat) | 메트로놈 **60–80 BPM**, M8 통과 80 BPM |
| **Meet The Metronome** (b1-403) | 템포 가변, **1박 악센트** 설정(4/4), 정확한 앱 사용 | 60 BPM = 1클릭/초 |
| **Beginner Finger Stretches** (b1-401) | 6번줄 5프렛에서 1번 손가락→2→3→4를 **떼지 않고** 차례로 추가하며 각각 다운피킹, 손바닥은 지판과 평행, 1초 유지, 다음 줄로. 힘들면 8프렛에서 시작, 익숙해지면 1프렛 방향으로 이동. "NOT a Speed Exercise", "Finger Stretch Exercise, Not A Finger Pain Exercise" | 루틴 1–2분 |
| **Beginner Alternate Picking** (b1-601) | 피크를 줄에 대해 약간 기울여 모서리로 침, "in and out" 개념. 한 줄에서 앞뒤 반복, 평행/기울임 비교. "accuracy over speed" | 루틴 1분 |
| **Pinky Workout** (b2-907) | 6번줄 7프렛 3번 손가락 + 8프렛 4번 손가락 → 1번줄까지 → 4→3 순서로 복귀 → 2–4, 1–4 조합 반복. "NOT a speed drill" | 루틴 2분 |
| **Finger Gym** (bg-1503) | 해머온 손가락 조합(1–2 등) 5프렛 6번줄부터; 목표는 **음의 고른 시간 간격**, 안 되면 감속 | 메트로놈 **≤80 BPM, 60 권장**, **하루 5분(최대 10분)** |
| **Scale practice** (sc-102) | 암기 후 ① Up&Down 사이클 ② 무작위 방향 전환 ③ 무작위 음 ④ 3도 ⑤ Four in a line ⑥ 백킹트랙 활용. "Be able to play the scale **4 times perfectly**, without stopping before you move on or move the tempo up" | M8 통과: Open Em pentatonic **80 BPM, 1음/클릭** |
| **Playing Without Looking** (M14) | 지판을 보지 않고 연주 (세부 절차 미취득) **(미확인)** | 2분 ×2 |
| **Transcribing** (bg-1508, M15) | 귀로 곡 따기 4단계 (세부 미취득) **(미확인)** | M15 루틴 10분 |
| **Ear Training** (b1-708) | Grade 1 끝무렵 시작 권장. 인터벌 훈련, 유명 곡 시작음과 연결("Wedding March") | 선택 과정 |

\* b1-404 아카이브 본문은 Step3 표기가 `D Du u D`로 일부 렌더링이 깨져 있으며, 통상 표기 D DU UDU는 다른 다수 출처 및 사용자 설명과 일치한다(아카이브 원문 표기 자체는 불완전).

### 1.5 연습 루틴 구조 (시간 배분)

**공통 원칙(각 Module Practice 페이지):** 주 **4회**, 회당 **20분**(Grade 1) → Grade 2부터 **30분**(어렵다면 2×15분). "Don't over-practice — it can lead to finger pain." Grade 3는 **하루 30–60분**, 5분 청크.

| Module | 루틴 (분) | 다음 모듈 진입 기준 |
|---|---|---|
| M1 (20') | Tune 1 · Chord Perfect D 3 · Chord Perfect A 3 · Anchor A&D 2 · OMC A→D 1 · OMC D→A 1 · 2-Chord Songs 10 | A·D 암기, **OMC ≥30**, 곡 1회 시도 |
| M2 (20') | Tune · CP E 2 · CP D 1 · CP A 1 · Anchor E/A/D 2 · OMC A–D, A–E, D–E 각 1 · Peter Gunn riff 1 · Songs 10 | E 암기, anchor 편안, 모든 쌍 ~30, riff 시도, 3코드 곡 시도 |
| M3 (20') | CP Am 1 · CP Em 1 · OMC Am–E, Em–D, Am–Em 각 1 · Anchor 1 · Strumming 2 · Seven Nation Army 2 · Songs 10 | Am·Em 암기, ~30, riff, 곡 |
| M4 (20') | Finger Stretch 2 · CP Dm 1 · CP 가장 어려운 코드 1 · OMC 가장 어려운 쌍 ×2 (2) · Old Faithful 2 · Sunshine riff 2 · Songs 10 | ~30, 6코드 암기, Old Faithful을 뮤트 상태로 메트로놈과 일관되게, riff, 곡 1개 대부분 |
| M5 (20') | Stretch 2 · CP C 1 · CP 약점 1 · OMC Am–C 1 · OMC C–Em 1 · Strumming(타이밍 집중) 2 · Come As You Are 2 · Songs 10 | ~30, 7코드 암기, 손 계속 움직이기 일관성, C 포함 곡 |
| M6 (20') | Stretch 1 · Alt Picking 1줄 1 · CP G 2 · CP 약점 1 · OMC G–C, G–D, C–D 각 1 · 6/8 Strumming 2 · Songs 10 | ~30, 8코드 암기, 단일 줄 교대피킹 탐색, 6/8 메트로놈 시도, G 포함 곡 |
| M7 (20') | CP 약점 2 · OMC 최약 2쌍 2×1 · Strumming(메트로놈) 2 · 6/8 Strumming 2 · Riff 2 · Songs 10 → **"You HAVE to adapt"** | Grade 1 통과 기준(아래) |
| M8 (30') | Stuck 3&4(OMC/PFC) 3 · Em Pentatonic 2 · OMC G–D 1 · PFC G–D 1 · New Strumming 3 · Riff 3 · Open Note Study 2 · New Songs 10 · Repertoire Revision 5 | **최소 2주**(주4회면 3–4주): Stuck 3&4 암기, Em pentatonic 80 BPM 1음/클릭, all-down 8ths 80 BPM, 곡 2개, 개방 포지션 음 |
| M9 (30') | Repertoire 5(워밍업으로 맨 앞) · F 시도 2 · F cheats 2 · PFC Fmaj7–C, Fmaj7–G, D–F 각 1 · C Major Scale "SLOW and CAREFUL" 2 · Pinky 2 · Californication 4 · Songs 10 | F cheats 암기, C major 암기, F 포함 곡 |
| M10~14 (30') | Repertoire 5 → 기술 2–3분 블록 다수 → Songs 10 | 모듈별 체크리스트(예: M12 6·5번줄 음 암기, R6/R5 파워코드, Am pentatonic 암기) |
| M15 (60') | 6영역 × 5분: Technique(Finger Gym + 자유) · Knowledge(D Shape Explorer + 자유) · Repertoire · Time(Feel Good Strumming + Play Along) · Ear Training(Transcribing 10) · Improvisation 10 | 자율 설계 |

**Grade 1 통과 5대 기준 (b1-710):**
1. 튜너로 스스로 튜닝
2. 8개 코드(A D E Am Dm Em C G)를 이름 듣자마자 기억으로, 임의 순서로, 뮤트 줄 포함 정확히 — **최소 50% 확률로 올바른 소리**
3. 학습한 임의의 쌍에서 **30 changes/min**
4. **Old Faithful을 80 BPM**에서 일관되게(다른 곳을 보며 주의를 분산해도 패턴 유지되면 자동화된 것)
5. **쉬운 곡 5개 암기**

**참고 수치:** 시범 학생 Nitsuj는 Module 1에 4세션, Grade 1 전체 5–6주, Module 7 시점 누적 연습 약 **8시간**, consolidation 10세션.

### 1.6 연습 원칙 (JustinGuitar 자체 설명)

- **Practice Makes Permanent** (te-002, bg-1801): 실수 없이 천천히. "Only when you can play something **10 times without a mistake** should you start to speed it up." 새 것을 "slowly play them **20 times from memory** without a mistake"하면 가속해도 실수가 드묾. 실수 덮어쓰기에는 "**20 correct play-throughs**"(본인 표현 "guestimation").
- **실수 시 멈추고 다시:** "it's better to stop than keep going" (학습 단계). 단, 곡/스트러밍에서는 반대로 "keep your hands moving" — **학습 모드 vs 연주 모드**를 구분.
- **Timeboxing** (bg-001): 카운트다운 타이머, 5분 슬롯 → 완료 체크(동기부여). 단, 스트럼/핑거스타일 **자동화 단계**는 타임박스 대신 주의를 분산한 채 장시간 반복 권장.
- **최대 30분 연속(burst)** 후 짧은 휴식 (bg-1801).
- **Spacing Effect** (bg-2001): 약 **5분 블록 + 1분 간격**. "6 five-minute practice blocks during a week" > 1시간 1회. 주 **6일** 짧게. 초기에는 **3일 이상 비우지 말 것**(4일 넘으면 처음부터 다시 배우는 것과 비슷하다는 연구 언급 **(인용 연구 미확인)**). 곡 복습 간격: 공연 수준 도달 → **1주 → 2주 → 1개월 → 3개월 → 6개월 → 1년**. bg-1801에서는 "a week later, a month later, and then 6 months later". 수면 중요.
- **Chunking:** 긴 패시지는 4~8음 단위로 분할.
- **Five Golden Rules of Technique** (te-002): ① Practice makes permanent ② 아주 천천히 시작, 정확할 때만 가속 ③ 움직임 최소화 ④ 연습의 목적 이해 ⑤ 과하지 말 것(부상).
- **Finger pain** (b1-113): 필요할 때만 누르기, Positive Finger Placement, "**Start with 20 minutes a day, four days a week**", "an hour-long practice session does more harm than good". Stuck 3&4/새끼손가락: 3번 손가락이 과보상해 아플 수 있음 → "take enough breaks to let it heal".

---

## 2. 근거 기반 연습 원리와 앱 적용

| 원리 | 근거 | 앱 적용 |
|---|---|---|
| **Deliberate practice** | Ericsson, Krampe & Tesch-Römer (1993): 상위 바이올리니스트일수록 누적 deliberate practice가 많음 — 이후 재현 연구(Macnamara & Maitra 2019)는 효과 크기가 원 연구보다 작다고 보고. 즉 "양"보다 "방법"이 중요 | 약점 기반 항목 선정, 명확한 목표 수치, 즉시 피드백 |
| **전략 > 시간** | Duke, Simmons & Cash (2009): 피아노 학생의 수행 품질은 연습 시간보다 **사용 전략**(오류를 즉시 교정해 재발 방지, 템포 조절 등)이 결정 | 오류 발생 시 감속·국소 반복 자동 제안 |
| **Interleaved/Random practice (Contextual interference)** | Stambaugh (2011, JRME): **초보** 클라리넷 41명 — 연습 직후 차이 없음, **보존(retention) 테스트에서 random 그룹이 유의하게 빠름**. Carter & Grahn (2016): 숙련 클라리넷 연주자, 3분씩 교대한 interleaved 조건이 12분 blocked보다 높은 평가, 목표설정·집중·실수 인식에도 긍정적 | 1–3분 항목들을 순환. OMC 쌍을 날마다 섞기. 완전 신규 동작(첫 코드 모양)은 짧은 blocked 후 interleave로 전환 |
| **Spacing** | Ebbinghaus 이래 확립된 spacing effect (bg-2001에서 인용). Cepeda et al. (2006) 메타분석 **(본 조사에서 원문 미확인)** | 항목별 다음 복습일 스케줄러(SRS), 3일 초과 공백 경고 |
| **수면 통합** | Simmons & Duke (2006, JRME): 연습 세션 사이 잠을 잔 그룹이 키보드 멜로디 **정확도 유의 향상**, 일부는 속도·균일성도 향상 | "하루 1회 이상 짧게" 권장, 야간 직전 몰아치기보다 일별 분산 |
| **Slow practice + 점진 가속** | JustinGuitar(10회 무실수 후 가속, 스케일 4회 완벽 후 템포 상승). 정량 증분(+4/+5 BPM)은 교수자 관행이며 실험 근거 **(미확인)** | 템포 사다리(5.3 참조) |
| **Chunking** | bg-1801 (4–8음 단위). 운동 학습 일반 원리 | 리프/곡을 마디 단위 세그먼트로 분할·루프 |
| **짧은 집중 세션** | 5분 블록(bg-2001), 30분 burst 상한(bg-1801), 초보 20분/일(b1-113) | 세션 빌더 기본값 20분, 블록 1–5분 |
| **타이밍 정밀도** | 감각운동 동기화 연구(Repp 2005; Repp & Su 2013): 메트로놈에 맞춰 칠 때 사람은 보통 **수십 ms 앞서** 침(negative mean asynchrony); 음악가는 비음악가보다 asynchrony와 변동성이 **작음** | 평균 오프셋(앞/뒤 쏠림)과 표준편차를 분리해 측정. 일정한 선행(-20 ms 수준)은 감점하지 않고 **변동성**을 주 지표로 |
| **부상 예방** | Limerick 대학 기타 전공생 244명: PRMD 유병률 **40.98%**, 손가락이 가장 흔한 부위, **워밍업 안 함**이 유의한 위험요인; 워밍업·휴식 미실시자의 증상·중증도가 높음 | 세션 시작 1–2분 워밍업 강제, 블록 사이 휴식, 통증 자가보고 → 자동 감량 |
| **손끝 통증/굳은살** | 초기 손끝 통증은 정상(JustinGuitar 전반). 굳은살 형성 기간(통상 2–4주라고 알려짐) **(미확인)** | 첫 2–4주는 20분 상한, 일일 OMC 횟수 제한, "날카로운 통증·저림·관절 통증 = 즉시 중단" 경고 |
| **정체기(plateau)** | JustinGuitar: OMC 30 미달이 몇 주 지속되면 다음 단계로 진행 허용(지루함 방지), "Rut-Busting Consolidation" 모듈 | 정체 감지 시 대체 연습(PFC↔OMC 전환, anchor/air drill) 또는 조건부 진급 |

---

## 3. 다른 강사·커리큘럼의 측정 가능한 연습 (간략)

> 이 장은 1차 출처를 직접 검증하지 못했다. 앱 설계에 참고할 **일반적으로 알려진 형태**로만 사용하고, 세부는 모두 **(미확인)**.

| 출처 | 측정 가능한 연습 요소 |
|---|---|
| Andy Guitar (YouTube 초보 코스) **(미확인)** | 3–4개 개방 코드로 즉시 곡 연주, 코드 체인지 반복 드릴, 다운/업 스트럼 패턴 |
| Marty Music (Marty Schwartz) **(미확인)** | 곡 중심 학습, 리프 단위 분할 → 실제 곡 연주 |
| Paul Davids **(미확인)** | 연습 루틴·리듬감 강조(메트로놈 2·4박 클릭 등) |
| Fender Play **(미확인)** | 장르별 경로(path), 레벨/레슨 단위 진도, 코드·리프·곡 단계화 |
| Guitar Tricks — Core Learning System(Guitar Fundamentals 1·2) **(미확인)** | 단계별 레슨 + 퀴즈/진도 체크 |
| Hal Leonard Guitar Method Book 1 / Berklee Method **(미확인)** | 표준 악보 읽기 기반, 1번줄부터 단음 멜로디 → 코드, 템포 지정 연습곡 |
| 범용 기술 드릴 (다수 교재 공통, **(미확인)**) | **Chromatic 1-2-3-4 ("Spider")**: 한 줄에서 1–2–3–4 손가락 순차, 교대 피킹, 메트로놈 템포 상승 / **Minor pentatonic 5 positions**(Position 1부터) / **Fretboard note memorization**: 6·5번줄 루트 → 전 지판, 무작위 음 찾기 타임어택 / **Ear training**: 메이저·마이너 코드 판별, 인터벌 식별 |

JustinGuitar 자체에도 위 요소 일부가 포함됨이 확인됨: Open String Note Names(M6), Notes In Open Position(M8), 6·5번줄 음 암기(M12 기준), Em/Am minor pentatonic(M8/M12), C major scale(M9), interval ear training(Ear Training 과정).

---

## 4. 연습 유형별 측정 지표

| 연습 유형 | 자동 측정 (오디오/입력) | 반자동 (사용자 자가보고) | 진행 규칙 근거 |
|---|---|---|---|
| 코드 정확도 (Chord Perfect류) | 줄별 아르페지오 → 음높이 검출로 줄별 울림/먹힘/버징(스펙트럼 노이즈) 추정 **(정확도 미검증)** | 줄별 체크(clean/buzz/muted/잘못 울림) 탭 | Grade1 기준 ≥50% 정확 |
| 1분 코드 체인지 | 스트럼 onset 카운트(1분 타이머) — 코드 인식으로 쌍 교대 검증 가능 | 직접 횟수 입력 / 탭 카운터 | 30/분 단계 기준, 60/분 숙달 |
| 정확 체인지(PFC류) | onset 카운트 × 코드 인식 정확 판정 | "깨끗한 체인지만" 탭 | OMC 대비 낮음이 정상 |
| 스트러밍 패턴 | 각 스트럼 onset의 그리드 오프셋(ms), 평균·표준편차, 누락/추가 스트럼, 업/다운 판별은 어려움 **(미확인)** | 완주 여부 | 80 BPM 기준 |
| 박 1 체인지 | 마디 첫 스트럼 지연(ms) | – | "on beat 1" |
| 단음 기술(교대피킹·스파이더·스케일·Finger Gym) | 음 onset 간격 균일성(IOI CV), 정확 음높이 비율, 깨끗하게 유지한 최고 BPM | 완주/실수 횟수 | 스케일 4회 무실수 → 템포↑ |
| 음 이름/지판 | 정답률, 응답시간(ms) | – | SRS 간격 |
| 귀 훈련 | 정답률, 응답시간 | – | SRS 간격 |
| 곡/레퍼토리 | 전체 통과율(박자 이탈 마디 비율) | "멈추지 않고 완주" 체크, 암기 여부 | 복습 1주→2주→1개월→3개월→6개월→1년 |
| 공통 | 일일 연습 시간, 연속일(streak), 항목별 마지막 연습일 | 통증 0–10, 피로도 | 주 4–6회, 3일 공백 경고 |

---

## 5. 앱 설계 시사점 (자체 커리큘럼 제안)

> 아래 수치 중 출처 표시가 없는 것은 **설계 제안값**이다(검증된 연구 기준이 아님). 출처 기반 수치는 [근거]로 표기한다. 모든 임계값은 설정에서 조정 가능하게 둔다.

### 5.1 설계 원칙

1. **정확도 트랙과 속도 트랙 분리:** "코드 정밀 체크"(정확도)와 "1분 코드 체인지"(속도)를 별개 항목으로, 이후 "정확 빠른 체인지"로 통합 [근거: Chord Perfect / OMC / PFC 구조].
2. **학습 모드 vs 연주 모드:** 학습 모드에서는 실수 시 멈추고 감속, 연주 모드(곡/스트러밍)에서는 "손을 멈추지 않기"를 채점 [근거: bg-1801 vs b1-606].
3. **타임박스 + 짧은 블록 + 순환(interleave):** 1–5분 블록을 섞어서 진행 [근거: 루틴 구조, Stambaugh 2011, Carter & Grahn 2016].
4. **약점 우선 자동 선정:** 최근 점수가 가장 낮은 쌍/코드를 루틴에 자동 투입 [근거: M4/M7 "most difficult"].
5. **스페이싱:** 졸업한 항목은 복습 큐로 이동, 간격 확대 [근거: bg-2001].
6. **안전 상한:** 초기 20분/세션, 30분 연속 상한, 통증 보고 시 감량 [근거: b1-113, bg-1801, PRMD 연구].

### 5.2 단계별 커리큘럼 (어쿠스틱, 완전 초보)

기본 빈도: 주 4–6일. Stage 0–7 = 20분/일, Stage 8+ = 30분/일(2×15 분할 허용). 각 스테이지 최소 체류 4세션, 권장 1–2주 (Stage 8+는 최소 2주) [근거: Nitsuj 4세션, M8 "at least 2 weeks"].

| Stage | 이름 | 신규 코드/내용 | 포함 연습 | 진급 기준 (모두 충족) |
|---|---|---|---|---|
| 0 | 준비 | 튜닝, 자세, 피크 잡기, 코드 다이어그램 읽기, 프렛 가까이 누르기 | 튜닝 가이드, 프렛 위치 압력 비교 테스트, 뮤트 스트럼(박자 세기) | 튜너로 6줄 튜닝 완료 3회, 다이어그램 퀴즈 ≥90% |
| 1 | 첫 두 코드 | **D, A** | 코드 정밀 체크, 앵커 손가락 드릴(D↔A), 1분 코드 체인지 A→D / D→A, 4 다운 스트럼 + 1박 체인지, 2코드 곡 | D·A 이름 제시 후 3초 내 형성, 1분 체인지 A↔D ≥30 (또는 3주 경과 시 조건부 진급) [근거: b1-118] |
| 2 | 세 번째 코드 + 박자 | **E** | 위 + 발 박자, 다운 스트럼 온 비트, 첫 단음 리프 | E 암기, A–D/A–E/D–E 각 ≥30, 3코드 곡 1곡 완주 시도 |
| 3 | 마이너 + 업스트럼 | **Em, Am** | 업스트럼 패턴 P1 `D DU D D`, P2 `D DU DU D`(뮤트), 1분 체인지 Am–E, Em–D, Am–Em | Em·Am 암기, 학습 쌍 ≥30, P2 뮤트 상태 70 BPM 통과 |
| 4 | 메트로놈 + 표준 패턴 | **Dm** | 손가락 스트레칭(1-2-3-4 @5프렛), 메트로놈 도입(1박 악센트), **표준 패턴 `D DU UDU`**(뮤트→단일 코드→체인지), TAB 읽기, 리프 | 6코드 암기, 표준 패턴 뮤트 80 BPM 통과 |
| 5 | C 코드 | **C** | 스트레칭, 1분 체인지 Am–C, C–Em, 타이밍 중심 스트러밍, 음이름 기초 | 7코드 암기, ≥30, 패턴에 체인지 포함 70 BPM |
| 6 | G 코드 + 교대 피킹 | **G** (2-finger G → 3-finger G) | 단일 줄 교대 피킹(피크 각도), 1분 체인지 G–C, G–D, C–D, 6/8 스트러밍, 개방현 음이름 | 8코드 암기, ≥30, 교대 피킹 단일 줄 8분음표 70 BPM, 6/8 메트로놈 시도 |
| 7 | 통합(Consolidation) | 8코드 정리 | 공중 체인지 드릴, 핵심 25쌍 순환, 다이내믹(셈여림), 곡 암기, 귀 훈련 입문(메이저/마이너 판별) | **Beginner 1 졸업 시험**(5.5 참조) |
| 8 | 드론 코드 + 첫 스케일 | G(4-finger), Cadd9, Dsus4, A7sus4, Em7 | **정확 빠른 체인지**, Open Em pentatonic, 다운 8분음표 스트럼(2·4박 악센트), 의도적 뮤트, 개방 포지션 음 | Em pentatonic 80 BPM 1음/클릭 4회 연속 무실수, 다운 8분 80 BPM, 신규 코드 암기, 곡 2개 [근거: M8] |
| 9 | F 여정 + 새끼손가락 | Fmaj7 → 작은 F → 풀 바레 F | 새끼손가락 운동, C major scale(천천히), 정확 빠른 체인지 Fmaj7–C / Fmaj7–G / D–F | F 계열 1종 이상 코드 정밀 ≥70%, C major 암기, F 포함 곡 1개 |
| 10 | 파워코드 + 펜타토닉 | R6/R5 파워코드 | Am pentatonic position 1, 팜뮤트, 6·5번줄 음 암기, 크로매틱 1-2-3-4 | 6·5번줄 음 퀴즈 ≥90%(응답 <3초), Am pent 80 BPM, 파워코드 곡 2개 |
| 11 | 7th 코드 + 블루스 | A7, D7, E7, G7, C7, B7 | 12마디 블루스(G/A/E), 셔플 리듬, 해머온 손가락 운동(≤80 BPM) | 7th 6종 암기, 12마디 블루스 완주, 대부분 체인지 ≥30 [근거: pc-501 완료 기준] |

> 코드 도입 순서 D → A → E → Em → Am → Dm → C → G는 대형 무료 코스의 검증된 순서를 따르되 앱 고유 명칭/콘텐츠로 구성한다. D·A·E는 앵커 손가락 공유가 많아 초기 체인지 성공 경험을 주기 쉽고, G는 2-finger 버전으로 먼저 도입해 난이도를 낮춘다.

### 5.3 일일 루틴 템플릿 (자동 생성 규칙)

**Stage 1 예시 (20분):** 튜닝 1 · 코드 정밀 D 3 · 코드 정밀 A 3 · 앵커 드릴 2 · 1분 체인지 A→D 1 · D→A 1 · 곡 연습 9

**Stage 2–6 생성 규칙 (20분):**
- 워밍업/스트레칭 1–2분 (Stage 4+)
- 코드 정밀 체크: 신규 코드 1–2분 + 정확도 최저 코드 1분
- 1분 체인지: 2–3쌍 (신규 코드 포함 쌍 우선, 그다음 최근 점수 최저 쌍) — 각 1분, 쌍 사이 30초 휴식
- 리듬/스트러밍: 2분 (메트로놈)
- 리프/기술: 1–2분
- 곡: 10분 (항상 마지막, "재미" 블록)

**Stage 7+:** 앞 5분을 레퍼토리 복습(워밍업 겸)으로, 남는 시간을 약점 기반 자동 배치. Stage 8+는 30분.

**스케줄링 규칙:**
- 같은 항목은 연속 배치하지 않고 다른 항목과 교대(interleave).
- 졸업 항목은 SRS 큐로: 다음 복습 = 1일 → 3일 → 7일 → 14일 → 30일 → 90일 (bg-2001 곡 복습 간격을 단축 변형한 설계값). 복습 실패 시 간격 1단계 후퇴.
- 마지막 연습 후 3일 초과 공백이면 다음 세션 첫 블록을 직전 스테이지 복습으로 [근거: bg-2001 "don't wait longer than 3 days"].

### 5.4 연습 명세 (Exercise Specs)

공통 데이터: `exercise_id, stage, inputs, started_at, duration_s, score{...}, tempo_bpm?, self_report{pain_0_10, difficulty_1_5}`.

#### E1. 코드 정밀 체크 (Chord Accuracy Check)
- **입력:** 코드 1개(다이어그램: 줄별 프렛/손가락/X/O), 블록 시간(1–3분)
- **절차:** ① 손가락을 번호 순서대로 배치(초기) ② 전체 스트럼 ③ 울려야 할 줄을 한 줄씩 피킹 → 줄별 상태 판정 ④ 다시 스트럼 ⑤ 손을 완전히 떼고 다시 잡기 → 블록 시간 동안 반복
- **결함 힌트(실패 줄 기반 자동 제시):** 프렛에서 멀다 / 손끝이 서지 않아 옆 줄 접촉 / 엄지가 넥 위로 감겨 손바닥에 닿음 / 힘 부족 / X 줄이 울림 / 손톱 길이
- **채점:** 시도별 `clean_ratio = 깨끗한 줄 수 / 울려야 할 줄 수`; X 줄이 울리면 감점; 시도가 "clean" = 모든 줄 clean & X 줄 무음. 입력은 줄별 탭(clean/buzz/muted) 또는 오디오 자동 판정(보조)
- **진급:** 해당 코드 최근 10회 시도 중 clean ≥5 (= 50%, [근거: Grade 1 기준]) → "습득"; 최근 10회 중 ≥8 → "숙달"(설계값). 추가로 "이름 제시 → 3초 내 형성"(설계값) 퀴즈 통과

#### E2. 1분 코드 체인지 (One-Minute Chord Switch)
- **입력:** 코드 쌍(A, B), 방향(A→B 시작), 60초
- **절차:** 카운트다운 후 A를 잡고 시작 → B로 바꿔 1회 스트럼 → A로 바꿔 1회 스트럼 … 60초간 반복. 소리 품질은 채점하지 않음
- **카운트:** 다른 코드에 **도착할 때마다 1회** [근거: "30 changes = 2 seconds on each chord"]. 입력: 탭 카운터 / 스트럼 onset 자동 카운트(1분 내 onset 수, 최소 간격 300 ms 디바운스) / 수동 입력
- **채점:** `changes_per_min` (정수). 기록: 쌍별 최고·최근 3회 중앙값·추세
- **목표/진급:** 단계 기준 **≥30** [근거], 최종 목표 **60** [근거]. 쌍 "단계 통과" = 서로 다른 2일에 ≥30. 3주 연속 정체(중앙값 상승 <2) 시 조건부 진급 허용 + 앵커/공중 체인지 드릴 처방 [근거: b1-118 "after a few weeks, you can move"]
- **쌍 선택:** 핵심 25쌍(5.6) 중 현재 스테이지에서 해금된 코드 조합만. 우선순위 = 신규 코드 포함 > 최근 중앙값 최저 > 마지막 연습일 오래됨. 하루 2–3쌍
- **안전:** 하루 1분 체인지 총 6회(6분) 상한(설계값), 손끝 통증 ≥5/10 보고 시 해당 일 추가 배정 중단

#### E3. 정확 빠른 체인지 (Clean Fast Switch)
- **입력:** 쌍, 60–120초 (Stage 8+ 또는 1분 체인지 ≥30 달성 쌍)
- **절차:** E2와 같되 각 코드 도착 시 천천히 스트럼/아르페지오로 모든 줄이 울리는지 확인. 먹힘·버징 시 즉시 감속
- **채점:** `clean_changes_per_min` = clean으로 판정된 도착만 카운트, `clean_rate = clean / total`
- **진급:** clean_rate ≥80% & clean_changes ≥20/분(설계값). E2 점수보다 낮은 것이 정상임을 UI에 안내 [근거: PFC]

#### E4. 앵커/공중 체인지 드릴 (Pivot & Air Change Drill)
- **입력:** 쌍 + 앵커 손가락 메타데이터(예: D→A 1번 손가락 3번줄 2프렛 유지; G→C 앵커 없음 → 공중 체인지)
- **절차:** 앵커형: A 형성 → 나머지 손가락만 떼기 → 앵커 미끄러뜨리기 → B 완성, 스트럼 없음, 느리게. 공중형: 줄 위에서 손 모양 먼저 만든 뒤 모든 손가락 동시 착지 후 스트럼
- **채점:** 시간 기반 완료 체크(점수 없음) + 자가보고 "동시 착지 성공 n/10"
- **진급:** 해당 쌍의 E2 점수 개선 여부로 간접 평가. 공중 체인지는 장기(수개월) 목표로 표시 [근거: b1-703]

#### E5. 스트러밍 패턴 사다리 (Strum Pattern Ladder)
- **입력:** 패턴(아래 목록), BPM, 마디 수(기본 8), 모드(뮤트 → 단일 코드 → 코드 진행)
- **패턴 목록:** P0 `D D D D` · P1 `D DU D D` · P2 `D DU DU D` · P3(표준) `D DU UDU` · P4 다운 8분 + 2·4박 악센트 · P5 6/8 `D DU DU`(6/8 구체 패턴 **(미확인)**, 설계 시 자체 정의)
- **절차:** 카운트인 1마디 → 메트로놈(1박 악센트)에 맞춰 연주, 박을 소리 내어 세기 권장. 놓쳐도 손은 계속 움직이기
- **채점(자동, 오디오 onset):** 각 스트럼을 가장 가까운 기대 그리드 슬롯에 매칭 → `offset_ms`. 지표: hit_rate(|offset−개인 평균 선행치| ≤ 창), `mean_offset_ms`(앞/뒤 쏠림), `sd_offset_ms`(일관성), 누락·추가 스트럼 수. 창(설계값): 60–80 BPM ±60 ms, 80–100 BPM ±50 ms, 100+ ±40 ms. 개인의 일정한 선행(negative asynchrony)은 보정 [근거: Repp 2005/Repp & Su 2013]
- **템포 사다리(진급 규칙, 설계값):** 8마디 hit_rate ≥90% & 누락 0 → **+5 BPM**; 2회 연속 <70% → **−5 BPM**; 시작 60 BPM. 패턴 졸업 = 목표 BPM(P3 80 [근거: Grade 1], P4 80 [근거: M8])에서 2일 연속 통과
- **자동화 테스트:** 화면 시각 큐를 끈 "주의 분산 모드"에서도 hit_rate 유지 [근거: b1-710 "looking at something else"]

#### E6. 박 1 체인지 (Change-on-One)
- **입력:** 코드 진행(예: G–C–D–G, 마디당 1코드), 패턴, BPM
- **절차:** 마디 첫 박에 새 코드가 울리도록 미리 바꾸기, 멈추지 않기
- **채점:** 마디별 첫 스트럼 지연 `beat1_delay_ms`, 누락 마디 비율, 코드 인식 가능 시 정확 코드 비율
- **진급:** 16마디 중 ≥14마디가 창 안 & 멈춤 0 → +5 BPM (설계값) [근거: b1-206, b1-606]

#### E7. 손가락 스트레칭 (1-2-3-4 Stretch)
- **입력:** 시작 프렛(기본 5, 쉬우면 낮춤, 어려우면 8), 1–2분
- **절차:** 6번줄에 1→2→3→4 손가락을 떼지 않고 차례로 추가하며 각각 다운 피킹, 1초 유지, 다음 줄. 손바닥은 지판과 평행
- **채점:** 완료 체크, 현재 시작 프렛 기록. 속도 채점 없음 [근거: "NOT a Speed Exercise"]
- **진급:** 통증 ≤2/10으로 3세션 완료 → 시작 프렛 1칸 낮춤, 1프렛 도달 시 졸업. "스트레칭이지 통증 운동이 아님" 경고 상시 표시

#### E8. 단일 줄 교대 피킹 (Alternate Picking Single String)
- **입력:** 줄, 음가(8분음표), BPM(시작 60)
- **채점:** onset 간격 균일성 `ioi_cv`(표준편차/평균), 그리드 hit_rate
- **진급:** hit_rate ≥90% & ioi_cv ≤0.10 (8마디) → +5 BPM (설계값)

#### E9. 크로매틱 1-2-3-4 (Chromatic Finger Drill, Stage 10+)
- **입력:** 시작 프렛, 줄 범위, BPM, 음가
- **절차:** 각 줄에서 1-2-3-4 손가락 순서로 한 프렛씩, 교대 피킹, 6→1번줄 후 역순
- **채점:** 정확 음높이 비율(피치 검출), hit_rate, ioi_cv
- **진급:** E5 템포 사다리 규칙 + "10회 무실수 후 가속" [근거: bg-1801]

#### E10. 스케일 사다리 (Scale Ladder: Em pentatonic open → C major → Am pentatonic pos.1)
- **입력:** 스케일 모양, 단계(1 위아래 사이클, 2 무작위 방향 전환, 3 무작위 음, 4 3도, 5 4음씩), BPM, 1음/클릭
- **채점:** 정확 음높이 비율, 멈춤 여부, hit_rate
- **진급:** 해당 단계에서 **4회 연속 무실수** 사이클 → BPM +5 또는 다음 단계 [근거: sc-102]. 단계 졸업 BPM 80 [근거: M8]

#### E11. 해머온 손가락 운동 (Hammer-on Finger Workout, Stage 11)
- **입력:** 손가락 쌍(1-2, 1-3, 1-4, 2-3, 2-4, 3-4), BPM(≤80, 기본 60)
- **채점:** 피킹음과 해머온음의 간격 균일성·음량비 **(자동 판정 정확도 미검증)**
- **규칙:** 하루 5분 상한(최대 10분), 어려운 조합 우선 [근거: bg-1503]

#### E12. 새끼손가락 운동 (Pinky Workout, Stage 9+)
- **절차:** 7프렛 3번 + 8프렛 4번 손가락, 6→1번줄 후 역순, 2-4, 1-4 조합 [근거: b2-907]
- **채점:** 완료 체크 + 음 명료도 자가보고. 속도 채점 없음

#### E13. 지판 음이름 퀴즈 (Fretboard Note Recall)
- **입력:** 범위(개방현 → 개방 포지션 → 6·5번줄 1–12프렛)
- **절차:** 위치 제시 → 음이름 선택 / 음이름 제시 → 기타로 연주(피치 검출)
- **채점:** 정답률, 응답 시간(ms)
- **진급/SRS:** 카드별 정답 & <3초 → 간격 확대, 오답 → 1일로 리셋. 범위 졸업 = 전체 정답률 ≥90% & 중앙 응답 <3초 (설계값)

#### E14. 귀 훈련 (Ear Training: 메이저/마이너 → 인터벌 → 코드 진행)
- **절차:** 앱이 소리 재생 → 선택. 초기: 메이저 vs 마이너 코드, 다음: 인터벌(유명 곡 시작음 연상), 이후: I–IV–V 진행 판별
- **채점:** 정답률, 응답 시간. SRS 적용. Stage 7부터 [근거: b1-708 "end of Grade 1"]

#### E15. 곡 연습 & 레퍼토리 (Song Work & Repertoire)
- **입력:** 자체 제작 연습곡(앱 고유 코드 진행/백킹 트랙), BPM, 섹션 루프
- **절차:** 학습 모드(섹션 분할·감속) → 연주 모드(백킹 트랙이 멈추지 않음)
- **채점:** 연주 모드 박 1 체인지 성공률, 멈춤 횟수, 완주 여부, 암기 플래그
- **복습 스케줄:** 완주 달성 후 1주 → 2주 → 1개월 → 3개월 → 6개월 → 1년 [근거: bg-2001]

### 5.5 Beginner 1 졸업 시험 (Stage 7 → 8)

[근거: b1-710 Grade 1 통과 5대 기준을 측정 가능하게 변환]
1. 튜너 사용 6줄 튜닝 완료
2. 무작위 순서 8코드 퀴즈: 이름 제시 → 형성·스트럼, 코드별 clean ≥50%
3. 핵심 25쌍 중 무작위 5쌍 각각 1분 체인지 ≥30
4. 표준 패턴 `D DU UDU` 80 BPM 8마디 hit_rate ≥90%(주의 분산 모드 포함)
5. 연습곡 5개 암기 완주(악보 숨김)

### 5.6 핵심 체인지 쌍 (8개 개방 코드 기준 25쌍)

`A–C, A–G, A–E, A–Em, A–D, A–Dm, C–G, C–E, C–D, C–Dm, C–Am, C–Em, G–E, G–D, G–Dm, G–Am, G–Em, E–D, E–Dm, E–Am, D–Am, D–Em, Dm–Am, Dm–Em, Am–Em` [근거: b1-702]. D–Dm, E–Em 같은 쌍은 곡에서 필요할 때만 추가.

### 5.7 안전·피로 규칙

- 첫 4주: 세션 상한 20분(연장 시 확인 대화상자), 주 4회 이상 권장 [근거: b1-113 "20 minutes a day, four days a week"]
- 연속 연습 30분 후 강제 휴식 알림 [근거: bg-1801]
- 세션 시작 워밍업 1–2분 필수(스트레칭/가벼운 피킹) [근거: PRMD 연구 — 워밍업 미실시가 위험요인]
- 세션 종료 시 통증 0–10 자가보고: ≥5 → 다음 세션 손끝 부하 항목(코드 정밀, 1분 체인지) 50% 감량; "날카로운 통증, 저림, 관절/손목 통증" → 연습 중단 및 휴식 안내 (의학적 조언 아님 고지)
- 새끼손가락/스트레칭 항목은 통증이 아닌 "늘어나는 느낌"까지만 [근거: b1-401, b2-801]

### 5.8 지표 대시보드

- 쌍별 1분 체인지 추세(최고/중앙값), 코드별 clean 비율, 패턴별 최고 통과 BPM, 타이밍 `mean_offset_ms`/`sd_offset_ms` 추세, 일일 연습 시간·연속일, SRS 복습 대기 수, 스테이지 진급 체크리스트 진행률
- 정체 감지: 2주간 핵심 지표 개선 없음 → 대체 연습 처방 또는 조건부 진급 제안

---

## Sources

**JustinGuitar (justinguitar.com — Cloudflare 차단으로 Wayback Machine 사본에서 본문 추출. 원 URL 표기)**
- One Minute Changes Exercise: https://www.justinguitar.com/guitar-lessons/one-minute-changes-exercise-b1-110
- How To Play The D Chord (Chord Perfect 4단계): https://www.justinguitar.com/guitar-lessons/how-to-play-the-d-chord-b1-105
- Positive Finger Placement: https://www.justinguitar.com/guitar-lessons/positive-finger-placement-b1-103
- How To Use Anchor Fingers: https://www.justinguitar.com/guitar-lessons/how-to-use-anchor-fingers-b1-109
- How To Minimize Finger Pain: https://www.justinguitar.com/guitar-lessons/how-to-minimize-finger-pain-b1-113
- Module 1 Practice Routine: https://www.justinguitar.com/guitar-lessons/module-1-practice-routine-b1-116
- Using My Practice Assistant: https://www.justinguitar.com/guitar-lessons/using-my-practice-assistant-b1-117
- When to move on from Module 1: https://www.justinguitar.com/guitar-lessons/when-to-move-on-from-module-1-b1-118
- Chord Changes For One: https://www.justinguitar.com/guitar-lessons/chord-changes-for-one-b1-206
- Module 2 Practice Routine: https://www.justinguitar.com/guitar-lessons/module-2-practice-routine-b1-209
- Strumming Patterns With Ups: https://www.justinguitar.com/guitar-lessons/strumming-patterns-with-ups-b1-307
- Module 3 Practice: https://www.justinguitar.com/guitar-lessons/module-3-practice-b1-311
- Beginner Finger Stretches: https://www.justinguitar.com/guitar-lessons/beginner-finger-stretches-b1-401
- Meet The Metronome: https://www.justinguitar.com/guitar-lessons/meet-the-metronome-b1-403
- THE Strumming Pattern (Old Faithful): https://www.justinguitar.com/guitar-lessons/the-strumming-pattern-b1-404
- Module 4 Practice: https://www.justinguitar.com/guitar-lessons/module-4-practice-b1-408
- Module 5 Practice: https://www.justinguitar.com/guitar-lessons/module-5-practice-b1-508
- Beginner Alternate Picking: https://www.justinguitar.com/guitar-lessons/beginner-alternate-picking-b1-601
- The G Chord… Hacked: https://www.justinguitar.com/guitar-lessons/the-g-chord-hacked-b1-602
- Forcing Chord Changes: https://www.justinguitar.com/guitar-lessons/forcing-chord-changes-b1-606
- Module 6 Practice: https://www.justinguitar.com/guitar-lessons/module-6-practice-b1-608
- Best Chord Changes To Work On (25쌍): https://www.justinguitar.com/guitar-lessons/best-chord-changes-to-work-on-b1-702
- Air Changes: https://www.justinguitar.com/guitar-lessons/air-changes-aspire-to-this-b1-703
- Open Strings Between Changes: https://www.justinguitar.com/guitar-lessons/open-strings-between-changes-b1-704
- Why Do Ear Training: https://www.justinguitar.com/guitar-lessons/why-do-ear-training-b1-708
- How To Pass Grade 1: https://www.justinguitar.com/guitar-lessons/how-to-pass-grade-1-b1-710
- Module 7 Practice: https://www.justinguitar.com/guitar-lessons/module-7-practice-b1-711
- Consolidation Practice Tip: https://www.justinguitar.com/guitar-lessons/consolidation-practice-tip-b1-712
- The Stuck 3&4 Chords: https://www.justinguitar.com/guitar-lessons/the-stuck-3-4-chords-b2-801
- Perfect Fast Changes: https://www.justinguitar.com/guitar-lessons/perfect-fast-changes-b2-802
- All Down 8th Note Strumming: https://www.justinguitar.com/guitar-lessons/all-down-8th-note-strumming-b2-805
- Module 8 Practice: https://www.justinguitar.com/guitar-lessons/module-8-practice-b2-810
- Pinky Workout: https://www.justinguitar.com/guitar-lessons/pinky-workout-b2-907
- Module 9 Practice Schedule: https://www.justinguitar.com/guitar-lessons/module-9-practice-schedule-b2-911
- Module 10 Practice Schedule: https://www.justinguitar.com/guitar-lessons/module-10-practice-schedule-bg-1012
- Module 11 Practice: https://www.justinguitar.com/guitar-lessons/module-11-practice-bg-1109
- Module 12 Practice Schedule: https://www.justinguitar.com/guitar-lessons/module-12-practice-schedule-bg-1208
- Module 13 Practice: https://www.justinguitar.com/guitar-lessons/module-13-practice-bg-1308
- Module 14 Practice: https://www.justinguitar.com/guitar-lessons/module-14-practice-bg-1410
- The Finger Gym: https://www.justinguitar.com/guitar-lessons/play-better-guitar-the-finger-gym-exercise-bg-1503
- Module 15 Practice Routine: https://www.justinguitar.com/guitar-lessons/module-15-practice-routine-bg-1509
- Perfectly Starts Slowly: https://www.justinguitar.com/guitar-lessons/perfectly-starts-slowly-bg-1801
- The Spacing Effect: https://www.justinguitar.com/guitar-lessons/the-spacing-effect-bg-2001
- Bridging Beginner to Intermediate Practice Routines: https://www.justinguitar.com/guitar-lessons/bridging-beginner-to-intermediate-practice-routines-bg-2201
- Supercharge Your Practice With Timeboxing: https://www.justinguitar.com/guitar-lessons/supercharge-your-guitar-practice-with-timeboxing-bg-001
- Five Golden Rules of Technique Practice: https://www.justinguitar.com/guitar-lessons/five-golden-rules-of-technique-practice-te-002
- How To Practice Scales: https://www.justinguitar.com/guitar-lessons/how-to-practice-scales-sc-102
- Beginner's Practice Routine (구버전 단계형 루틴): https://www.justinguitar.com/guitar-lessons/beginners-practice-routine-pc-501
- Wayback Machine 접근 경로 예: https://web.archive.org/web/2025/https://www.justinguitar.com/guitar-lessons/one-minute-changes-exercise-b1-110
- YouTube "Get FASTER Chord Changes On Guitar!" (메타데이터만 확인): https://www.youtube.com/watch?v=mAgc7hr44WM
- YouTube 재생목록 (사용자 제공): https://www.youtube.com/playlist?list=PLlwfspJqZ126JHOY5rTkKCSAp2Ua907-v

**연구 문헌**
- Carter & Grahn (2016), Optimizing Music Learning: Blocked vs Interleaved, Frontiers in Psychology: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4989027/
- Stambaugh (2011), When Repetition Isn't the Best Practice Strategy (JRME 58(4)): https://digitalcommons.georgiasouthern.edu/music-facpubs/2
- Duke, Simmons & Cash (2009), It's Not How Much; It's How (JRME) — 2차 인용 확인: https://www.eca.usp.br/acervo/producao-academica/002984292.pdf
- Simmons & Duke (2006), Effects of Sleep on Performance of a Keyboard Melody (JRME): https://cml.music.utexas.edu/research/skill-learning-and-procedural-memory
- Macnamara & Maitra (2019), Revisiting Ericsson, Krampe & Tesch-Römer (1993): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6731745/
- Repp & Su (2013), Sensorimotor synchronization review (Psychonomic Bulletin & Review); Repp (2005) 관련 2차 인용: https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2015.00154/pdf , https://link.springer.com/10.1007/s00426-018-1043-2
- PRMD in student guitar players (University of Limerick, 244명, 40.98%): https://researchrepository.ul.ie/articles/online_resource/The_prevalence_of_playing-related_musculoskeletal_disorders_to_the_upper_limb_in_student_guitar_players/19857547/1
- Guitar playing health considerations (Iowa Protocols): https://iowaprotocols.medicine.uiowa.edu/protocols/guitar-playing-part-1-health-considerations-music-and-medicine-monday
- Musicians' PRMD risk factors (warm-up/breaks), Frontiers in Psychology 2024: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1386661/text

**미확인 항목 요약:** OMC에서 체인지마다 1회 스트럼 여부(영상 미시청), Chord Perfect 반복 횟수 지정, M10–14 및 Grade 3 모듈 제목/번호 매핑, 6/8 패턴 세부, Cepeda 2006 메타분석 수치, 굳은살 형성 기간, +4/+5 BPM 증분의 실험 근거, 3장 타 강사 커리큘럼 세부 전부, 오디오 기반 줄별 판정·업/다운 판별의 기술적 정확도.
