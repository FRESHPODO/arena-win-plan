# WIN PLAN · 아레나 빌드

GitHub Pages용 정적 빌드 보관함. 설치할 라이브러리 없이 HTML, CSS, JavaScript와 기존 이미지로 동작합니다.

## 미리보기

Node.js 설치 후 이 폴더에서 `npm start`를 실행하고 http://127.0.0.1:4173 에 접속합니다. HTML 파일을 직접 더블클릭하면 데이터 읽기가 제한될 수 있습니다.

## GitHub Pages 게시

1. GitHub 저장소를 만들고 이 폴더의 파일을 main 브랜치에 올립니다. `.github/workflows/pages.yml`도 포함하세요.
2. 저장소 Settings → Pages → Build and deployment → Source에서 **GitHub Actions**를 선택합니다.
3. Actions에서 **Publish Arena Build**를 실행합니다. 이후 main에 변경을 올리면 자동 배포됩니다.
4. 배포가 끝나면 Settings → Pages에 표시되는 주소를 엽니다.

공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 빌드 추가·편집

반복 작업용 체크리스트와 Git 명령은 [`BUILD_MANAGEMENT.md`](BUILD_MANAGEMENT.md)에 정리되어 있습니다.

- 웹사이트의 **빌드 작성** 또는 상세 화면의 **빌드 편집**을 선택합니다.
- 아이템·증강·챔피언은 한국어 이름으로 표시되며 한글·영문·ID로 검색할 수 있습니다. 추천 챔피언 목록에는 아레나의 용기(Bravery) 선택 아이콘도 포함됩니다. 추가한 구성의 표시 이름은 자유롭게 수정할 수 있습니다.
- 아이템 선택 목록은 같은 한국어 이름을 하나로 합치고 프리즘 → 전설 → 모루 → 소비 순, 같은 등급에서는 한글 이름순으로 표시합니다. 프리즘이 있으면 우선하고 나머지는 작은 ID를 사용합니다. 기존 빌드의 이미지 연결을 유지하도록 원본 데이터와 파일은 보존합니다.
- 핵심 체크를 해제하면 보조 구성이 됩니다. 대표 아이콘은 추가한 아이템·증강 중 하나를 선택합니다.
- 미리보기 후 **파일로 저장**을 누르면 현재 빌드 하나만 담긴 `<빌드ID>.json`이 내려받아집니다.
- 다운로드한 파일을 `data/builds/`에 추가하거나 같은 ID의 파일을 교체합니다. `npm run index:builds`로 목록을 갱신합니다. GitHub 배포에서는 자동 갱신됩니다.
- 삭제는 `data/builds/`에서 해당 파일을 제거한 뒤 목록을 갱신합니다. 정렬은 등록일 내림차순입니다.

작성 화면은 공개 파일을 직접 변경하지 않습니다. 다운로드 전 새로고침하거나 화면을 벗어나면 작성 내용이 사라집니다. 공유 게시물은 저장소의 JSON이 기준이며 브라우저 저장소에 의존하지 않습니다. 각 빌드는 독립 파일로 관리됩니다. 기존 통합 파일은 `data/builds.legacy-backup.json`에 백업되어 있으며 사이트에서는 읽지 않습니다.

주소는 `#/build/빌드ID` 형식으로 공유할 수 있고 GitHub Pages 하위 경로 및 새로고침을 지원합니다. 터치로 아이콘을 누르면 상세 화면이 열리고 키보드 Tab으로도 이름을 확인할 수 있습니다.

## 검증

상단 **도감**(`#/encyclopedia`)에서 아이템·증강의 목록, 등급 필터, 한글·영문·ID 검색과 아이콘 설명을 확인합니다. 증강 선택창도 실버·골드·프리즘 탭을 제공합니다. 아이템 고유 효과 제목은 원문의 `passive` / `active` 태그를 기준으로 구분하며 제목 안에는 스탯 아이콘을 삽입하지 않습니다.

업데이트된 능력치 아이콘 연결은 `data/stat-icons.json`을 기준으로 합니다. PNG·WebP·SVG 형식을 지원하며 `scripts/extract-icon-colors.py`가 해당 파일의 대표색을 `data/icon-colors.json`으로 갱신합니다. 아이템별 메모는 작성 화면에서 입력하고 기존 다운로드 절차로 저장합니다. 메모는 상세 카드 이름 아래 표시되고 프리즘 아이템에는 별도 강조 테두리가 적용됩니다.

현재 아이템 DB의 모든 스탯 이름에 아이콘을 연결했습니다. 마나·생명력 흡수·강인함·재생·관통·치명타·회복/보호막 등 원본 아이콘이 준비되지 않은 항목은 교체 가능한 `imgs/stats/*-placeholder.svg`를 사용합니다. 생성 스크립트는 `scripts/create-stat-placeholders.cjs`입니다.

증강 설명은 `data/augment-descriptions.ko.json`에 한국어로 저장됩니다. `pwsh -File scripts/update-augment-descriptions.ps1`로 갱신합니다. 상세 페이지에서 증강 아이콘을 가리키거나 누르면 중앙 아이콘 → 이름 → 설명 순으로 열리고 실버·골드·프리즘 테두리를 표시합니다. 원문, 수치 데이터, 미해결 변수 목록을 보존하며 정적으로 계산할 수 없는 값은 ‘상황에 따라 변동’으로 표시합니다. 여러 단계의 값은 `/`로 구분합니다. 적응형 능력치 아이콘은 `imgs/stats/adaptive-placeholder.svg` 임시 파일입니다.

아이템 선택창은 프리즘·전설·모루·소비 탭으로 분리되어 있으며 검색은 현재 탭 안에서 수행됩니다. `scripts/complete-item-assets.ps1`은 아레나용 무라마나·대천사의 포옹·종말의 겨울, 원본 능력치 아이콘과 설명 DB를 보완합니다. 설명에는 주요 키워드의 색상과 능력치 아이콘을 표시합니다. 적중 시 효과는 임시 SVG `imgs/stats/onhit-placeholder.svg`를 사용하며 이 파일을 교체하면 실제 아이콘으로 전환할 수 있습니다. 공식 능력치 아이콘 출처는 `imgs/stats/sources.json`에 있습니다.

상세 페이지의 아이템 아이콘을 가리키거나 키보드로 선택하면 아이콘·이름, 스탯, 고유 효과 순으로 설명 상자가 열립니다. 모바일은 아이콘을 누릅니다. Esc 또는 상자 밖을 누르면 닫힙니다. 한국어 설명 DB는 `data/item-descriptions.ko.json`이며 `pwsh -File scripts/update-item-descriptions.ps1`로 갱신합니다. 원문과 출처·수집 시점을 보존합니다. 기본 설명은 해당 아이템 ID의 클라이언트 데이터이며, 모드별 변형 및 챔피언에 따른 동적 수치는 계산하지 않습니다. 원본에 0 또는 일반적인 표현으로 제공된 수치도 그대로 표시합니다.

아이템·증강·챔피언 JSON과 CSV의 `name`, `nameKo`는 한국어 이름이고 `nameEn`은 보존한 영문 이름입니다. 한국어 출처와 갱신 시점은 `imgs/localization.json`에 기록됩니다. `pwsh -File scripts/localize-assets.ps1`로 이름만 갱신할 수 있으며, 이미지 갱신 스크립트도 마지막에 한국어 이름을 반영합니다.

`npm run check`로 빌드 데이터, 대표 아이콘 및 전체 이미지 목록의 파일 경로를 검증합니다.

첫 빌드는 사용자가 제공한 컨셉 이미지 내용을 옮긴 예시이며 최신 게임 효과를 별도 검증한 공략은 아닙니다. 이미지 출처는 `imgs/README.md`, `imgs/sources.json`을 참고하세요.

## 증강 위키 DB

`data/augment-wiki-source.json`은 [LoL Wiki Arena/Augments](https://wiki.leagueoflegends.com/en-us/Arena/Augments)의 2026-09-30 수집본입니다. 257개 목록을 기존 DB와 비교해 이름 변경/오타 2개를 대응하고 60개를 추가했습니다. 기존 귀빈 등 위키 밖 항목을 보존하여 총 285개입니다. 삭제된 증강은 설명에 표시합니다.

한글 효과 요약은 `data/augment-wiki-effects.ko.txt`, 레벨별 계수는 `data/augment-wiki-levels.ko.txt`에 있습니다. 위키를 바탕으로 번역·요약했으며 원문과 함께 CC BY-SA 3.0으로 제공합니다. 공식 한국어 이름은 `data/augment-official-names.json`에 게임 문자열 키와 출처를 기록했습니다. 아이콘 출처는 `data/augment-wiki-icons.json`입니다. 신규 60개 모두 실제 아이콘을 연결했습니다. 54개는 게임 자산, 5개는 위키 이미지이며 불길한 서약은 위키와 동일하게 세월의 지혜 아이콘을 공유합니다.

`node scripts/apply-augment-wiki.cjs`로 위키 보완 데이터를 설명 DB와 목록에 재적용합니다. 기존 한국어 설명 갱신 스크립트도 마지막에 이 보완 데이터를 적용합니다. 위키 빈 레벨 칸을 임의 보간하지 않으며, 본문의 챔피언 레벨 비례 수치는 범위로 보존합니다. 설명창의 조절 대상은 **증강 레벨**이며, 챔피언 레벨/장비 스탯을 입력하는 피해 계산기는 아닙니다. 휠 위로 증가, 아래로 감소하며 ± 버튼 및 아이콘에서 위/아래 방향키도 지원합니다. 선택 레벨은 현재 세션의 설명 미리보기에만 적용됩니다.

아이템 DB는 data/item-arena-source.json의 Data Dragon 16.19.1 아레나(맵 30) 스냅샷을 사용합니다. node scripts/apply-arena-items.cjs로 재생성합니다. 일반 모드 아이템 ID는 설명 DB의 aliases를 통해 기존 빌드와 호환되며, 새 패치 적용 시 스냅샷도 함께 갱신해야 합니다.

