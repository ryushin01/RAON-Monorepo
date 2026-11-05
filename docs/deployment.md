# CI·배포

## CI (`.github/workflows/ci.yml`)

푸시와 PR마다 운영 의존성 취약점 점검, 린트, 타입 검사, 단위 테스트, 빌드, 스토리 빌드, E2E를 실행합니다.

## CD (`.github/workflows/cd.yml`)

`main`의 CI가 통과하면 `apps/api`와 `apps/web`의 도커 이미지를 만들어 GitHub Container Registry에 올립니다.

```text
ghcr.io/ryushin01/raon-api:<커밋 SHA 또는 latest>
ghcr.io/ryushin01/raon-web:<커밋 SHA 또는 latest>
```

운영 서버로 내보내는 단계는 호스팅을 정한 뒤 이 워크플로 끝에 추가합니다.

## 환경 변수

| 앱  | 이름           | 필수      | 내용                                                                                   |
| --- | -------------- | --------- | -------------------------------------------------------------------------------------- |
| api | `DATABASE_URL` | 운영 필수 | PostgreSQL 주소. 비우면 PGlite를 씁니다.                                               |
| api | `JWT_SECRET`   | 운영 필수 | 토큰 서명 키. `openssl rand -base64 48`로 만듭니다. 없으면 운영에서 시작하지 않습니다. |
| api | `PORT`         |           | 기본 4000                                                                              |
| api | `SEED_DEMO`    |           | 운영에서 가상 데이터를 넣을 때만 `1`                                                   |
| web | `API_URL`      | 운영 필수 | Next 서버에서 부를 API 주소. 브라우저에 노출되지 않습니다.                             |

API는 외부에 공개하지 말고 웹 서버에서만 닿게 둡니다. 로그인 시도 제한과 `use cache`는 프로세스 메모리에 있으므로, 인스턴스를 여러 개 띄우려면 공유 저장소(Redis 등)와 [cacheHandlers](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) 설정이 필요합니다.

## CodeRabbit

설정은 `.coderabbit.yaml`에 있습니다. 동작하려면 [CodeRabbit GitHub 앱](https://github.com/apps/coderabbitai)을 이 저장소에 설치해야 합니다.
