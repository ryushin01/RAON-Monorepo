import { Blockquote } from "@tiptap/extension-blockquote";
import { Placeholder } from "@tiptap/extension-placeholder";
import { StarterKit } from "@tiptap/starter-kit";
import { AuthorComment, CurrentBlock, NoteLinks, SearchHighlight, SmartInput } from "./writing-extensions";

/**
 * 웹소설 본문에 쓰는 서식만 켠다. contracts의 episodeDocSchema와 맞아야 한다.
 * 붙여넣기로 들어오는 표, 이미지, 링크 같은 서식은 여기 없는 노드라 글자만 남는다.
 */
export const editorExtensions = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    heading: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
    underline: false,
  }),
  // 스키마와 맞추기 위해 인용문 안에는 문단만 허용한다.
  Blockquote.extend({ content: "paragraph+" }),
  AuthorComment,
  Placeholder.configure({ placeholder: "여기에 본문을 쓰세요." }),
  // 아래는 표시와 입력 보조만 하며 문서 구조를 바꾸지 않는다.
  SearchHighlight,
  CurrentBlock,
  SmartInput,
  NoteLinks,
];
