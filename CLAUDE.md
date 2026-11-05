# RAON 프로젝트 규칙

## 커밋 표기 (전역 규칙의 예외)

전역 CLAUDE.md는 커밋과 PR에 Claude 표기를 넣지 않도록 하지만, 이 레포에서는 아래 예외를 따릅니다.

- NestJS 코드(`apps/api`)를 바꾼 커밋의 메시지 끝에 공동 작성자를 넣습니다.

  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

- `apps/api`를 바꾸지 않은 커밋과 PR 본문에는 Claude 표기를 넣지 않습니다.
- 표기 범위가 섞이지 않도록 `apps/api` 변경은 다른 앱의 변경과 커밋을 나눕니다.

## 프로젝트 요약

웹소설 연재·감상 플랫폼. Yarn 4 + Turborepo 모노레포입니다. yarn만 씁니다(`yarnPath`로 버전 고정).

- `apps/web`: Next.js(포트 3100). FSD 구조. 스타일은 Sass CSS Modules이며 테마는 흑백입니다.
- `apps/api`: NestJS(포트 4000). ESM. Drizzle + PostgreSQL(개발은 PGlite). 개발 계정 비밀번호는 `raon1234`.
- `packages/contracts`: 웹과 API가 함께 쓰는 zod 스키마와 타입.

변경 전에 `docs/development.md`를 읽습니다. 완료 기준은 `yarn lint && yarn typecheck && yarn test && yarn build && yarn build-storybook && yarn e2e`입니다.

Yarn은 공개된 지 24시간이 안 된 패키지를 설치하지 않습니다. 이 설정을 끄지 말고 직전 버전을 씁니다.
