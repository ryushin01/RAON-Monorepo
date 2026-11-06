const REVOKE_DELAY_MS = 10_000;

/** 글자를 파일로 내려받는다. 브라우저에서만 호출한다. */
export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // 일부 모바일 브라우저는 내려받기를 늦게 시작하므로 바로 해제하면 빈 파일이 될 수 있다.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
