import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { type LoginInput, loginSchema, type SignupInput, signupSchema } from "@raon/contracts";
import { ZodPipe } from "../common/zod.pipe.js";
import { AuthGuard, type AuthUser, CurrentUser } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { LoginThrottlerGuard } from "./login-throttler.guard.js";

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("auth/signup")
  signup(@Body(new ZodPipe(signupSchema)) body: SignupInput) {
    return this.auth.signup(body);
  }

  @Post("auth/login")
  @HttpCode(200)
  @UseGuards(LoginThrottlerGuard)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
