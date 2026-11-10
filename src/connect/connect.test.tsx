import { demoLocation } from "../locations";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import App from "../App";
import ConnectView from "./ConnectView";

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
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
});

describe("UniWay Connect (Module B) - Seller & Volunteer Management", () => {
  it("clears previous directions when a Connect location is unavailable", () => {
    render(<App />);
    const goConnect = () =>
      fireEvent.click(screen.getByRole("button", { name: "UniWay Connect" }));
    goConnect();
    fireEvent.click(screen.getAllByRole("button", { name: "Navigate" })[1]);
    expect(screen.getByRole("button", { name: "End directions" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "School of Science" }),
    ).toBeTruthy();
    goConnect();
    fireEvent.click(screen.getByRole("button", { name: /^Volunteer/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Directions" })[0]);
    expect(screen.queryByRole("button", { name: "End directions" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "School of Science" }),
    ).toBeNull();
    expect(
      screen.getByText(
        /No verified route is available for University Sports Ground/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Showing map for:/)).toBeNull();
  }, 30000);
  it("routes Student Centre using its exact place reference", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "UniWay Connect" }));
    const title = screen.getByText(/GreenExE/);
    fireEvent.click(
      within(title.closest(".connect-card")!).getByRole("button", {
        name: "Navigate",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Student Centre" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "End directions" })).toBeTruthy();
  }, 30000);
  it("renders the hero banner with approved tagline", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Find your way. Find your community."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /UniWay Connect · (Interactive demo|Smart Campus Ecosystem)/i,
      ),
    ).toBeTruthy();
  });

  it("renders Common and Volunteer primary navigation tabs", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    const commonTab = screen.getByRole("button", { name: /Common/i });
    const volunteerTab = screen.getByRole("button", { name: /Volunteer/i });

    expect(commonTab.className).toContain("active");
    expect(volunteerTab.className).not.toContain("active");
  });

  it("allows a seller to open '+ List an Item' modal and publish a new item", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    const listBtn = screen.getByRole("button", { name: /List an Item/i });
    fireEvent.click(listBtn);

    expect(
      screen.getByRole("heading", { name: "Create Campus Listing" }),
    ).toBeTruthy();

    const titleInput = screen.getByLabelText(/Item Title \*/i);
    fireEvent.change(titleInput, {
      target: { value: "Data Structures & Algorithms Course Notes" },
    });

    const sellerInput = screen.getByLabelText(/Seller Name \*/i);
    fireEvent.change(sellerInput, {
      target: { value: "Malik R." },
    });

    const contactInput = screen.getByLabelText(/Contact Email or Phone \*/i);
    fireEvent.change(contactInput, {
      target: { value: "malik.r@campus.uniway.edu" },
    });

    const submitBtn = screen.getByRole("button", {
      name: /Publish Listing/i,
    });
    fireEvent.submit(submitBtn.closest("form")!);

    // Modal closed and item rendered in feed
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByText("Data Structures & Algorithms Course Notes"),
    ).toBeTruthy();
  });

  it("allows an organizer to open '+ Post Opportunity' modal and publish a role", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    // Switch to volunteer tab
    const volunteerTab = screen.getByRole("button", { name: /Volunteer/i });
    fireEvent.click(volunteerTab);

    const postVolBtn = screen.getByRole("button", {
      name: /Post Opportunity/i,
    });
    fireEvent.click(postVolBtn);

    expect(
      screen.getByRole("heading", { name: "Recruit Campus Volunteers" }),
    ).toBeTruthy();

    const titleInput = screen.getByLabelText(/Opportunity Title \*/i);
    fireEvent.change(titleInput, {
      target: { value: "Campus Solar Panel Cleaning Drive" },
    });

    const orgInput = screen.getByLabelText(/Hosting Student Club \*/i);
    fireEvent.change(orgInput, {
      target: { value: "Clean Energy Society" },
    });

    const submitBtn = screen.getByRole("button", {
      name: /Publish Opportunity/i,
    });
    fireEvent.submit(submitBtn.closest("form")!);

    // Modal closed and opportunity rendered
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Campus Solar Panel Cleaning Drive")).toBeTruthy();
    expect(screen.getByText("Clean Energy Society")).toBeTruthy();
  });

  it("allows seller to toggle Seller Controls and mark an item as Sold", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    const manageBtn = screen.getByRole("button", {
      name: /Seller Controls/i,
    });
    fireEvent.click(manageBtn);

    expect(screen.getByText(/Seller Dashboard Active/i)).toBeTruthy();

    // Click "Sold" on the first listing
    const soldBtns = screen.getAllByRole("button", { name: "Sold" });
    fireEvent.click(soldBtns[0]);

    // Check that chip text updates to "sold"
    expect(screen.getByText("sold")).toBeTruthy();
  });

  it("allows organizer to toggle recruitment between OPEN and CLOSED", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    const volunteerTab = screen.getByRole("button", { name: /Volunteer/i });
    fireEvent.click(volunteerTab);

    const manageBtn = screen.getByRole("button", {
      name: /Organizer Controls/i,
    });
    fireEvent.click(manageBtn);

    expect(screen.getByText(/Volunteer Coordinator Dashboard/i)).toBeTruthy();

    // Click status toggle button
    const openStatusBtn = screen.getAllByRole("button", {
      name: "Status: OPEN",
    })[0];
    fireEvent.click(openStatusBtn);

    expect(screen.getByText("Status: CLOSED")).toBeTruthy();
  });

  it("passes an exact demo reference separately from pickup display text", () => {
    const handleNavigate = vi.fn();
    render(
      <ConnectView
        onNavigateToLocation={handleNavigate}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    const navigateBtns = screen.getAllByRole("button", { name: /Navigate/i });
    expect(navigateBtns.length).toBeGreaterThan(0);

    fireEvent.click(navigateBtns[0]);

    expect(handleNavigate).toHaveBeenCalledWith(
      demoLocation("science"),
      "School of Science — Ground Floor Foyer",
    );
  });

  it("allows voting in the campus interest poll and shows updated state", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    const pollQuestion = screen.getByText(
      /Should the Student Council establish a weekly Tuesday pop-up market/i,
    );
    expect(pollQuestion).toBeTruthy();

    const yesOption = screen.getByText(/Yes, definitely! Would visit weekly/i);
    fireEvent.click(yesOption);

    expect(screen.getByText(/✓ \(Your vote\)/i)).toBeTruthy();
  });

  it("allows seamless navigation switching in App header", () => {
    render(<App />);

    // Initially in Navigate view with campus map
    expect(screen.getByRole("region", { name: "Campus map" })).toBeTruthy();

    // Click "UniWay Connect" in the header switcher
    const connectNavBtn = screen.getByRole("button", {
      name: /UniWay Connect/i,
    });
    fireEvent.click(connectNavBtn);

    // Verify Connect view is displayed
    expect(
      screen.getByRole("heading", {
        name: "Find your way. Find your community.",
      }),
    ).toBeTruthy();

    // Click "Navigate" in the header switcher to return
    const navSwitcher = screen.getByRole("navigation", {
      name: "Main module switcher",
    });
    const navigateNavBtn = within(navSwitcher).getByRole("button", {
      name: /Navigate/i,
    });
    fireEvent.click(navigateNavBtn);

    // Campus map is back
    expect(screen.getByRole("region", { name: "Campus map" })).toBeTruthy();
  });

  it("renders campus posters with attached polls, allows live voting, and displays updated percentage", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    // Switch to Posters & Polls tab
    const postersTabBtn = screen.getByRole("button", {
      name: /Posters & Polls/i,
    });
    fireEvent.click(postersTabBtn);

    // Check poster cards are rendered
    expect(
      screen.getByText("Annual Campus Innovation Hackathon 2026"),
    ).toBeTruthy();

    // Check attached poll questions
    const pollQuestion = screen.getByText(
      /Which track will your team hack on\?/i,
    );
    expect(pollQuestion).toBeTruthy();

    // Vote on an attached poll option
    const smartNavBtn = screen.getByRole("button", {
      name: /Smart Navigation & Indoor Mobility/i,
    });
    fireEvent.click(smartNavBtn);

    // Verify option now shows (Your vote)
    expect(screen.getAllByText(/✓ \(Your vote\)/i).length).toBeGreaterThan(0);
  });

  it("allows creating a new poster with an attached poll and saves it locally", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    // Switch to Posters & Polls tab
    fireEvent.click(screen.getByRole("button", { name: /Posters & Polls/i }));

    // Click "+ Post Campus Poster"
    const openCreateBtn = screen.getByRole("button", {
      name: /Post Campus Poster/i,
    });
    fireEvent.click(openCreateBtn);

    // Fill form
    fireEvent.change(screen.getByLabelText(/Poster Title \*/i), {
      target: { value: "Robotics Club Showcase 2026" },
    });
    fireEvent.change(screen.getByLabelText(/Organizer \/ Club \*/i), {
      target: { value: "Robotics Society" },
    });
    fireEvent.change(screen.getByLabelText(/Event Date & Time/i), {
      target: { value: "Friday, Dec 5 · 14:00" },
    });
    fireEvent.change(screen.getByLabelText(/Poster Description \*/i), {
      target: {
        value: "Hands-on exhibition with autonomous rovers and drones.",
      },
    });
    fireEvent.change(screen.getByLabelText(/Poll Question \*/i), {
      target: { value: "What demo do you want to see?" },
    });

    const optInputs = screen.getAllByPlaceholderText(/Option \d/i);
    fireEvent.change(optInputs[0], { target: { value: "Autonomous Rovers" } });
    fireEvent.change(optInputs[1], { target: { value: "Racing Drones" } });

    // Submit form
    const submitBtn = screen.getByRole("button", {
      name: /Publish Poster & Poll/i,
    });
    fireEvent.click(submitBtn);

    // New poster should now appear in the feed
    expect(screen.getByText("Robotics Club Showcase 2026")).toBeTruthy();
    expect(screen.getByText(/Posted by Robotics Society/i)).toBeTruthy();
    expect(screen.getByText("What demo do you want to see?")).toBeTruthy();
    expect(screen.getByText("Autonomous Rovers")).toBeTruthy();
    expect(screen.getByText("Racing Drones")).toBeTruthy();
  });

  it("allows moderator controls to delete a poster", () => {
    render(
      <ConnectView
        onNavigateToLocation={vi.fn()}
        onSwitchToNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Posters & Polls/i }));
    expect(
      screen.getByText("Annual Campus Innovation Hackathon 2026"),
    ).toBeTruthy();

    // Toggle Moderator Controls
    fireEvent.click(
      screen.getByRole("button", { name: /Moderator Controls/i }),
    );

    // Click delete poster
    const deleteBtn = screen.getByRole("button", {
      name: /Delete poster Annual Campus Innovation Hackathon 2026/i,
    });
    fireEvent.click(deleteBtn);

    expect(
      screen.queryByText("Annual Campus Innovation Hackathon 2026"),
    ).toBeNull();
  });
});
