// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import VisitorTour from "./VisitorTour";

afterEach(cleanup);

describe("VisitorTour (Requirement R4: Interactive Visitor Walkthrough)", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <VisitorTour isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the initial step when opened", () => {
    render(<VisitorTour isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Welcome to UniWay")).toBeTruthy();
    expect(screen.getByText("1 of 7")).toBeTruthy();
    expect(screen.getByText("Smart Navigation")).toBeTruthy();
  });

  it("advances step by step when clicking Next", () => {
    render(<VisitorTour isOpen={true} onClose={vi.fn()} />);

    const nextBtn = screen.getByRole("button", { name: /next step/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText("Explore Campus Landmarks")).toBeTruthy();
    expect(screen.getByText("2 of 7")).toBeTruthy();

    fireEvent.click(nextBtn);
    expect(screen.getByText("Landmark Details & Accessibility")).toBeTruthy();
    expect(screen.getByText("3 of 7")).toBeTruthy();
  });

  it("goes back when clicking Back button", () => {
    render(<VisitorTour isOpen={true} onClose={vi.fn()} />);

    const nextBtn = screen.getByRole("button", { name: /next step/i });
    fireEvent.click(nextBtn); // step 2
    expect(screen.getByText("2 of 7")).toBeTruthy();

    const backBtn = screen.getByRole("button", { name: /previous step/i });
    fireEvent.click(backBtn);
    expect(screen.getByText("1 of 7")).toBeTruthy();
    expect(screen.getByText("Welcome to UniWay")).toBeTruthy();
  });

  it("triggers interactive callbacks when interactive actions are clicked", () => {
    const onSelectPlace = vi.fn();
    const onStartRoute = vi.fn();
    const onToggleStepFree = vi.fn();
    const onSwitchView = vi.fn();
    const onClose = vi.fn();

    render(
      <VisitorTour
        isOpen={true}
        onClose={onClose}
        onSelectPlace={onSelectPlace}
        onStartRoute={onStartRoute}
        onToggleStepFree={onToggleStepFree}
        onSwitchView={onSwitchView}
      />,
    );

    // Step 1 -> Step 2 (Explore)
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    const findLibraryBtn = screen.getByRole("button", {
      name: /find central library/i,
    });
    fireEvent.click(findLibraryBtn);
    expect(onSelectPlace).toHaveBeenCalledWith("central-library");

    // Step 2 -> Step 3 (Details)
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    const inspectLibraryBtn = screen.getByRole("button", {
      name: /inspect library/i,
    });
    fireEvent.click(inspectLibraryBtn);
    expect(onSelectPlace).toHaveBeenCalledWith("central-library");

    // Step 3 -> Step 4 (Routing)
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    const routeLibraryBtn = screen.getByRole("button", {
      name: /route to library/i,
    });
    fireEvent.click(routeLibraryBtn);
    expect(onStartRoute).toHaveBeenCalledWith("central-library");

    // Step 4 -> Step 5 (Step-Free)
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    const stepFreeBtn = screen.getByRole("button", {
      name: /enable step-free/i,
    });
    fireEvent.click(stepFreeBtn);
    expect(onToggleStepFree).toHaveBeenCalledWith(true);

    // Step 5 -> Step 6 (Turn-by-turn)
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    // Step 6 -> Step 7 (Connect)
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    const connectBtn = screen.getByRole("button", {
      name: /explore uniway connect/i,
    });
    fireEvent.click(connectBtn);
    expect(onSwitchView).toHaveBeenCalledWith("connect");
    expect(onClose).toHaveBeenCalled();
  });

  it("handles keyboard navigation (ArrowRight, ArrowLeft, Escape)", () => {
    const onClose = vi.fn();
    render(<VisitorTour isOpen={true} onClose={onClose} />);

    // ArrowRight advances
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2 of 7")).toBeTruthy();

    // ArrowLeft goes back
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("1 of 7")).toBeTruthy();

    // Escape closes
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the close (X) button is clicked", () => {
    const onClose = vi.fn();
    render(<VisitorTour isOpen={true} onClose={onClose} />);

    const closeBtn = screen.getByRole("button", { name: /close walkthrough/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
