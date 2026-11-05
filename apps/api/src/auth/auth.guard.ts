import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Role } from "@raon/contracts";

export interface AuthUser {
  id: string;
  role: Role;
}

interface AuthedRequest {
  headers: { authorization?: string };
  user?: AuthUser;
}

const ROLES_KEY = "raon:roles";
const OPTIONAL_KEY = "raon:optional-auth";

/** 이 역할만 호출할 수 있다. 붙이지 않으면 로그인만 확인한다. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** 토큰이 없어도 통과시키고, 있으면 request.user를 채운다. */
export const OptionalAuth = () => SetMetadata(OPTIONAL_KEY, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().user,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_KEY, targets) ?? false;
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];

    if (!token) {
      if (optional) return true;
      throw new UnauthorizedException("로그인이 필요합니다.");
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: Role }>(token);
      request.user = { id: payload.sub, role: payload.role };
    } catch {
      if (optional) return true;
      throw new UnauthorizedException("로그인이 만료되었습니다. 다시 로그인해 주세요.");
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(request.user.role)) {
      throw new ForbiddenException(
        roles.includes("AUTHOR") ? "작가 계정만 이용할 수 있습니다." : "일반 회원 계정만 이용할 수 있습니다.",
      );
    }
    return true;
  }
}
