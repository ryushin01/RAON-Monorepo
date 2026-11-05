import { readPreference, writePreference } from "./preferences";

it("저장한 값을 다시 읽는다. JSON과 한글도 그대로다", () => {
  const value = JSON.stringify({ theme: "black", font: "명조", size: 19 });
  writePreference("raon_test", value);
  expect(readPreference("raon_test")).toBe(value);
});

it("없는 값은 undefined다", () => {
  expect(readPreference("raon_none")).toBeUndefined();
});
