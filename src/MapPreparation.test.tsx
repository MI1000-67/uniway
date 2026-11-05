// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MapPreparation from "./MapPreparation";
import { newMap } from "./preparedMap";
import { analyzeUploadedMap } from "./engine";
vi.mock("./engine", () => ({ analyzeUploadedMap: vi.fn() }));
const image = {
  id: "test",
  url: "blob:test",
  name: "campus.png",
  width: 1000,
  height: 700,
};
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("passes the selected printed language to local analysis and opens the result", async () => {
  const map = newMap(image);
  vi.mocked(analyzeUploadedMap).mockResolvedValue(
    map as Awaited<ReturnType<typeof analyzeUploadedMap>>,
  );
  const onAnalyzed = vi.fn();
  render(
    <MapPreparation
      image={image}
      onAnalyzed={onAnalyzed}
      onManual={vi.fn()}
      onPreview={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Layout text language"), {
    target: { value: "sin" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Make this map interactive" }),
  );
  await waitFor(() => expect(onAnalyzed).toHaveBeenCalledWith(map));
  expect(analyzeUploadedMap).toHaveBeenCalledWith(
    image,
    "sin",
    expect.any(Function),
    expect.any(AbortSignal),
  );
});
it("cancels pending analysis and keeps preview available without accepting late results", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof analyzeUploadedMap>>) => void;
  vi.mocked(analyzeUploadedMap).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const onAnalyzed = vi.fn(),
    onPreview = vi.fn();
  render(
    <MapPreparation
      image={image}
      onAnalyzed={onAnalyzed}
      onManual={vi.fn()}
      onPreview={onPreview}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Make this map interactive" }),
  );
  await waitFor(() => expect(analyzeUploadedMap).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
  expect(vi.mocked(analyzeUploadedMap).mock.calls[0][3]?.aborted).toBe(true);
  await act(async () =>
    resolve(newMap(image) as Awaited<ReturnType<typeof analyzeUploadedMap>>),
  );
  expect(onAnalyzed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Open map preview" }));
  expect(onPreview).toHaveBeenCalledOnce();
});
