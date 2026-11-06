import { docFromText } from "@raon/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { downloadText } from "@/shared/lib";
import { EpisodeExport } from "./episode-export";

jest.mock("@/shared/lib", () => ({ ...jest.requireActual("@/shared/lib"), downloadText: jest.fn() }));

it("고른 형식으로 지금 내용을 내려받고 알린다", async () => {
  render(
    <EpisodeExport
      getEpisode={() => ({ number: 2, title: "소금/바다", content: docFromText("본문"), authorNote: null })}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Markdown로 내보내기" }));
  expect(downloadText).toHaveBeenCalledWith("2화 소금_바다.md", expect.stringContaining("본문"), "text/markdown");
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("2화 소금_바다.md 파일을 내보냈습니다."));
});
