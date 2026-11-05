import { render, waitFor } from "@testing-library/react";
import { recordView } from "../api/actions";
import { ViewTracker } from "./view-tracker";

jest.mock("../api/actions", () => ({ recordView: jest.fn() }));

const flush = () => waitFor(() => expect(recordView).toHaveBeenCalled());
const settle = () => new Promise((resolve) => setTimeout(resolve));

beforeEach(() => {
  sessionStorage.clear();
  (recordView as jest.Mock).mockReset().mockResolvedValue(true);
});

it("같은 회차를 다시 열어도 한 번만 센다", async () => {
  const first = render(<ViewTracker workId="w" episodeId="e1" number={1} />);
  await flush();
  await settle();
  first.unmount();
  render(<ViewTracker workId="w" episodeId="e1" number={1} />);
  await settle();
  expect(recordView).toHaveBeenCalledTimes(1);
});

it("기록 중에 다시 그려져도 두 번 보내지 않는다", async () => {
  render(<ViewTracker workId="w" episodeId="e3" number={3} />);
  render(<ViewTracker workId="w" episodeId="e3" number={3} />);
  await settle();
  expect(recordView).toHaveBeenCalledTimes(1);
});

it("다른 회차는 따로 센다", async () => {
  render(<ViewTracker workId="w" episodeId="e1" number={1} />);
  render(<ViewTracker workId="w" episodeId="e2" number={2} />);
  await settle();
  expect(recordView).toHaveBeenCalledWith("w", 2);
  expect(recordView).toHaveBeenCalledTimes(2);
});

it("기록에 실패하면 다음 방문 때 다시 보낸다", async () => {
  (recordView as jest.Mock).mockResolvedValueOnce(false);
  const first = render(<ViewTracker workId="w" episodeId="e4" number={4} />);
  await settle();
  first.unmount();
  render(<ViewTracker workId="w" episodeId="e4" number={4} />);
  await settle();
  expect(recordView).toHaveBeenCalledTimes(2);
});
