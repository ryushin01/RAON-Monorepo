import type { Foreshadow } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { deleteForeshadow, listForeshadows, saveForeshadow } from "../api/actions";
import { ForeshadowManager } from "./foreshadow-manager";
import { ForeshadowReference } from "./foreshadow-reference";

jest.mock("../api/actions", () => ({
  listForeshadows: jest.fn(),
  saveForeshadow: jest.fn(),
  deleteForeshadow: jest.fn(),
}));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const open: Foreshadow = {
  id: "f1",
  workId: "w1",
  title: "깨진 나침반",
  body: "북쪽을 가리키지 않는다",
  plantedEpisodeId: "e1",
  resolvedEpisodeId: null,
  updatedAt: "2026-11-07T00:00:00.000Z",
};
const done: Foreshadow = { ...open, id: "f2", title: "등대의 불빛", body: "", resolvedEpisodeId: "e2" };
const episodes = [
  { id: "e1", number: 1, title: "첫 회차" },
  { id: "e2", number: 2, title: "둘째 회차" },
  { id: "e3", number: 3, title: "휴지통 회차", trashed: true },
];

const wrap = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {node}
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.resetAllMocks();
  (listForeshadows as jest.Mock).mockResolvedValue(ok([open, done]));
  (saveForeshadow as jest.Mock).mockResolvedValue(ok(open));
  (deleteForeshadow as jest.Mock).mockResolvedValue(ok(null));
});

describe("ForeshadowManager", () => {
  it("회수 여부로 나누어 진행을 보여 준다", async () => {
    wrap(<ForeshadowManager workId="w1" episodes={episodes} />);
    expect(await screen.findByRole("heading", { name: "회수하지 않은 복선 1개" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "회수한 복선 1개" })).toBeInTheDocument();
    expect(screen.getByText("1화에 심었습니다. 1개 회차가 지나도록 회수하지 않았습니다.")).toBeInTheDocument();
    expect(screen.getByText("1화에 심고 2화에서 회수했습니다.")).toBeInTheDocument();
  });

  it("새 복선을 고른 회차와 함께 저장하고, 제목으로 초점을 옮긴다", async () => {
    wrap(<ForeshadowManager workId="w1" episodes={episodes} />);
    await userEvent.click(await screen.findByRole("button", { name: "새 복선" }));
    expect(screen.getByRole("textbox", { name: /복선 이름/ })).toHaveFocus();
    expect(within(screen.getByLabelText("심은 회차")).getByRole("option", { name: /휴지통/ })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: /복선 이름/ }), "새 복선");
    await userEvent.selectOptions(screen.getByLabelText("심은 회차"), "e2");
    await userEvent.click(screen.getByRole("button", { name: "복선 저장" }));

    await waitFor(() =>
      expect(saveForeshadow).toHaveBeenCalledWith("w1", null, {
        title: "새 복선",
        body: "",
        plantedEpisodeId: "e2",
        resolvedEpisodeId: null,
      }),
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "복선" })).toHaveFocus());
  });

  it("칸 오류를 그 칸에 보여 주고 초점을 옮긴다", async () => {
    (saveForeshadow as jest.Mock).mockResolvedValue({
      ok: false,
      message: "입력을 확인해 주세요.",
      fieldErrors: { title: "복선 이름을 입력해 주세요." },
    });
    wrap(<ForeshadowManager workId="w1" episodes={episodes} />);
    await userEvent.click(await screen.findByRole("button", { name: "새 복선" }));
    await userEvent.click(screen.getByRole("button", { name: "복선 저장" }));
    expect(await screen.findByText("복선 이름을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /복선 이름/ })).toHaveFocus();
  });

  it("지우기는 확인을 받은 뒤에만 한다", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    wrap(<ForeshadowManager workId="w1" episodes={episodes} />);
    const button = await screen.findByRole("button", { name: "삭제: 깨진 나침반" });
    await userEvent.click(button);
    expect(deleteForeshadow).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await userEvent.click(button);
    await waitFor(() => expect(deleteForeshadow).toHaveBeenCalledWith("f1"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "복선" })).toHaveFocus());
  });

  it("고치던 복선을 지우면 양식을 닫고, 다른 복선을 지우면 그대로 둔다", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    wrap(<ForeshadowManager workId="w1" episodes={episodes} />);
    await userEvent.click(await screen.findByRole("button", { name: "고치기: 깨진 나침반" }));
    await userEvent.click(screen.getByRole("button", { name: "삭제: 등대의 불빛" }));
    await waitFor(() => expect(deleteForeshadow).toHaveBeenCalledWith("f2"));
    await screen.findByText("‘등대의 불빛’ 복선을 지웠습니다.");
    expect(screen.getByRole("button", { name: "복선 저장" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "삭제: 깨진 나침반" }));
    await screen.findByText("‘깨진 나침반’ 복선을 지웠습니다.");
    expect(screen.queryByRole("button", { name: "복선 저장" })).not.toBeInTheDocument();
  });

  it("목록을 읽지 못하면 알린다", async () => {
    (listForeshadows as jest.Mock).mockResolvedValue({ ok: false, message: "읽지 못했습니다." });
    wrap(<ForeshadowManager workId="w1" episodes={episodes} />);
    expect(await screen.findByText("읽지 못했습니다.")).toBeInTheDocument();
  });
});

describe("ForeshadowReference", () => {
  it("이 회차에 새 복선을 심는다", async () => {
    (listForeshadows as jest.Mock).mockResolvedValue(ok([]));
    wrap(<ForeshadowReference workId="w1" episodeId="e2" episodes={episodes} />);
    await userEvent.type(screen.getByRole("textbox", { name: "새 복선 이름" }), "낡은 지도");
    await userEvent.click(screen.getByRole("button", { name: "이 회차에 심기" }));
    await waitFor(() =>
      expect(saveForeshadow).toHaveBeenCalledWith("w1", null, {
        title: "낡은 지도",
        body: "",
        plantedEpisodeId: "e2",
        resolvedEpisodeId: null,
      }),
    );
    expect(await screen.findByText("‘낡은 지도’ 복선을 이 회차에 심었습니다.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "새 복선 이름" })).toHaveValue("");
  });

  it("이름이 없으면 보내지 않고 칸으로 초점을 옮긴다", async () => {
    wrap(<ForeshadowReference workId="w1" episodeId="e2" episodes={episodes} />);
    await userEvent.click(screen.getByRole("button", { name: "이 회차에 심기" }));
    expect(saveForeshadow).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "새 복선 이름" })).toHaveFocus();
    const input = screen.getByRole("textbox", { name: "새 복선 이름" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("복선 이름을 입력해 주세요.");

    await userEvent.type(input, "낡");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("복선 이름을 입력해 주세요.")).not.toBeInTheDocument();
  });

  it("회수하지 않은 복선을 이 회차에서 회수하고, 이 회차의 회수는 취소한다", async () => {
    wrap(<ForeshadowReference workId="w1" episodeId="e2" episodes={episodes} />);
    await userEvent.click(await screen.findByRole("button", { name: "이 회차에서 회수: 깨진 나침반" }));
    await waitFor(() =>
      expect(saveForeshadow).toHaveBeenCalledWith("w1", "f1", {
        title: "깨진 나침반",
        body: "북쪽을 가리키지 않는다",
        plantedEpisodeId: "e1",
        resolvedEpisodeId: "e2",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "회수 취소: 등대의 불빛" }));
    await waitFor(() =>
      expect(saveForeshadow).toHaveBeenCalledWith("w1", "f2", expect.objectContaining({ resolvedEpisodeId: null })),
    );
  });

  it("다른 회차에서 회수한 복선은 보이지 않는다", async () => {
    wrap(<ForeshadowReference workId="w1" episodeId="e1" episodes={episodes} />);
    await screen.findByText("깨진 나침반");
    expect(screen.queryByText("등대의 불빛")).not.toBeInTheDocument();
  });
});
