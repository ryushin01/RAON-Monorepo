import { render, screen } from "@testing-library/react";
import { ComicContent } from "./comic-content";

const images = [
  { id: "i1", position: 1, alt: "첫 장면", width: 480, height: 640 },
  { id: "i2", position: 2, alt: "둘째 장면", width: null, height: null },
];

it("순서대로 대체 텍스트와 함께 그리고, 권한을 확인하는 주소로 받는다", () => {
  render(<ComicContent episodeId="e1" images={images} />);
  const shown = screen.getAllByRole("img");
  expect(shown.map((image) => image.getAttribute("alt"))).toEqual(["첫 장면", "둘째 장면"]);
  expect(shown[0]).toHaveAttribute("src", "/api/episodes/e1/images/i1");
});

it("크기를 알면 자리를 잡고, 첫 이미지만 바로 받는다", () => {
  render(<ComicContent episodeId="e1" images={images} />);
  const [first, second] = screen.getAllByRole("img");
  expect(first).toHaveAttribute("width", "480");
  expect(first).toHaveAttribute("loading", "eager");
  expect(second).not.toHaveAttribute("width");
  expect(second).toHaveAttribute("loading", "lazy");
});
