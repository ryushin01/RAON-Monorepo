import { downloadText } from "./download";

it("파일 이름과 형식을 지정해 내려받고 임시 주소를 정리한다", async () => {
  const blobs: Blob[] = [];
  URL.createObjectURL = jest.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:test";
  });
  URL.revokeObjectURL = jest.fn();
  const names: string[] = [];
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download);
  });

  jest.useFakeTimers();
  downloadText("원고.txt", "본문", "text/plain");
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  jest.runAllTimers();
  jest.useRealTimers();

  expect(names).toEqual(["원고.txt"]);
  expect(blobs[0]?.type).toBe("text/plain;charset=utf-8");
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  expect(document.querySelector("a")).toBeNull();
  click.mockRestore();
});
