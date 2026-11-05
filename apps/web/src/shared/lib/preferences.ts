import Cookies from "js-cookie";

const ONE_YEAR_DAYS = 365;

/** 화면 설정용 쿠키. 인증 정보는 여기에 두지 않는다. 세션은 스크립트가 읽을 수 없는 httpOnly 쿠키로만 다룬다. */
export function readPreference(name: string): string | undefined {
  return Cookies.get(name);
}

export function writePreference(name: string, value: string): void {
  Cookies.set(name, value, {
    expires: ONE_YEAR_DAYS,
    path: "/",
    sameSite: "lax",
    secure: window.location.protocol === "https:",
  });
}
