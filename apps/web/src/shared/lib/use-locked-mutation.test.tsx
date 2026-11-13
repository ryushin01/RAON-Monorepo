import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useLockedMutation } from "./use-locked-mutation";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

/** 끝낼 때를 테스트가 정하는 요청 */
function deferredRequest() {
  const finishes: ((ok: boolean) => void)[] = [];
  const request = jest.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        finishes.push((ok) => (ok ? resolve("완료") : reject(new Error("실패"))));
      }),
  );
  return { request, finish: (ok: boolean) => finishes.shift()?.(ok) };
}

it("같은 렌더 안에서 두 번 불러도 한 번만 보낸다(isPending이 바뀌기 전)", async () => {
  const { request, finish } = deferredRequest();
  const { result } = renderHook(() => useLockedMutation({ mutationFn: request }), { wrapper });

  let second = true;
  act(() => {
    result.current.run();
    second = result.current.run();
  });
  expect(second).toBe(false);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

  await act(async () => finish(true));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  // 성공하면 다시 보낼 수 있다.
  act(() => {
    result.current.run();
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
});

it("실패하면 잠금을 풀어 다시 보낼 수 있다", async () => {
  const { request, finish } = deferredRequest();
  const { result } = renderHook(() => useLockedMutation({ mutationFn: request }, { keepLockedOnSuccess: true }), {
    wrapper,
  });

  act(() => {
    result.current.run();
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  await act(async () => finish(false));
  await waitFor(() => expect(result.current.isError).toBe(true));
  act(() => {
    result.current.run();
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
});

it("성공 뒤 화면을 떠나는 동작은 성공해도 잠금을 유지하고, reset하면 푼다", async () => {
  const { request, finish } = deferredRequest();
  const { result } = renderHook(() => useLockedMutation({ mutationFn: request }, { keepLockedOnSuccess: true }), {
    wrapper,
  });

  act(() => {
    result.current.run();
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  await act(async () => finish(true));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  act(() => {
    expect(result.current.run()).toBe(false);
  });

  act(() => result.current.reset());
  act(() => {
    expect(result.current.run()).toBe(true);
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
});
