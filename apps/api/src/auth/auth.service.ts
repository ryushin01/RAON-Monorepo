import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { type AuthResult, type LoginInput, ROLE_LABEL, type SignupInput, type User } from "@raon/contracts";
import { eq, or } from "drizzle-orm";
import type { Database } from "../db/database.js";
import { DB } from "../db/database.module.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "./password.js";

/** 없는 이메일에도 같은 시간을 쓰게 해 가입 여부가 응답 시간으로 드러나지 않게 한다. */
const DUMMY_HASH = hashPassword("raon-dummy-password");

const toUser = (row: typeof users.$inferSelect): User => ({
  id: row.id,
  email: row.email,
  nickname: row.nickname,
  role: row.role,
  coinBalance: row.coinBalance,
});

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await this.db
      .select({ email: users.email, nickname: users.nickname })
      .from(users)
      .where(or(eq(users.email, input.email), eq(users.nickname, input.nickname)));
    if (existing.some((u) => u.email === input.email)) {
      throw new ConflictException({
        statusCode: 409,
        message: "이미 가입한 이메일입니다.",
        fieldErrors: { email: "이미 가입한 이메일입니다." },
      });
    }
    if (existing.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: "이미 쓰고 있는 닉네임입니다.",
        fieldErrors: { nickname: "이미 쓰고 있는 닉네임입니다." },
      });
    }

    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email,
        nickname: input.nickname,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      })
      .returning();
    return this.issue(toUser(row!));
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const [row] = await this.db.select().from(users).where(eq(users.email, input.email));
    const valid = await verifyPassword(input.password, row?.passwordHash ?? (await DUMMY_HASH));
    if (!row || !valid) throw new UnauthorizedException("이메일 또는 비밀번호를 확인해 주세요.");
    if (row.role !== input.role) {
      throw new UnauthorizedException(
        `${ROLE_LABEL[row.role]} 계정입니다. ${ROLE_LABEL[row.role]} 로그인을 선택해 주세요.`,
      );
    }
    return this.issue(toUser(row));
  }

  async me(userId: string): Promise<User> {
    const [row] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!row) throw new UnauthorizedException("로그인이 필요합니다.");
    return toUser(row);
  }

  private async issue(user: User): Promise<AuthResult> {
    return { accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }), user };
  }
}
