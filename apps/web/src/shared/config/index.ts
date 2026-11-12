export const SESSION_COOKIE = "raon_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export const THEME_COOKIE = "raon_theme";
/** 마지막으로 고른 웹툰·웹소설 모드. 첫 화면이 이 값으로 열린다. */
export const MODE_COOKIE = "raon_mode";
export const VIEWER_COOKIE = "raon_viewer";
/** 뷰어 글자 크기(px)와 줄 간격의 범위. 설정 화면과 첫 그림 전 스크립트가 같은 범위를 쓴다. */
export const VIEWER_LIMITS = { size: { min: 14, max: 28 }, leading: { min: 1.5, max: 2.4 } } as const;
export const VIEWER_THEMES = ["auto", "white", "gray", "black"] as const;
export const VIEWER_FONTS = ["serif", "batang", "sans"] as const;
export const EPISODE_GOAL_COOKIE = "raon_episode_goal";
export const EDITOR_PREFS_COOKIE = "raon_editor_prefs";
/** 에디터 상용구. 원고가 아니라 작가가 등록한 짧은 글이므로 로그아웃해도 남긴다. */
export const PHRASES_KEY = "raon:phrases";
/** 사용자가 정한 자동 대치 규칙. 상용구처럼 원고가 아니므로 로그아웃해도 남긴다. */
export const REPLACE_RULES_KEY = "raon:replace-rules";
/** 저장하지 못한 회차 원고의 로컬 백업. 공개 전 글이므로 로그아웃할 때 지운다. */
export const EPISODE_BACKUP_PREFIX = "raon:episode-backup:";
/** 마지막 로그아웃 시각. 열려 있는 다른 탭의 에디터가 백업을 쓰기 전에 확인한다. */
export const LOGOUT_SIGNAL_KEY = "raon:logged-out";

/**
 * 첫 화면을 그리기 전에 쿠키에 저장한 테마와 뷰어 설정을 html 속성에 적용한다.
 * 페이지를 새로 열 때 밝은 화면이 잠깐 비치지 않게 하기 위해서다. 라이브러리가 로드되기 전에 실행되므로 직접 읽는다.
 */
export const PREFERENCES_SCRIPT = `(function(){try{var d=document.documentElement;function g(k){var m=document.cookie.match(new RegExp("(?:^|; )"+k+"=([^;]*)"));return m?decodeURIComponent(m[1]):null}function c(n,lo,hi){return typeof n==="number"&&isFinite(n)?Math.min(hi,Math.max(lo,n)):null}var t=g(${JSON.stringify(THEME_COOKIE)});if(t==="light"||t==="dark")d.dataset.theme=t;var r=g(${JSON.stringify(VIEWER_COOKIE)});var v=r&&JSON.parse(r);if(v){if(${JSON.stringify(VIEWER_THEMES)}.indexOf(v.theme)>=0)d.dataset.viewerTheme=v.theme;if(${JSON.stringify(VIEWER_FONTS)}.indexOf(v.font)>=0)d.dataset.viewerFont=v.font;var s=c(v.size,${VIEWER_LIMITS.size.min},${VIEWER_LIMITS.size.max});if(s!==null)d.style.setProperty("--viewer-size",s+"px");var l=c(v.leading,${VIEWER_LIMITS.leading.min},${VIEWER_LIMITS.leading.max});if(l!==null)d.style.setProperty("--viewer-leading",String(Math.round(l*10)/10))}}catch(e){}})()`;
