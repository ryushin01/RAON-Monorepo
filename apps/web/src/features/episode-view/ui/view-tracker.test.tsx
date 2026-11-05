import { render } from "@testing-library/react";
import { recordView } from "../api/actions";
import { ViewTracker } from "./view-tracker";

jest.mock("../api/actions", () => ({ recordView: jest.fn() }));

beforeEach(() => {
  sessionStorage.clear();
  (recordView as jest.Mock).mockReset();
});

it("같은 회차를 다시 열거나 새로 그려도 한 번만 센다", () => {
  const first = render(<ViewTracker workId="w" episodeId="e1" number={1} />);
  first.unmount();
  render(<ViewTracker workId="w" episodeId="e1" number={1} />);
  expect(recordView).toHaveBeenCalledTimes(1);
});

it("다른 회차는 따로 센다", () => {
  render(<ViewTracker workId="w" episodeId="e1" number={1} />);
  render(<ViewTracker workId="w" episodeId="e2" number={2} />);
  expect(recordView).toHaveBeenCalledWith("w", 2);
  expect(recordView).toHaveBeenCalledTimes(2);
});
