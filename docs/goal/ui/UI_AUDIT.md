# UI_AUDIT — guitar-hero UI 마감 goal

> 형식과 기준은 `docs/goal/ui/SPEC.md` §6을 따른다. 그림은 `npm run ui:shots`의 `ui-shots/<theme>/<viewport>-<screen>-{fold,full}.png`이다(git 밖). 시작 전 기준 그림은 `ui-shots/before/`.

## §1 표식 표

화면마다 `[data-primary-action]`이 감싼 것과 `[data-core-number]`의 위치, 그리고 연습 화면이면 iPad 가로·MacBook의 2단 구성(왼쪽 / 오른쪽)을 적는다.

| 화면 | data-primary-action | data-core-number | 2단 구성(연습 화면) |
|---|---|---|---|

## §2 검토 범위표

칸에는 그 조합을 fold와 full 모두 보고 검토한 커밋(짧은 해시)을 적는다. 그 화면을 마지막으로 바꾼 커밋 이후여야 한다.

| 화면 | 테마 | macbook | ipad-landscape | ipad-portrait | iphone |
|---|---|---|---|---|---|

## §3 발견 표

| ID | 화면 | 뷰포트/테마 | 휴리스틱 | 심각도 | 내용 | 조치 | 상태 | 커밋 |
|---|---|---|---|---|---|---|---|---|
