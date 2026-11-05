// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import MapCompass from "./MapCompass";
import {
  compassDirection,
  headingFromOrientation,
  headingUpRotation,
  normalizeDegrees,
  northUpRotation,
} from "./compass";

beforeEach(() => {
  vi.stubGlobal("isSecureContext", true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function compassEvent(
  values: Record<string, unknown>,
  type = "deviceorientationabsolute",
) {
  const event = new Event(type);
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(event, key, { value });
  }
  act(() => window.dispatchEvent(event));
}

function showCompass(northOffset: number | null = 0) {
  const onRotationChange = vi.fn();
  const result = render(
    <MapCompass
      rotation={60}
      northOffset={northOffset}
      onRotationChange={onRotationChange}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name:
        northOffset === null
          ? /north not calibrated/
          : "Map compass and rotation",
    }),
  );
  return { ...result, onRotationChange };
}

describe("compass angles", () => {
  it("wraps rotation and aligns map north and heading independently", () => {
    expect(normalizeDegrees(-30)).toBe(330);
    expect(normalizeDegrees(720)).toBe(0);
    expect(northUpRotation(90)).toBe(270);
    // Printed north points right; after rotating 180°, it points left of screen.
    expect(headingUpRotation(90, 90)).toBe(180);
    expect(compassDirection(359)).toBe("N");
    expect(compassDirection(90)).toBe("E");
  });

  it("never treats relative alpha as north and rejects missing or tilted readings", () => {
    expect(
      headingFromOrientation({ absolute: false, alpha: 25, beta: 0, gamma: 0 }),
    ).toBeNull();
    expect(
      headingFromOrientation({
        absolute: true,
        alpha: null,
        beta: 0,
        gamma: 0,
      }),
    ).toBeNull();
    expect(headingFromOrientation({ absolute: true, alpha: 25 })).toBeNull();
    expect(
      headingFromOrientation({ absolute: true, alpha: 25, beta: 75, gamma: 0 }),
    ).toBeNull();
    expect(
      headingFromOrientation({
        absolute: true,
        alpha: 25,
        beta: NaN,
        gamma: 0,
      }),
    ).toBeNull();
  });

  it("uses absolute level readings and the screen orientation", () => {
    expect(
      headingFromOrientation({ absolute: true, alpha: 90, beta: 0, gamma: 0 }),
    ).toBe(270);
    expect(
      headingFromOrientation(
        { absolute: true, alpha: 90, beta: 0, gamma: 0 },
        90,
      ),
    ).toBe(0);
    expect(
      headingFromOrientation({
        alpha: null,
        webkitCompassHeading: 315,
        webkitCompassAccuracy: 10,
      }),
    ).toBe(315);
    expect(
      headingFromOrientation({
        alpha: null,
        webkitCompassHeading: 315,
        webkitCompassAccuracy: -1,
      }),
    ).toBeNull();
    expect(
      headingFromOrientation({
        alpha: null,
        webkitCompassHeading: 315,
        webkitCompassAccuracy: 90,
      }),
    ).toBeNull();
  });
});

describe("map compass controls", () => {
  it("rotates manually and resets to calibrated north", () => {
    const { onRotationChange } = showCompass(90);
    fireEvent.click(screen.getByRole("button", { name: "Rotate map left" }));
    expect(onRotationChange).toHaveBeenLastCalledWith(30);
    fireEvent.click(screen.getByRole("button", { name: "Rotate map right" }));
    expect(onRotationChange).toHaveBeenLastCalledWith(90);
    fireEvent.click(screen.getByRole("button", { name: "North up" }));
    expect(onRotationChange).toHaveBeenLastCalledWith(270);
  });

  it("labels unknown north and only calibrates when the user confirms", () => {
    const onNorthOffsetChange = vi.fn();
    render(
      <MapCompass
        rotation={300}
        northOffset={null}
        onRotationChange={vi.fn()}
        onNorthOffsetChange={onNorthOffsetChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /north not calibrated/ }),
    );
    expect(
      screen.getByText("North is not calibrated for this image."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "North up" })).toBeNull();
    expect(onNorthOffsetChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use this as north" }));
    expect(onNorthOffsetChange).toHaveBeenCalledWith(60);
  });

  it("requests permission only on a click and handles denial", async () => {
    const requestPermission = vi.fn().mockResolvedValue("denied");
    vi.stubGlobal("DeviceOrientationEvent", { requestPermission });
    showCompass();
    expect(requestPermission).not.toHaveBeenCalled();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Use device compass" }),
      ),
    );
    expect(requestPermission).toHaveBeenCalledWith(true);
    expect(screen.getByRole("status").textContent).toMatch(/not allowed/);
    expect(screen.queryByText("Device heading")).toBeNull();
  });

  it("does not invent a reading on unsupported browsers", () => {
    vi.stubGlobal("DeviceOrientationEvent", undefined);
    showCompass();
    fireEvent.click(screen.getByRole("button", { name: "Use device compass" }));
    expect(screen.getByRole("status").textContent).toMatch(/unavailable/);
    expect(screen.queryByText("Device heading")).toBeNull();
  });

  it("reads absolute headings, aligns on request, and removes sensor listeners", async () => {
    vi.stubGlobal("DeviceOrientationEvent", {});
    const remove = vi.spyOn(window, "removeEventListener");
    const { onRotationChange, unmount } = showCompass();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Use device compass" }),
      ),
    );
    compassEvent(
      { absolute: false, alpha: 90, beta: 0, gamma: 0 },
      "deviceorientation",
    );
    expect(screen.queryByText("Device heading")).toBeNull();
    compassEvent({ absolute: true, alpha: 270, beta: 0, gamma: 0 });
    expect(screen.getByText("90° E")).toBeTruthy();
    expect(onRotationChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Align map to this heading" }),
    );
    expect(onRotationChange).toHaveBeenCalledWith(270);
    unmount();
    expect(remove).toHaveBeenCalledWith(
      "deviceorientation",
      expect.any(Function),
    );
    expect(remove).toHaveBeenCalledWith(
      "deviceorientationabsolute",
      expect.any(Function),
    );
  });

  it("stops listening after no reliable reading arrives", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("DeviceOrientationEvent", {});
    const remove = vi.spyOn(window, "removeEventListener");
    showCompass();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Use device compass" }),
      ),
    );
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("status").textContent).toMatch(
      /No reliable compass reading/,
    );
    expect(remove).toHaveBeenCalledWith(
      "deviceorientationabsolute",
      expect.any(Function),
    );
    expect(screen.queryByText("Device heading")).toBeNull();
  });

  it("ignores permission results after the component is unmounted", async () => {
    let resolve!: (result: string) => void;
    const requestPermission = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("DeviceOrientationEvent", { requestPermission });
    const add = vi.spyOn(window, "addEventListener");
    const { unmount } = showCompass();
    fireEvent.click(screen.getByRole("button", { name: "Use device compass" }));
    unmount();
    await act(async () => resolve("granted"));
    expect(add).not.toHaveBeenCalledWith(
      "deviceorientationabsolute",
      expect.any(Function),
    );
  });
});
