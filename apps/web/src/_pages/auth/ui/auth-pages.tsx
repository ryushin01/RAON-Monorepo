import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm, SignupForm } from "@/features/auth";
import { safeNextPath } from "@/shared/lib";
import styles from "./auth-pages.module.scss";

export const loginMetadata: Metadata = { title: "로그인" };
export const signupMetadata: Metadata = { title: "회원가입" };

type SearchParams = Promise<{ next?: string }>;

async function LoginFormWithNext({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  const path = safeNextPath(next, "");
  return <LoginForm next={path || undefined} />;
}

export function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main id="main" className={styles.main}>
      <h1 className={styles.title}>로그인</h1>
      <Suspense fallback={<div aria-busy="true" />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
      <p>
        아직 회원이 아니신가요? <Link href="/signup">회원가입</Link>
      </p>
    </main>
  );
}

export function SignupPage() {
  return (
    <main id="main" className={styles.main}>
      <h1 className={styles.title}>회원가입</h1>
      <SignupForm />
      <p>
        이미 회원이신가요? <Link href="/login">로그인</Link>
      </p>
    </main>
  );
}
