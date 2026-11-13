import type { WorkSummary } from "@raon/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkBanner } from "./work-banner";

const work = (id: string, title: string): WorkSummary => ({
  id,
  title,
  format: "NOVEL",
  authorName: "작가",
  genre: "SF",
  status: "ONGOING",
  synopsis: "소개",
  viewCount: 1,
  episodeCount: 1,
  firstEpisodeNumber: 1,
  latestEpisodeAt: null,
  tags: [],
  ratingAverage: null,
  ratingCount: 0,
  coverUpdatedAt: null,
  badges: [],
});
const slides = [
  { label: "인기 1위", work: work("a", "첫 작품") },
  { label: "새 회차", work: work("b", "둘째 작품") },
];

it("한 번에 하나만 보이고 버튼으로만 넘어가며 처음으로 되돌아온다", async () => {
  render(<WorkBanner slides={slides} />);
  expect(screen.getByRole("heading", { name: "첫 작품" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "둘째 작품" })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "다음 배너" }));
  expect(screen.getByRole("heading", { name: "둘째 작품" })).toBeInTheDocument();
  expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "다음 배너" }));
  expect(screen.getByRole("heading", { name: "첫 작품" })).toBeInTheDocument();
});

it("한 장뿐이면 넘기는 버튼이 없다", () => {
  render(<WorkBanner slides={slides.slice(0, 1)} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
