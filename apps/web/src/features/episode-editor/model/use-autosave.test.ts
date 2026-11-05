import { renderHook } from "@testing-library/react";
import { useAutosave } from "./use-autosave";

const base = {
  revision: 0,
  savedRevision: 0,
  failedRevision: null,
  enabled: true,
  isSaving: false,
  delayMs: 2000,
  retryMs: 15000,
};
type Props = Omit<Parameters<typeof useAutosave>[0], "save">;

function setup(initial: Props) {
  const save = jest.fn();
  const view = renderHook((props: Props) => useAutosave({ ...props, save }), { initialProps: initial });
  return { save, ...view };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("입력이 멈춘 뒤에만 저장한다", () => {
  const { save, rerender } = setup(base);
  rerender({ ...base, revision: 1 });
  jest.advanceTimersByTime(1000);
  rerender({ ...base, revision: 2 });
  jest.advanceTimersByTime(1999);
  expect(save).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(save).toHaveBeenCalledTimes(1);
});

it("저장 중에 입력이 바뀌면 저장이 끝난 뒤 다시 저장한다", () => {
  const { save, rerender } = setup({ ...base, revision: 2, isSaving: true });
  jest.advanceTimersByTime(5000);
  expect(save).not.toHaveBeenCalled();

  // 1번까지 저장을 마쳤지만 2번이 남아 있다.
  rerender({ ...base, revision: 2, savedRevision: 1, isSaving: false });
  jest.advanceTimersByTime(2000);
  expect(save).toHaveBeenCalledTimes(1);
});

it("실패하면 시간을 두고 다시 시도한다", () => {
  const { save, rerender } = setup({ ...base, revision: 1, failedRevision: 1 });
  jest.advanceTimersByTime(14999);
  expect(save).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(save).toHaveBeenCalledTimes(1);

  // 그 사이 입력이 바뀌면 평소처럼 곧 저장한다.
  rerender({ ...base, revision: 2, failedRevision: 1 });
  jest.advanceTimersByTime(2000);
  expect(save).toHaveBeenCalledTimes(2);
});

it("다시 시도하다 또 실패해도 계속 시도한다", () => {
  const { save, rerender } = setup({ ...base, revision: 1, failedRevision: 1 });
  jest.advanceTimersByTime(15000);
  rerender({ ...base, revision: 1, failedRevision: 1, isSaving: true });
  rerender({ ...base, revision: 1, failedRevision: 1, isSaving: false });
  jest.advanceTimersByTime(15000);
  expect(save).toHaveBeenCalledTimes(2);
});

it("공개한 회차처럼 꺼져 있으면 저장하지 않는다", () => {
  const { save, unmount } = setup({ ...base, revision: 1, enabled: false });
  jest.advanceTimersByTime(5000);
  unmount();
  expect(save).not.toHaveBeenCalled();
});

it("화면을 떠날 때 남은 변경 사항을 저장한다", () => {
  const { save, unmount } = setup({ ...base, revision: 1 });
  unmount();
  expect(save).toHaveBeenCalledTimes(1);
});

it("저장 중에 더 입력하고 떠나도 남은 변경 사항을 저장한다", () => {
  const { save, unmount } = setup({ ...base, revision: 2, savedRevision: 0, isSaving: true });
  unmount();
  expect(save).toHaveBeenCalledTimes(1);
});
