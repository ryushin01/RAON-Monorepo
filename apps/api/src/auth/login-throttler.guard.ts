import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";

const LIMIT = 10;
const WINDOW_MS = 60_000;

/**
 * 이메일별 로그인 시도 제한. API는 Next 서버 뒤에 있어 모든 요청의 IP가 같으므로 이메일로 센다.
 * 프로세스 메모리에 세므로 인스턴스를 여러 개 띄우면 Redis 같은 공유 저장소로 옮겨야 한다.
 */
@Injectable()
export class LoginThrottlerGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const { body } = context.switchToHttp().getRequest<{ body?: { email?: unknown } }>();
    const key = typeof body?.email === "string" ? body.email.toLowerCase() : "unknown";
    const now = Date.now();

    for (const [email, entry] of this.attempts) {
      if (entry.resetAt <= now) this.attempts.delete(email);
    }

    const entry = this.attempts.get(key) ?? { count: 0, resetAt: now + WINDOW_MS };
    entry.count += 1;
    this.attempts.set(key, entry);

    if (entry.count > LIMIT) {
      throw new HttpException("로그인 시도가 너무 많습니다. 잠시 뒤 다시 시도해 주세요.", HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
