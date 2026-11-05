import type { EpisodeDoc } from "@raon/contracts";
import { render, screen } from "@testing-library/react";
import { EpisodeContent } from "./episode-content";

const doc: EpisodeDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "굵은 글", marks: [{ type: "bold" }] },
        { type: "hardBreak" },
        { type: "text", text: "기운 글", marks: [{ type: "italic" }] },
      ],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "인용" }] }] },
    { type: "horizontalRule" },
    { type: "paragraph" },
  ],
};

it("문서 구조를 의미에 맞는 요소로 그린다", () => {
  const { container } = render(<EpisodeContent doc={doc} />);
  expect(screen.getByText("굵은 글").tagName).toBe("STRONG");
  expect(screen.getByText("기운 글").tagName).toBe("EM");
  expect(screen.getByText("인용").closest("blockquote")).not.toBeNull();
  expect(screen.getByRole("separator")).toBeInTheDocument();
  expect(container.querySelectorAll("p")).toHaveLength(3);
});

it("본문의 HTML을 실행하지 않고 글자로 보여 준다", () => {
  const { container } = render(
    <EpisodeContent
      doc={{
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] }],
      }}
    />,
  );
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
});
