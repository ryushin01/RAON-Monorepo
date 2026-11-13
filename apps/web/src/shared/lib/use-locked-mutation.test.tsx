import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { Activity, type ReactNode } from "react";
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

const leaveRequest = jest.fn();

/** 성공하면 화면을 떠나는 버튼(성공해도 잠가 둔다) */
function Leave() {
  const mutation = useLockedMutation({ mutationFn: () => leaveRequest() }, { keepLockedOnSuccess: true });
  return (
    <button type="button" onClick={() => mutation.run()}>
      휴지통으로 옮기기
    </button>
  );
}

it("성공 뒤 잠가 둔 버튼도 화면이 숨겨졌다가 다시 보이면 다시 누를 수 있다", async () => {
  leaveRequest.mockResolvedValue("완료");
  const client = new QueryClient();
  const view = (mode: "visible" | "hidden") => (
    <QueryClientProvider client={client}>
      <Activity mode={mode}>
        <Leave />
      </Activity>
    </QueryClientProvider>
  );
  const { rerender } = render(view("visible"));
  const button = screen.getByRole("button", { name: "휴지통으로 옮기기" });

  act(() => button.click());
  await waitFor(() => expect(leaveRequest).toHaveBeenCalledTimes(1));
  act(() => button.click());
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(leaveRequest).toHaveBeenCalledTimes(1);

  // 다른 화면에 다녀오면(숨겼다가 다시 보이면) 잠금이 풀린다.
  rerender(view("hidden"));
  rerender(view("visible"));
  act(() => screen.getByRole("button", { name: "휴지통으로 옮기기", hidden: true }).click());
  await waitFor(() => expect(leaveRequest).toHaveBeenCalledTimes(2));
});
