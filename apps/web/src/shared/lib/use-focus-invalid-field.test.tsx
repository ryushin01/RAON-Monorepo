import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useFocusInvalidField } from "./use-focus-invalid-field";

function Form({ errors, fallback }: { errors?: { title?: string; body?: string }; fallback?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  useFocusInvalidField(formRef, errors, fallback);
  return (
    <form ref={formRef}>
      <input aria-label="제목" name="title" aria-invalid={errors?.title ? true : undefined} />
      <input aria-label="본문" name="body" aria-invalid={errors?.body ? true : undefined} />
    </form>
  );
}

it("오류가 오면 첫 번째 잘못된 칸으로 초점을 옮긴다", () => {
  const { rerender } = render(<Form />);
  expect(document.body).toHaveFocus();
  rerender(<Form errors={{ body: "본문을 입력해 주세요." }} />);
  expect(screen.getByRole("textbox", { name: "본문" })).toHaveFocus();
});

it("fallback을 주면 처음 열 때 그 칸으로, 오류가 있으면 잘못된 칸으로 옮긴다", () => {
  const { rerender } = render(<Form fallback='[name="title"]' />);
  expect(screen.getByRole("textbox", { name: "제목" })).toHaveFocus();
  rerender(<Form fallback='[name="title"]' errors={{ body: "본문을 입력해 주세요." }} />);
  expect(screen.getByRole("textbox", { name: "본문" })).toHaveFocus();
});
