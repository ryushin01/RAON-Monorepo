export const SESSION_COOKIE = "raon_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export const THEME_COOKIE = "raon_theme";
export const VIEWER_COOKIE = "raon_viewer";
/** 저장하지 못한 회차 원고의 로컬 백업. 공개 전 글이므로 로그아웃할 때 지운다. */
export const EPISODE_BACKUP_PREFIX = "raon:episode-backup:";
/** 마지막 로그아웃 시각. 열려 있는 다른 탭의 에디터가 백업을 쓰기 전에 확인한다. */
export const LOGOUT_SIGNAL_KEY = "raon:logged-out";

/**
 * 첫 화면을 그리기 전에 쿠키에 저장한 테마와 뷰어 설정을 html 속성에 적용한다.
 * 페이지를 새로 열 때 밝은 화면이 잠깐 비치지 않게 하기 위해서다. 라이브러리가 로드되기 전에 실행되므로 직접 읽는다.
 */
export const PREFERENCES_SCRIPT = `(function(){try{var d=document.documentElement;function g(k){var m=document.cookie.match(new RegExp("(?:^|; )"+k+"=([^;]*)"));return m?decodeURIComponent(m[1]):null}var t=g(${JSON.stringify(THEME_COOKIE)});if(t==="light"||t==="dark")d.dataset.theme=t;var r=g(${JSON.stringify(VIEWER_COOKIE)});var v=r&&JSON.parse(r);if(v){d.dataset.viewerTheme=v.theme;d.dataset.viewerFont=v.font;d.style.setProperty("--viewer-size",Number(v.size)+"px");d.style.setProperty("--viewer-leading",String(Number(v.leading)))}}catch(e){}})()`;
