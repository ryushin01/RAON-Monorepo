import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { saveWork } from "../api/actions";
import { WorkForm } from "./work-form";

const push = jest.fn();
jest.mock("../api/actions", () => ({ saveWork: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: jest.fn() }) }));

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkForm />
    </QueryClientProvider>,
  );

it("입력한 값을 저장하고 작품 관리로 이동한다", async () => {
  (saveWork as jest.Mock).mockResolvedValue({ ok: true, data: { id: "w9" } });
  setup();
  await userEvent.type(screen.getByLabelText(/작품명/), "새 작품");
  await userEvent.type(screen.getByLabelText(/작품 소개/), "열 글자가 넘는 소개입니다.");
  await userEvent.click(screen.getByRole("button", { name: "작품 만들기" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/studio/works/w9"));
  expect(saveWork).toHaveBeenCalledWith(
    null,
    expect.objectContaining({ title: "새 작품", genre: "FANTASY", episodePrice: "100", wholePrice: "" }),
  );
});

it("서버의 필드 오류를 입력 칸에 연결한다", async () => {
  (saveWork as jest.Mock).mockResolvedValue({
    ok: false,
    message: "작품명을 입력해 주세요.",
    fieldErrors: { title: "작품명을 입력해 주세요." },
  });
  setup();
  await userEvent.click(screen.getByRole("button", { name: "작품 만들기" }));
  expect(await screen.findByText("작품명을 입력해 주세요.")).toBeInTheDocument();
  expect(screen.getByLabelText(/작품명/)).toBeInvalid();
});
