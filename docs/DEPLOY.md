# 배포 안내 (DEPLOY)

이 앱은 서버 없이 동작하는 정적 웹앱(PWA)입니다. 빌드 결과물 `dist/` 폴더만 정적 호스팅에 올리면 됩니다.
기록은 모두 브라우저 안(IndexedDB, OPFS)에 저장되고 서버로 전송되지 않습니다.

> [!warning] 이 문서는 절차만 설명합니다. 저장소의 자동화(goal 실행)는 배포 명령을 실행하지 않습니다.

## 1. 왜 HTTPS가 꼭 필요한가

- **마이크(`getUserMedia`)**: 브라우저는 보안 컨텍스트(HTTPS 또는 `localhost`)에서만 마이크를 엽니다. HTTP 주소로 열면 마이크 권한 창이 아예 뜨지 않습니다.
- **화면 꺼짐 방지(Screen Wake Lock)**, **서비스 워커(오프라인·홈 화면 앱)**, **저장소 보호(`storage.persist`)**, **OPFS(녹음 키트)** 모두 보안 컨텍스트 전용입니다.
- 아래 네 호스팅은 모두 무료 HTTPS 인증서를 자동으로 붙여 줍니다.

## 2. 빌드

```bash
npm ci
npm run build          # → dist/ (서비스 워커·매니페스트·아이콘 포함)
npm run preview        # 로컬에서 빌드 결과 확인 (http://localhost:4173, localhost라 마이크 사용 가능)
```

하위 경로에 올릴 때(GitHub Pages의 `https://<사용자>.github.io/<저장소>/`)는 `VITE_BASE`를 지정합니다.

```bash
VITE_BASE=/<저장소>/ npm run build
```

해시 라우팅(`#/…`)을 쓰므로 어떤 호스트에서도 "모든 경로를 index.html로" 같은 재작성 규칙이 필요 없습니다.

## 3. 보안 헤더

`public/_headers`(Cloudflare Pages, Netlify)와 `vercel.json`(Vercel)에 같은 헤더가 들어 있습니다.

| 헤더 | 값 / 목적 |
|---|---|
| `Content-Security-Policy` | `default-src 'self'` 기반의 엄격한 정책. 스크립트·워커·AudioWorklet은 같은 출처만, 인라인 스크립트·`eval` 금지. 인라인 `style` 속성만 허용(차트·레이아웃). |
| `Permissions-Policy` | `microphone=(self)`, `screen-wake-lock=(self)`, 카메라·위치 금지 |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

이 CSP 아래에서 AudioWorklet, DSP 워커, 메트로놈 워커, 차트, 합성 재생이 위반 없이 동작하는 것을 E2E(`tests/e2e/csp.mic.spec.ts`)가 확인합니다.
GitHub Pages는 사용자 지정 헤더를 지원하지 않습니다. HTTPS는 제공되므로 앱은 동작하지만 위 헤더는 적용되지 않습니다.

## 4. 호스트별 절차

### Cloudflare Pages
1. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Git 저장소 연결(또는 "Upload assets"로 `dist/` 폴더 직접 업로드).
2. 빌드 설정: Framework preset `None`, Build command `npm run build`, Build output directory `dist`, 환경 변수 `NODE_VERSION=24`.
3. 배포가 끝나면 `https://<프로젝트>.pages.dev`가 생깁니다. `_headers`는 자동 적용됩니다.

### Netlify
1. Netlify → Add new site → Import an existing project(또는 `dist/` 폴더를 드래그해서 바로 배포).
2. Build command `npm run build`, Publish directory `dist`, 환경 변수 `NODE_VERSION=24`.
3. `https://<이름>.netlify.app`. `_headers`가 자동 적용됩니다.

### Vercel
1. Vercel → Add New → Project → 저장소 Import.
2. Framework Preset `Vite`(또는 Other), Build Command `npm run build`, Output Directory `dist`.
3. `vercel.json`의 헤더가 적용됩니다. `https://<이름>.vercel.app`.

### GitHub Pages
1. 저장소 Settings → Pages → Source `GitHub Actions`.
2. 워크플로에서 `VITE_BASE=/<저장소>/ npm run build` 후 `dist/`를 Pages 아티팩트로 업로드(`actions/upload-pages-artifact`, `actions/deploy-pages`).
3. `https://<사용자>.github.io/<저장소>/`로 접속합니다. (헤더 미적용 — 위 3절 참고)

## 5. iPad·iPhone에서 쓰기 (홈 화면에 추가)

1. **Safari**로 배포 주소를 엽니다(다른 브라우저는 홈 화면 앱 설치를 지원하지 않습니다).
2. 공유 버튼(네모에서 화살표) → **홈 화면에 추가** → 이름 확인 → 추가.
3. 홈 화면의 "기타" 아이콘으로 실행합니다. 주소창 없이 전체 화면으로 열리고, 한 번 열어 둔 뒤에는 인터넷이 없어도 열립니다.
4. 처음 실행하면 마이크 권한을 묻습니다 → **허용**. 거부했다면 설정 앱 → Safari(또는 해당 앱) → 마이크에서 다시 허용할 수 있습니다.
5. Safari는 오래 쓰지 않은 사이트의 저장 데이터를 지울 수 있습니다. 홈 화면 앱으로 설치하면 훨씬 안전하고, 앱의 **설정 → 백업 → 내보내기**로 가끔 백업해 두세요(7일이 지나면 홈에 알림이 뜹니다).
6. 기기를 기타에서 30–60 cm 떨어진 곳에 두고, **블루투스 이어폰이 아닌 기기 내장 마이크**를 쓰세요.

## 6. 같은 Wi-Fi의 iPad로 개발 서버 테스트 (`npm run dev:https`)

1. MacBook과 iPad를 같은 Wi-Fi에 연결합니다.
2. `npm run dev:https` → 터미널에 `https://192.168.x.x:5173/` 같은 Network 주소가 나옵니다(자체 서명 인증서).
3. iPad Safari에서 그 주소를 엽니다. "이 연결은 비공개 연결이 아닙니다" 경고가 뜨면 **세부사항 보기 → 이 웹 사이트 방문** → 다시 **웹 사이트 방문**을 눌러 통과합니다(개발용 인증서이므로 정상입니다).
4. 마이크 권한을 허용하고 테스트합니다. 인증서 경고를 통과해도 HTTPS이므로 마이크·Wake Lock이 동작합니다.
5. MacBook의 Chrome에서는 `chrome://flags`가 아니라 같은 방식으로 "고급 → 안전하지 않음으로 이동"을 눌러 통과할 수 있습니다. 로컬 확인만이라면 `npm run dev`(localhost)로도 충분합니다.

## 7. 업데이트

새 버전을 배포하면 앱은 연습 중에 저절로 새로고침하지 않습니다. 다음에 **홈 화면**을 열 때 "새 버전이 있어요" 안내가 뜨고, "지금 업데이트"를 누르면 적용됩니다.
