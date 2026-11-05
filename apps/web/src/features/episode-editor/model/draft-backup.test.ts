import { docFromText, EMPTY_DOC, type EpisodeInput } from "@raon/contracts";
import { clearBackup, readBackup, writeBackup } from "./draft-backup";

const server: EpisodeInput = { title: "제목", content: EMPTY_DOC, authorNote: null, isFree: false };
const edited: EpisodeInput = { ...server, content: docFromText("고치던 내용") };

beforeEach(() => localStorage.clear());

it("서버 내용과 다르면 돌려준다", () => {
  writeBackup("e1", edited);
  expect(readBackup("e1", server)?.input).toEqual(edited);
});

it("브라우저 시계가 서버보다 늦어도 원고를 버리지 않는다", () => {
  writeBackup("e1", edited, Date.parse("2000-01-01T00:00:00Z"));
  expect(readBackup("e1", server)).not.toBeNull();
});

it("이미 저장된 내용과 같으면 묻지 않고 지운다. jsonb가 키 순서를 바꿔도 같다", () => {
  writeBackup("e1", server);
  const reordered = { isFree: false, authorNote: null, content: EMPTY_DOC, title: "제목" };
  expect(readBackup("e1", reordered)).toBeNull();
  expect(localStorage.length).toBe(0);
});

it("회차마다 따로 보관하고 지울 수 있다", () => {
  writeBackup("e1", edited);
  expect(readBackup("e2", server)).toBeNull();
  clearBackup("e1");
  expect(readBackup("e1", server)).toBeNull();
});

it("깨진 값은 없는 것으로 다룬다", () => {
  localStorage.setItem("raon:episode-backup:e1", "{");
  expect(readBackup("e1", server)).toBeNull();
});
