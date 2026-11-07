import { docFromText } from "@raon/contracts";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/core";
import { editorExtensions } from "./extensions";
import { FindReplace } from "./find-replace";
import { WritingTimer, WritingTools } from "./writing-tools";

const make = (text: string) => new Editor({ extensions: editorExtensions, content: docFromText(text) });

const open = (name: string) => {
  const summary = screen.getByText(name);
  const details = summary.closest("details") as HTMLDetailsElement;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  return details;
};

beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe("WritingTools", () => {
  it("단락 종류별 분량을 표로 보여 준다", () => {
    render(<WritingTools editor={make("“가자.”\n\n그는 걸었다.")} chars={10} onFind={() => {}} />);
    const row = within(open("단락 분석")).getByRole("row", { name: /대사/ });
    expect(row).toHaveTextContent("대사15");
  });

  it("반복 표현을 누르면 그 글자를 찾는다", async () => {
    const onFind = jest.fn();
    render(<WritingTools editor={make("등대를 등대를 등대를")} chars={10} onFind={onFind} />);
    open("반복 표현");
    await userEvent.click(screen.getByRole("button", { name: "등대를 3회" }));
    expect(onFind).toHaveBeenCalledWith("등대를");
  });

  it("상용구를 등록해 글자 그대로 넣고, 지우며, 중복은 알린다", async () => {
    const editor = make("앞");
    render(<WritingTools editor={editor} chars={1} onFind={() => {}} />);
    open("상용구와 특수문자");
    const input = screen.getByRole("textbox", { name: "새 상용구" });
    await userEvent.type(input, "<b>굵게</b>");
    await userEvent.click(screen.getByRole("button", { name: "상용구 등록" }));
    await userEvent.click(screen.getByRole("button", { name: "넣기: <b>굵게</b>" }));
    expect(editor.getText()).toContain("<b>굵게</b>");

    await userEvent.type(input, "<b>굵게</b>");
    await userEvent.click(screen.getByRole("button", { name: "상용구 등록" }));
    expect(input).toHaveAccessibleDescription(/이미 등록한 상용구입니다/);

    await userEvent.click(screen.getByRole("button", { name: "삭제: <b>굵게</b>" }));
    expect(screen.queryByRole("button", { name: "넣기: <b>굵게</b>" })).not.toBeInTheDocument();
  });

  it("저장하지 못하면 입력을 남기고 알리며, 삭제 실패도 알린다", async () => {
    render(<WritingTools editor={make("앞")} chars={1} onFind={() => {}} />);
    open("상용구와 특수문자");
    const input = screen.getByRole("textbox", { name: "새 상용구" });
    await userEvent.type(input, "첫째");
    await userEvent.click(screen.getByRole("button", { name: "상용구 등록" }));

    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("가득 참");
    });
    await userEvent.type(input, "둘째");
    await userEvent.click(screen.getByRole("button", { name: "상용구 등록" }));
    expect(input).toHaveValue("둘째");
    expect(input).toHaveAccessibleDescription(/저장하지 못했습니다/);
    expect(screen.queryByRole("button", { name: "넣기: 둘째" })).not.toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.click(screen.getByRole("button", { name: "삭제: 첫째" }));
    expect(input).toHaveAccessibleDescription(/저장하지 못했습니다/);
    expect(screen.getByRole("button", { name: "넣기: 첫째" })).toBeInTheDocument();
  });

  it("특수문자를 커서에 넣는다", async () => {
    const editor = make("앞");
    render(<WritingTools editor={editor} chars={1} onFind={() => {}} />);
    open("상용구와 특수문자");
    await userEvent.click(screen.getByRole("button", { name: "… 넣기" }));
    expect(editor.getText()).toContain("…");
  });
});

describe("WritingTimer", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("시작해야 움직이고, 1분이 지나면 분당 글자 수를 보여 주며, 초기화한다", () => {
    const { rerender } = render(<WritingTimer chars={100} />);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByText("00:00:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "타이머 시작" }));
    act(() => jest.advanceTimersByTime(60_000));
    rerender(<WritingTimer chars={160} />);
    expect(screen.getByText("00:01:00")).toBeInTheDocument();
    expect(screen.getByText(/늘어난 글자 60자 · 분당 60자/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "타이머 초기화" }));
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(screen.getByText(/늘어난 글자 0자/)).toBeInTheDocument();
  });
});

describe("FindReplace", () => {
  const setup = (text: string, query = "") => {
    const editor = make(text);
    render(<FindReplace editor={editor} initialQuery={query} onClose={() => {}} />);
    return editor;
  };

  it("찾은 수와 위치를 알리고 다음으로 옮겨 다닌다", async () => {
    setup("등대 바다 등대", "등대");
    expect(screen.getByRole("status")).toHaveTextContent("1 / 2건");
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 / 2건");
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 / 2건");
  });

  it("없으면 알리고 바꾸기 버튼을 막는다", () => {
    setup("바다", "등대");
    expect(screen.getByRole("status")).toHaveTextContent("찾은 글자가 없습니다.");
    expect(screen.getByRole("button", { name: "모두 바꾸기" })).toBeDisabled();
  });

  it("하나만, 또는 모두 바꾸고 실행 취소로 되돌린다", async () => {
    const editor = setup("등대 등대 등대", "등대");
    await userEvent.type(screen.getByRole("textbox", { name: "바꿀 글자" }), "횃불");
    await userEvent.click(screen.getByRole("button", { name: "바꾸기" }));
    expect(editor.getText()).toBe("횃불 등대 등대");
    await userEvent.click(screen.getByRole("button", { name: "모두 바꾸기" }));
    expect(editor.getText()).toBe("횃불 횃불 횃불");
    expect(screen.getByRole("status")).toHaveTextContent("2건 바꿨습니다.");
    act(() => {
      editor.commands.undo();
    });
    expect(editor.getText()).toContain("등대");
  });

  it("작업 결과는 이동하거나 본문을 고치면 위치와 개수로 돌아간다", async () => {
    const editor = setup("등대 등대 등대", "등대");
    await userEvent.type(screen.getByRole("textbox", { name: "바꿀 글자" }), "횃불");
    await userEvent.click(screen.getByRole("button", { name: "바꾸기" }));
    expect(screen.getByRole("status")).toHaveTextContent("1건 바꿨습니다.");
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 / 2건");

    await userEvent.click(screen.getByRole("button", { name: "기호 정리" }));
    expect(screen.getByRole("status")).toHaveTextContent("바꿀 기호가 없습니다.");
    act(() => {
      editor.commands.insertContentAt(1, "등대 ");
    });
    expect(screen.getByRole("status")).toHaveTextContent(/ \/ 3건/);
  });

  it("바꿀 글자를 비우면 찾은 글자를 지운다", async () => {
    const editor = setup("가 등대 나", "등대 ");
    await userEvent.click(screen.getByRole("button", { name: "모두 바꾸기" }));
    expect(editor.getText()).toBe("가 나");
  });

  it("기호 정리는 바꾼 수를 알린다", async () => {
    const editor = setup('"가자..."');
    await userEvent.click(screen.getByRole("button", { name: "기호 정리" }));
    expect(editor.getText()).toBe("“가자…”");
    expect(screen.getByRole("status")).toHaveTextContent("기호 3곳을 바꿨습니다.");
  });
});

describe("자동 대치", () => {
  it("규칙을 등록하고 지우며, 빈 값과 중복은 알린다", async () => {
    render(<WritingTools editor={make("본문")} chars={0} onFind={() => {}} />);
    const tool = within(open("자동 대치"));
    await userEvent.click(tool.getByRole("button", { name: "규칙 등록" }));
    expect(await tool.findByText("바꿀 글자를 입력해 주세요.")).toBeInTheDocument();
    expect(tool.getByRole("textbox", { name: "입력하는 글자" })).toHaveFocus();

    await userEvent.type(tool.getByRole("textbox", { name: "입력하는 글자" }), "->");
    await userEvent.type(tool.getByRole("textbox", { name: "바뀌는 글자" }), "→");
    await userEvent.click(tool.getByRole("button", { name: "규칙 등록" }));
    expect(await tool.findByText("-> → →")).toBeInTheDocument();

    await userEvent.type(tool.getByRole("textbox", { name: "입력하는 글자" }), "->");
    await userEvent.click(tool.getByRole("button", { name: "규칙 등록" }));
    expect(await tool.findByText("이미 등록한 규칙입니다.")).toBeInTheDocument();

    await userEvent.click(tool.getByRole("button", { name: "규칙 삭제: ->" }));
    expect(tool.queryByText("-> → →")).not.toBeInTheDocument();
  });
});
