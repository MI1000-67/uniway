import { manualEdge, detectedEdge } from "./mapEdges";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import App from "./App";
import PreparedMapExplorer from "./PreparedMapExplorer";
import { newMap } from "./preparedMap";
import type { PreparedMap } from "./preparedMap";

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
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("turn-by-turn step navigation", () => {
  it("advances step by step when clicking next step button in demo campus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    render(<App />);

    // Activate session
    fireEvent.click(screen.getByRole("button", { name: "Scan QR" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Just looking around/ }),
    );

    // Select Central Library directly from the place list
    fireEvent.click(
      screen.getAllByRole("button", { name: /Central Library/i })[0],
    );

    // Request directions
    const routeButton = screen.getByRole("button", {
      name: /Get directions/i,
    });
    fireEvent.click(routeButton);

    // Check that instructions list exists and initial step is active
    const instructionItems = document.querySelectorAll(
      ".route-instructions li",
    );
    expect(instructionItems.length).toBeGreaterThan(1);
    expect(instructionItems[0].classList.contains("active-step")).toBe(true);

    // Check floating route has Next step button
    const nextBtn = screen.getByRole("button", { name: "Next step" });
    expect(nextBtn).toBeTruthy();

    // Click Next step button
    fireEvent.click(nextBtn);

    // Now step 1 is active (2nd item in list)
    expect(instructionItems[1].classList.contains("active-step")).toBe(true);
    expect(screen.getByText(/Step 2\//)).toBeTruthy();

    // Previous step button is now present
    const prevBtn = screen.getByRole("button", { name: "Previous step" });
    expect(prevBtn).toBeTruthy();

    // Click Previous step
    fireEvent.click(prevBtn);
    expect(instructionItems[0].classList.contains("active-step")).toBe(true);

    // Click directly on an instruction item
    fireEvent.click(instructionItems[2]);
    expect(instructionItems[2].classList.contains("active-step")).toBe(true);

    // Traveler marker group exists on map
    const traveler = document.querySelector(".traveler-marker-group");
    expect(traveler).toBeTruthy();
    expect(traveler?.querySelector(".position-marker")).toBeTruthy();
    expect(traveler?.querySelector(".traveler-beacon")).toBeTruthy();

    vi.useRealTimers();
  }, 30000);

  it("advances step by step in prepared uploaded campus explorer", () => {
    const fixtureMap: PreparedMap = {
      ...newMap({
        id: "test-map",
        name: "Test Campus",
        url: "blob:test",
        width: 1000,
        height: 800,
      }),
      published: true,
      places: [
        {
          id: "p1",
          name: "Main Gate",
          category: "Services",
          nodeId: "node-1",
          entrance: true,
        },
        {
          id: "p2",
          name: "Science Hall",
          category: "Teaching",
          nodeId: "node-2",
          entrance: false,
        },
      ],
      nodes: [
        { id: "node-1", x: 100, y: 100, landmark: "Main Gate" },
        { id: "node-2", x: 200, y: 200, landmark: "Science Hall" },
      ],
      edges: [manualEdge("node-1", "node-2", true)],
      metersPerPixel: 1,
    };

    render(
      <PreparedMapExplorer
        map={fixtureMap}
        onDemo={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    // Search and select Science Hall
    fireEvent.change(screen.getByLabelText("Search uploaded map"), {
      target: { value: "Science Hall" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Select Science Hall" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Show walking route" }));

    // Verify instructions list
    const items = document.querySelectorAll(".route-instructions li");
    expect(items.length).toBeGreaterThan(1);
    expect(items[0].classList.contains("active-step")).toBe(true);

    // Advance step
    const nextBtn = screen.getByRole("button", { name: "Next step" });
    fireEvent.click(nextBtn);

    expect(items[1].classList.contains("active-step")).toBe(true);
    expect(screen.getByText(/Step 2\//)).toBeTruthy();

    // Verify traveler beacon is rendered on canvas
    const traveler = document.querySelector(".traveler-marker-group");
    expect(traveler).toBeTruthy();
  });
});
