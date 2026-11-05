import type { WorkSummary } from "@raon/contracts";
import { render, screen } from "@testing-library/react";
import { WorkCard } from "./work-card";

const work: WorkSummary = {
  id: "w1",
  title: "등대지기의 마지막 항로",
  authorName: "윤슬",
  genre: "FANTASY",
  status: "COMPLETED",
  synopsis: "소개",
  viewCount: 48210,
  episodeCount: 5,
  firstEpisodeNumber: 1,
  latestEpisodeAt: null,
};

it("제목이 작품 상세로 가는 링크의 이름이 된다", () => {
  render(<WorkCard work={work} />);
  expect(screen.getByRole("link", { name: work.title })).toHaveAttribute("href", "/works/w1");
});

it("상태를 글자로 보여 준다", () => {
  render(<WorkCard work={work} />);
  expect(screen.getByText(/판타지 · 완결/)).toBeInTheDocument();
  expect(screen.getByText(/5화 · 조회 4.8만/)).toBeInTheDocument();
});
