import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";

/** 긴 회차도 저장되도록 기본값(100KB)을 넘겨 받는다. 한글 3만 자 정도면 기본값을 넘는다. */
const JSON_BODY_LIMIT = "4mb";

/** 실제 서버와 테스트가 같은 설정으로 돌도록 한곳에 모은다. */
export function configureApp(app: NestExpressApplication) {
  app.use(helmet());
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  // 브라우저는 이 API를 직접 부르지 않고 Next 서버를 거치므로 CORS를 열지 않는다.
  app.enableShutdownHooks();
}
