import type { ComicImage, StudioEpisode } from "@raon/contracts";
import { docFromText } from "@raon/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  deleteImage,
  listImages,
  moveImage,
  saveComicEpisode,
  setComicPublished,
  updateImageAlt,
  uploadImage,
} from "../api/actions";
import { ComicEpisodeEditor, validateImageFile } from "./comic-episode-editor";

jest.mock("../api/actions", () => ({
  deleteImage: jest.fn(),
  listImages: jest.fn(),
  moveImage: jest.fn(),
  reorderImages: jest.fn(),
  saveComicEpisode: jest.fn(),
  setComicPublished: jest.fn(),
  updateImageAlt: jest.fn(),
  uploadImage: jest.fn(),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const episode: StudioEpisode = {
  id: "e1",
  workId: "w1",
  number: 1,
  title: "첫 장면",
  status: "DRAFT",
  writingStage: "DRAFTING",
  episodeType: "REGULAR",
  pointOfView: "",
  isFree: true,
  charCount: 0,
  content: docFromText(""),
  authorNote: null,
  updatedAt: "2026-11-07T00:00:00.000Z",
  publishedAt: null,
};
const image = (id: string, alt: string): ComicImage => ({ id, position: 1, alt, width: 800, height: 1200 });

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ComicEpisodeEditor episode={episode} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.resetAllMocks();
  (listImages as jest.Mock).mockResolvedValue(ok([image("i1", "첫 장면 설명"), image("i2", "")]));
  (updateImageAlt as jest.Mock).mockResolvedValue(ok(image("i1", "")));
  (moveImage as jest.Mock).mockResolvedValue(ok(null));
  (deleteImage as jest.Mock).mockResolvedValue(ok(null));
  (uploadImage as jest.Mock).mockResolvedValue(ok(image("i3", "")));
});

const file = (name: string, type = "image/png", size = 10) => new File([new Uint8Array(size)], name, { type });

it("이미지마다 설명 칸을 두고, 설명을 저장하면 알린다", async () => {
  wrap();
  const field = await screen.findByRole("textbox", { name: "2번째 이미지 설명" });
  await userEvent.type(field, "등대");
  await userEvent.click(screen.getByRole("button", { name: "설명 저장: 2번째 이미지" }));
  await waitFor(() => expect(updateImageAlt).toHaveBeenCalledWith("e1", "i2", "등대"));
  expect(await screen.findByText("2번째 이미지의 설명을 저장했습니다.")).toBeInTheDocument();
});

it("끝에 있는 이미지는 그쪽으로 옮기지 않는다", async () => {
  wrap();
  const up = await screen.findByRole("button", { name: "위로: 1번째 이미지" });
  expect(up).toHaveAttribute("aria-disabled", "true");
  await userEvent.click(up);
  expect(moveImage).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "아래로: 1번째 이미지" }));
  await waitFor(() => expect(moveImage).toHaveBeenCalledWith("e1", "i1", "down"));
});

it("지우기는 확인을 받고, 지운 뒤 초점을 제목으로 옮긴다", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  wrap();
  const button = await screen.findByRole("button", { name: "삭제: 1번째 이미지" });
  await userEvent.click(button);
  expect(deleteImage).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await userEvent.click(button);
  await waitFor(() => expect(deleteImage).toHaveBeenCalledWith("e1", "i1"));
  await waitFor(() => expect(screen.getByRole("heading", { name: "회차 이미지" })).toHaveFocus());
});

it("파일을 고르기만 해서는 올리지 않고, 파일 이름 순서대로 한 장씩 올린다", async () => {
  wrap();
  const input = screen.getByLabelText("이미지 파일");
  await userEvent.upload(input, [file("10.png"), file("2.png")]);
  expect(uploadImage).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "이미지 올리기" }));
  await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(2));
  const names = (uploadImage as jest.Mock).mock.calls.map(([, data]) => (data.get("file") as File).name);
  expect(names).toEqual(["2.png", "10.png"]);
  expect(await screen.findByText("이미지 2장을 올렸습니다. 설명을 입력해 주세요.")).toBeInTheDocument();
});

it("파일을 고르지 않으면 안내하고, 올리다 실패하면 어느 파일인지 알린다", async () => {
  wrap();
  await userEvent.click(screen.getByRole("button", { name: "이미지 올리기" }));
  expect(await screen.findByText("이미지 파일을 골라 주세요.")).toBeInTheDocument();
  expect(uploadImage).not.toHaveBeenCalled();

  (uploadImage as jest.Mock).mockResolvedValue({ ok: false, message: "개수 초과" });
  await userEvent.upload(screen.getByLabelText("이미지 파일"), file("1.png"));
  await userEvent.click(screen.getByRole("button", { name: "이미지 올리기" }));
  expect(await screen.findByText("1.png: 개수 초과")).toBeInTheDocument();
});

it("공개 중인 회차는 한 장씩 설명과 함께 올리고, 설명이 없으면 보내지 않는다", async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ComicEpisodeEditor episode={{ ...episode, status: "PUBLISHED" }} />
    </QueryClientProvider>,
  );
  const input = screen.getByLabelText("이미지 파일");
  expect(input).not.toHaveAttribute("multiple");
  await userEvent.upload(input, file("1.png"));
  await userEvent.click(screen.getByRole("button", { name: "이미지 올리기" }));
  const alt = screen.getByRole("textbox", { name: /올릴 이미지 설명/ });
  expect(uploadImage).not.toHaveBeenCalled();
  expect(alt).toHaveFocus();
  expect(alt).toHaveAttribute("aria-invalid", "true");

  await userEvent.type(alt, "새 장면");
  await userEvent.click(screen.getByRole("button", { name: "이미지 올리기" }));
  await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
  expect((uploadImage as jest.Mock).mock.calls[0]?.[1].get("alt")).toBe("새 장면");
  expect(await screen.findByText("이미지를 올렸습니다.")).toBeInTheDocument();
});

it("파일 형식과 크기를 먼저 확인한다", () => {
  expect(validateImageFile(file("a.gif", "image/gif"))).toContain("JPG, PNG, WebP");
  expect(validateImageFile(file("a.png", "image/png", 3 * 1024 * 1024))).toContain("2.5MB");
  expect(validateImageFile(file("a.png"))).toBeNull();
  expect(validateImageFile(file("a.unknown", ""))).toBeNull();
});

it("저장과 공개의 결과와 이유를 알린다", async () => {
  (saveComicEpisode as jest.Mock).mockResolvedValue(ok({ ...episode, title: "새 제목" }));
  (setComicPublished as jest.Mock).mockResolvedValue({ ok: false, message: "1번째 이미지의 설명을 입력해 주세요." });
  wrap();
  await userEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(saveComicEpisode).toHaveBeenCalledWith(
      episode,
      expect.objectContaining({ title: "첫 장면", authorNote: null, isFree: true }),
    ),
  );
  await userEvent.click(screen.getByRole("button", { name: "공개하기" }));
  expect(await screen.findByText("1번째 이미지의 설명을 입력해 주세요.")).toBeInTheDocument();
});
