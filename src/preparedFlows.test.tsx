import { manualEdge, detectedEdge } from "./mapEdges";
// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MapEditor from "./MapEditor";
import PreparedMapExplorer from "./PreparedMapExplorer";
import { newMap } from "./preparedMap";
import type { PreparedMap } from "./preparedMap";

const fixture: PreparedMap = {
  ...newMap({
    id: "campus",
    name: "Campus.png",
    url: "blob:campus",
    width: 1000,
    height: 700,
  }),
  nodes: [
    { id: "gate", x: 100, y: 100, landmark: "Main Entrance" },
    { id: "library", x: 500, y: 400, landmark: "Library" },
  ],
  places: [
    {
      id: "gate",
      nodeId: "gate",
      name: "Main Entrance",
      category: "Services",
      entrance: true,
    },
    {
      id: "library",
      nodeId: "library",
      name: "Library",
      category: "Library",
      entrance: false,
    },
  ],
};
afterEach(cleanup);
describe("guided map preparation", () => {
  it("reviews a suggested path separately from step-free access before publication", () => {
    const publish = vi.fn();
    function Harness() {
      const [map, setMap] = useState({
        ...fixture,
        edges: [detectedEdge({ from: "gate", to: "library", stepFree: true })],
      });
      return (
        <MapEditor
          map={map}
          onChange={setMap}
          onPublish={publish}
          onBack={vi.fn()}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByLabelText(/I’ve checked/));
    fireEvent.click(
      screen.getByRole("button", { name: "Open interactive map" }),
    );
    expect(publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review next path" }));
    const access = screen.getByLabelText(
      "Verified step-free path to Library",
    ) as HTMLInputElement;
    expect(access.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Walkable path to Library"));
    expect(access.checked).toBe(false);
    expect(access.disabled).toBe(false);
    fireEvent.click(access);
    fireEvent.click(screen.getByLabelText(/I’ve checked/));
    fireEvent.click(
      screen.getByRole("button", { name: "Open interactive map" }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        published: true,
        edges: [
          expect.objectContaining({
            origin: "detected",
            stepFree: true,
            review: { pedestrian: true, accessibility: true },
          }),
        ],
      }),
    );
  });
  it("places unresolved names with the keyboard and supports undo", () => {
    function Harness() {
      const [map, setMap] = useState({
        ...newMap(fixture.image),
        unresolvedLabels: [
          {
            id: "u1",
            text: "Biology Library",
            confidence: 88,
            reason: "ambiguous-color",
          },
        ],
      } as PreparedMap);
      return (
        <MapEditor
          map={map}
          onChange={setMap}
          onPublish={vi.fn()}
          onBack={vi.fn()}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: "Place label Biology Library" }),
    );
    fireEvent.keyDown(
      screen.getByRole("group", { name: /^Map editor canvas/ }),
      { key: "ArrowRight" },
    );
    fireEvent.keyDown(
      screen.getByRole("group", { name: /^Map editor canvas/ }),
      { key: "Enter" },
    );
    expect(
      (screen.getByLabelText("Place name") as HTMLInputElement).value,
    ).toBe("Biology Library");
    expect(
      screen.queryByRole("button", { name: "Place label Biology Library" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo map change" }));
    expect(
      screen.getByRole("button", { name: "Place label Biology Library" }),
    ).toBeTruthy();
  });
  it("resets review when a pin moves and saves comma-separated search aliases", () => {
    const publish = vi.fn();
    function Harness() {
      const [map, setMap] = useState({
        ...fixture,
        edges: [manualEdge("gate", "library", true)],
      });
      return (
        <MapEditor
          map={map}
          onChange={setMap}
          onPublish={publish}
          onBack={vi.fn()}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /^Library$/ }));
    fireEvent.change(screen.getByLabelText("Other names (comma separated)"), {
      target: { value: "Reading room, Study centre" },
    });
    fireEvent.blur(screen.getByLabelText("Other names (comma separated)"));
    fireEvent.click(screen.getByLabelText(/I’ve checked/));
    fireEvent.click(screen.getByRole("button", { name: "Move selected pin" }));
    fireEvent.keyDown(
      screen.getByRole("group", { name: /^Map editor canvas/ }),
      { key: "ArrowRight" },
    );
    fireEvent.keyDown(
      screen.getByRole("group", { name: /^Map editor canvas/ }),
      { key: "Enter" },
    );
    expect(
      (screen.getByLabelText(/I’ve checked/) as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Open interactive map",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Walkable path to Main Entrance"));
    fireEvent.click(screen.getByLabelText(/I’ve checked/));
    fireEvent.click(
      screen.getByRole("button", { name: "Open interactive map" }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: [manualEdge("gate", "library", false)],
        places: expect.arrayContaining([
          expect.objectContaining({
            name: "Library",
            aliases: ["Reading room", "Study centre"],
          }),
        ]),
      }),
    );
  });
  it("keeps an unreviewed image explorable while withholding directions", () => {
    const edit = vi.fn();
    render(
      <PreparedMapExplorer map={fixture} onDemo={vi.fn()} onEdit={edit} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select Library" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Show walking route",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Review places & paths" }),
    );
    expect(edit).toHaveBeenCalledOnce();
  });
  it("connects real places and requires review before opening the map", () => {
    const publish = vi.fn();
    function Harness() {
      const [map, setMap] = useState(fixture);
      return (
        <MapEditor
          map={map}
          onChange={setMap}
          onPublish={publish}
          onBack={vi.fn()}
        />
      );
    }
    render(<Harness />);
    expect(
      (
        screen.getByRole("button", {
          name: "Open interactive map",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Draw paths" }));
    fireEvent.click(screen.getByRole("button", { name: "Main Entrance" }));
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    expect(
      screen.getByText("Every place is connected to a walking path."),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/I’ve checked/));
    fireEvent.click(
      screen.getByRole("button", { name: "Open interactive map" }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        published: true,
        edges: [manualEdge("gate", "library", false)],
      }),
    );
  });
  it("supports keyboard placement and undo without a mouse", () => {
    function Harness() {
      const [map, setMap] = useState(newMap(fixture.image));
      return (
        <MapEditor
          map={map}
          onChange={setMap}
          onPublish={vi.fn()}
          onBack={vi.fn()}
        />
      );
    }
    render(<Harness />);
    const canvas = screen.getByRole("group", { name: /^Map editor canvas/ });
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    fireEvent.keyDown(canvas, { key: "Enter" });
    expect(
      (screen.getByLabelText("Place name") as HTMLInputElement).value,
    ).toBe("Place 1");
    fireEvent.change(screen.getByLabelText("Place name"), {
      target: { value: "Science" },
    });
    expect(
      screen.getByRole("button", { name: "Science, selected" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo map change" }));
    expect(screen.queryByLabelText("Place name")).toBeNull();
  });
  it("searches the uploaded campus, renders routes, and explains unavailable step-free paths", () => {
    render(
      <PreparedMapExplorer
        map={{
          ...fixture,
          edges: [manualEdge("gate", "library", false)],
          published: true,
        }}
        onDemo={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search uploaded map"), {
      target: { value: "Library" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Show walking route" }));
    expect(
      screen.getAllByText("Distance not calibrated").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Follow the marked path to Library.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Step-free paths only/));
    expect(screen.getByRole("alert").textContent).toContain(
      "No connected step-free path",
    );
  });
  it("collapses and reopens the sidebar using the toggle buttons", () => {
    render(
      <PreparedMapExplorer
        map={{
          ...fixture,
          published: true,
        }}
        onDemo={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    const collapseBtn = screen.getByRole("button", {
      name: "Collapse sidebar",
    });
    expect(collapseBtn).toBeTruthy();
    fireEvent.click(collapseBtn);
    const reopenBtn = screen.getByRole("button", { name: "Explore map" });
    expect(reopenBtn).toBeTruthy();
    fireEvent.click(reopenBtn);
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeTruthy();
  });
  it("allows confirming all detected paths as walkable in bulk to unlock the interactive map", () => {
    const publish = vi.fn();
    function Harness() {
      const [map, setMap] = useState({
        ...fixture,
        edges: [detectedEdge({ from: "gate", to: "library", stepFree: false })],
      });
      return (
        <MapEditor
          map={map}
          onChange={setMap}
          onPublish={publish}
          onBack={vi.fn()}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByLabelText(/I’ve checked/));
    const publishBtn = screen.getByRole("button", {
      name: "Open interactive map",
    }) as HTMLButtonElement;
    expect(publishBtn.disabled).toBe(true);
    expect(
      screen.getByText(/Review pedestrian access for 1 path segment/),
    ).toBeTruthy();

    const confirmAllBtn = screen.getAllByRole("button", {
      name: /Confirm all.*walkable/i,
    })[0];
    fireEvent.click(confirmAllBtn);

    expect(
      screen.queryByText(/Review pedestrian access for 1 path segment/),
    ).toBeNull();
    expect(publishBtn.disabled).toBe(false);
    fireEvent.click(publishBtn);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        published: true,
        edges: [
          expect.objectContaining({
            origin: "detected",
            stepFree: false,
            review: { pedestrian: true, accessibility: false },
          }),
        ],
      }),
    );
  });
  it("allows one-click adding second place when only one place exists", () => {
    function Harness() {
      const [map, setMap] = useState<PreparedMap>({
        ...fixture,
        places: [fixture.places[0]],
        edges: [],
      });
      return (
        <MapEditor
          map={map}
          onChange={setMap}
          onPublish={vi.fn()}
          onBack={vi.fn()}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByText(/Add at least two named places/)).toBeTruthy();
    const addPlaceBtn = screen.getByRole("button", {
      name: /Add a second place marker/i,
    });
    fireEvent.click(addPlaceBtn);
    expect(screen.queryByText(/Add at least two named places/)).toBeNull();
  });
});
