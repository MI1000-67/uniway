// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RouteChoices } from "./RouteChoices";

afterEach(cleanup);

describe("walking route choices", () => {
  it("uses text and line patterns and exposes the selected button", () => {
    const onSelect = vi.fn();
    render(
      <RouteChoices
        items={[
          { meters: 100, minutes: 2, distancePixels: 100 },
          { meters: 125, minutes: 2, distancePixels: 125 },
          { meters: 175, minutes: 3, distancePixels: 175 },
        ]}
        activeIndex={0}
        onSelect={onSelect}
      />,
    );
    const shortest = screen.getByRole("button", {
      name: /Shortest path.*Solid/,
    });
    const alternate = screen.getByRole("button", {
      name: /Alternative 1.*Dashed/,
    });
    expect(shortest.getAttribute("aria-pressed")).toBe("true");
    expect(alternate.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByRole("button", { name: /Alternative 2.*Dotted/ }),
    ).toBeTruthy();
    fireEvent.click(alternate);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("shows relative layout length, never invented metres or times, without a scale", () => {
    render(
      <RouteChoices
        items={[
          { meters: null, minutes: null, distancePixels: 100 },
          { meters: null, minutes: null, distancePixels: 140 },
        ]}
        activeIndex={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Distance not calibrated")).toBeTruthy();
    expect(screen.getByText("40% longer on this layout")).toBeTruthy();
    expect(screen.queryByText(/\d+ m(in)?/)).toBeNull();
    expect(screen.getByText(/Two connected routes are available/)).toBeTruthy();
  });

  it("explains one-route and unavailable cases", () => {
    const { rerender } = render(
      <RouteChoices
        items={[{ meters: 100, minutes: 2, distancePixels: 100 }]}
        activeIndex={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.getByText("One connected route is available for this journey."),
    ).toBeTruthy();
    rerender(<RouteChoices items={[]} activeIndex={0} onSelect={() => {}} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toContain(
      "No connected route",
    );
  });
});
