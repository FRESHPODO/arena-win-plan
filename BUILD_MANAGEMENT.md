# 빌드 관리 안내

사이트의 게시 빌드는 `data/builds/` 아래에서 빌드 하나당 JSON 파일 하나로 관리합니다.
`index.json`은 직접 편집하지 않고 스크립트로 다시 생성합니다.

## 빌드 추가

1. 로컬 사이트에서 **빌드 작성**을 열어 내용을 입력합니다.
2. 미리보기에서 **파일로 저장**을 눌러 JSON 파일을 내려받습니다.
3. 내려받은 파일을 `data/builds/`에 복사합니다.
4. 다음 명령으로 목록을 갱신하고 전체 데이터를 검증합니다.

```powershell
npm run index:builds
npm run check
```

5. 로컬에서 확인합니다.

```powershell
npm start
```

6. 변경 내용을 커밋하고 `main` 브랜치에 올립니다.

```powershell
git add data/builds
git commit -m "Add build: 빌드 이름"
git push
```

GitHub Actions는 배포할 때 빌드 인덱스를 다시 생성하고 검증을 통과한 파일만 게시합니다.

## 빌드 수정 또는 삭제

- 수정: 같은 `id`의 JSON 파일을 교체한 뒤 위 검증 절차를 반복합니다.
- 삭제: 해당 JSON 파일을 삭제하고 `npm run index:builds`를 실행합니다.
- 파일명은 URL에 직접 사용되지 않지만, 영문 소문자·숫자·하이픈 조합을 권장합니다.
- `id`는 다른 빌드와 중복될 수 없습니다.
- `representative.icon`은 해당 빌드의 아이템 또는 증강 아이콘 중 하나여야 합니다.
- 이미지 경로는 저장소 루트 기준 상대 경로로 작성합니다.

## 배포 흐름

`main` 브랜치에 push하면 `.github/workflows/pages.yml`이 다음 작업을 수행합니다.

1. 빌드 인덱스 재생성
2. 데이터와 이미지 경로 검증
3. 게시 파일을 `_site`로 구성
4. GitHub Pages에 배포

배포 실패 시 GitHub 저장소의 **Actions → Publish Arena Build** 실행 로그를 확인합니다.
