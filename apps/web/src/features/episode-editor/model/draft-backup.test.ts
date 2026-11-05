import { EMPTY_DOC, type EpisodeInput } from "@raon/contracts";
import { clearBackup, readBackup, writeBackup } from "./draft-backup";

const input: EpisodeInput = { title: "제목", content: EMPTY_DOC, authorNote: null, isFree: false };
const at = (iso: string) => Date.parse(iso);

beforeEach(() => localStorage.clear());

it("서버보다 새로운 백업을 돌려준다", () => {
  writeBackup("e1", input, at("2026-11-05T01:00:00Z"));
  expect(readBackup("e1", "2026-11-05T00:00:00Z")?.input.title).toBe("제목");
});

it("서버보다 오래된 백업은 버린다", () => {
  writeBackup("e1", input, at("2026-11-05T00:00:00Z"));
  expect(readBackup("e1", "2026-11-05T01:00:00Z")).toBeNull();
  expect(localStorage.length).toBe(0);
});

it("회차마다 따로 보관하고 지울 수 있다", () => {
  writeBackup("e1", input, at("2026-11-05T01:00:00Z"));
  expect(readBackup("e2", "2026-11-05T00:00:00Z")).toBeNull();
  clearBackup("e1");
  expect(readBackup("e1", "2026-11-05T00:00:00Z")).toBeNull();
});

it("깨진 값은 없는 것으로 다룬다", () => {
  localStorage.setItem("raon:episode-backup:e1", "{");
  expect(readBackup("e1", "2026-11-05T00:00:00Z")).toBeNull();
});
