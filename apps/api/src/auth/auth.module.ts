import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { LoginThrottlerGuard } from "./login-throttler.guard.js";

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("운영 환경에는 JWT_SECRET이 필요합니다.");
  return "raon-development-only-secret";
}

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: jwtSecret(), signOptions: { expiresIn: "7d" } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, LoginThrottlerGuard],
  exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
