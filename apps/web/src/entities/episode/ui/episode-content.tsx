import type { EpisodeBlock, EpisodeDoc, EpisodeInline } from "@raon/contracts";
import type { ReactNode } from "react";
import styles from "./episode-content.module.scss";

function renderInline(node: EpisodeInline, key: number): ReactNode {
  if (node.type === "hardBreak") return <br key={key} />;
  let element: ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    element = mark.type === "bold" ? <strong>{element}</strong> : <em>{element}</em>;
  }
  return <span key={key}>{element}</span>;
}

function renderBlock(block: EpisodeBlock, key: number): ReactNode {
  switch (block.type) {
    case "authorComment":
      // API가 독자 응답에서 빼지만, 혹시 남아 있어도 그리지 않는다.
      return null;
    case "horizontalRule":
      return <hr key={key} />;
    case "blockquote":
      return <blockquote key={key}>{block.content.map(renderBlock)}</blockquote>;
    case "paragraph":
      return <p key={key}>{block.content?.map(renderInline) ?? <br />}</p>;
  }
}

/**
 * 회차 본문을 그린다. 문서 구조를 React 요소로 바꾸므로 HTML을 그대로 넣지 않는다(XSS 방지).
 * 글꼴과 크기는 부모(뷰어)가 정한다.
 */
export function EpisodeContent({ doc }: { doc: EpisodeDoc }) {
  return <div className={styles.content}>{doc.content.map(renderBlock)}</div>;
}
