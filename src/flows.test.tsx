// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import App from "./App";
import QRPanel from "./QRPanel";
import UploadPanel from "./UploadPanel";
import { useVisitorSession } from "./useVisitorSession";
import { SESSION_DURATION, SESSION_KEY } from "./session";

beforeEach(() => {
  sessionStorage.clear();
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("visitor session lifecycle", () => {
  it("expires a sleeping tab, hides navigation, and allows a fresh scan", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Scan QR" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Just looking around/ }),
    );
    expect(screen.getByText("03:00:00")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Central Library.*Study spaces/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Get directions" }));
    expect(screen.getByText(/min walk/)).toBeTruthy();
    vi.setSystemTime(100000 + SESSION_DURATION + 5000);
    fireEvent.focus(window);
    expect(
      screen.getByRole("heading", { name: "Time for a fresh start." }),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Campus map" })).toBeNull();
    expect(screen.queryByText(/min walk/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Scan to return" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Just looking around/ }),
    );
    expect(screen.getByText("03:00:00")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Campus map" })).toBeTruthy();
  }, 30000);
  it("restores the original deadline on remount and does not extend an active scan", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const first = renderHook(() => useVisitorSession());
    act(() => first.result.current.activate("south-gate"));
    const deadline = first.result.current.session!.expiresAt;
    first.unmount();
    vi.setSystemTime(3601000);
    const restored = renderHook(() => useVisitorSession());
    expect(restored.result.current.remaining).toBe(2 * 60 * 60 * 1000);
    act(() => restored.result.current.activate("west-gate"));
    expect(restored.result.current.session!.expiresAt).toBe(deadline);
    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY)!).entranceId).toBe(
      "west-gate",
    );
  });
  it("keeps an in-memory session when browser storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    const hook = renderHook(() => useVisitorSession());
    expect(hook.result.current.warning).toMatch(/unavailable/);
    act(() => hook.result.current.activate("south-gate"));
    expect(hook.result.current.session?.entranceId).toBe("south-gate");
    expect(hook.result.current.expired).toBe(false);
  });
});

describe("QR scanner lifecycle", () => {
  it("stops camera tracks when the panel closes", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] };
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const panel = render(<QRPanel onActivate={vi.fn()} />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Open camera" })),
    );
    expect(screen.getByLabelText("Camera QR scanner")).toBeTruthy();
    panel.unmount();
    expect(stop).toHaveBeenCalled();
  });
  it("stops a camera request that resolves after the panel has closed", async () => {
    const stop = vi.fn();
    let resolve!: (value: unknown) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(
          () =>
            new Promise((r) => {
              resolve = r;
            }),
        ),
      },
    });
    const panel = render(<QRPanel onActivate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    panel.unmount();
    await act(async () => resolve({ getTracks: () => [{ stop }] }));
    expect(stop).toHaveBeenCalledOnce();
  });
  it("offers a useful alternative when camera access is denied", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
      },
    });
    render(<QRPanel onActivate={vi.fn()} />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Open camera" })),
    );
    expect(screen.getByRole("alert").textContent).toMatch(/declined/);
    expect(
      screen.getByRole("button", { name: "Upload QR image" }),
    ).toBeTruthy();
  });
  it("rejects unrelated codes without navigation and accepts a known entrance", () => {
    const activate = vi.fn();
    render(<QRPanel onActivate={activate} />);
    const input = screen.getByLabelText("Uniway entrance code");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.submit(input.closest("form")!);
    expect(activate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/not a recognised/);
    fireEvent.change(input, {
      target: { value: "uniway://willowbrook/north-gate" },
    });
    fireEvent.submit(input.closest("form")!);
    expect(activate).toHaveBeenCalledWith("north-gate");
  });
});

describe("upload interaction", () => {
  it("shows invalid-file feedback without creating a preview", async () => {
    const add = vi.fn();
    render(<UploadPanel images={[]} onAdd={add} onRemove={vi.fn()} />);
    await act(async () =>
      fireEvent.change(screen.getByLabelText("Choose campus map images"), {
        target: {
          files: [new File(["text"], "notes.txt", { type: "text/plain" })],
        },
      }),
    );
    expect(screen.getByRole("alert").textContent).toMatch(/JPEG, PNG, or WebP/);
    expect(add).toHaveBeenCalledWith([]);
  });
  it("previews a map and exposes removal", () => {
    const remove = vi.fn();
    render(
      <UploadPanel
        images={[
          {
            id: "test-map",
            name: "Campus.png",
            url: "blob:test",
            width: 600,
            height: 400,
          },
        ]}
        onAdd={vi.fn()}
        onRemove={remove}
      />,
    );
    expect(
      screen.getByAltText("Uploaded campus layout: Campus.png"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Campus.png" }));
    expect(remove).toHaveBeenCalledWith("test-map");
  });
});
