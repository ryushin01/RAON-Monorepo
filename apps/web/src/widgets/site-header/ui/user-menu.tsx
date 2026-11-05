import Link from "next/link";
import { getCurrentUser } from "@/entities/session/index.server";
import { LogoutButton } from "@/features/auth";
import { CartLink } from "@/features/cart";
import styles from "./site-header.module.scss";

export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <Link href="/login" className={styles.utilityLink}>
          로그인
        </Link>
        <Link href="/signup" className={styles.utilityLink}>
          회원가입
        </Link>
      </>
    );
  }

  return (
    <>
      <span className={styles.who}>{user.nickname}님</span>
      {user.role === "AUTHOR" ? (
        <Link href="/studio" className={styles.utilityLink}>
          작가 스튜디오
        </Link>
      ) : (
        <>
          <CartLink className={styles.utilityLink} />
          <Link href="/my" className={styles.utilityLink}>
            내 서재
          </Link>
        </>
      )}
      <LogoutButton />
    </>
  );
}
