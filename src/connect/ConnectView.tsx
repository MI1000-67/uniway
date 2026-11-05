import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  GraduationCap,
  HeartHandshake,
  Info,
  MapPin,
  Navigation,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  Vote,
  X,
} from "lucide-react";
import type {
  CommunityPost,
  ConnectCategory,
  InterestPoll,
  ItemStatus,
  VolunteerApplication,
  VolunteerFocus,
  VolunteerOpportunity,
} from "./types";
import {
  initialCommunityPosts,
  initialInterestPolls,
  initialVolunteerOpportunities,
} from "./mockData";
import "./connect.css";

interface ConnectViewProps {
  onNavigateToLocation: (placeId?: string, locationName?: string) => void;
  onSwitchToNavigate: () => void;
}

const campusLocations = [
  { id: "science", name: "School of Science — Ground Floor Foyer" },
  { id: "library", name: "The Central Library — Study Commons" },
  { id: "cafe", name: "Common Ground Café — North Patio" },
  { id: "engineering", name: "Engineering Building — Makerspace" },
  { id: "student-centre", name: "Student Centre — Atrium" },
  { id: "sports", name: "University Sports Ground — Pavilion" },
  { id: "arts", name: "Faculty of Arts — Quad" },
];

export default function ConnectView({
  onNavigateToLocation,
  onSwitchToNavigate,
}: ConnectViewProps) {
  const [activeTab, setActiveTab] = useState<"common" | "volunteer">("common");
  const [commonCategory, setCommonCategory] = useState<ConnectCategory>("All");
  const [volunteerFocus, setVolunteerFocus] = useState<VolunteerFocus>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [posts, setPosts] = useState<CommunityPost[]>(initialCommunityPosts);
  const [opportunities, setOpportunities] = useState<VolunteerOpportunity[]>(
    initialVolunteerOpportunities,
  );
  const [polls, setPolls] = useState<InterestPoll[]>(initialInterestPolls);

  // Management mode toggle
  const [manageMode, setManageMode] = useState(false);

  // Creation modals
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isCreatingVol, setIsCreatingVol] = useState(false);

  // Create post form fields
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostCategory, setNewPostCategory] =
    useState<CommunityPost["category"]>("Textbooks");
  const [newPostPrice, setNewPostPrice] = useState("1500");
  const [newPostCondition, setNewPostCondition] =
    useState<CommunityPost["condition"]>("Good");
  const [newPostPlaceId, setNewPostPlaceId] = useState("science");
  const [newPostLocationCustom, setNewPostLocationCustom] = useState("");
  const [newPostPickupWindow, setNewPostPickupWindow] = useState(
    "Weekdays 12:00 – 14:00",
  );
  const [newPostSellerName, setNewPostSellerName] = useState("");
  const [newPostSellerContact, setNewPostSellerContact] = useState("");
  const [newPostDescription, setNewPostDescription] = useState("");

  // Create volunteer form fields
  const [newVolTitle, setNewVolTitle] = useState("");
  const [newVolOrg, setNewVolOrg] = useState("");
  const [newVolFocus, setNewVolFocus] =
    useState<VolunteerFocus>("Sustainability");
  const [newVolHours, setNewVolHours] = useState("3.0");
  const [newVolSpots, setNewVolSpots] = useState("10");
  const [newVolDate, setNewVolDate] = useState(
    "Saturday, Nov 15 · 09:00 – 12:00",
  );
  const [newVolPlaceId, setNewVolPlaceId] = useState("library");
  const [newVolReqs, setNewVolReqs] = useState(
    "Enthusiastic and ready to collaborate, Bring student ID",
  );
  const [newVolDesc, setNewVolDesc] = useState("");

  // Volunteer applications state
  const [applications, setApplications] = useState<VolunteerApplication[]>([
    {
      id: "app-1",
      opportunityId: "vol-1",
      applicantName: "Dinuka Fernando",
      applicantEmail: "dinuka.f@campus.uniway.edu",
      statement: "Passionate about reforestation, available Saturday morning.",
      submittedAt: "2026-11-03T10:15:00Z",
      status: "pending",
    },
  ]);

  // Selected item / modal states
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [applyingVol, setApplyingVol] = useState<VolunteerOpportunity | null>(
    null,
  );
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantStatement, setApplicantStatement] = useState("");

  // Handle poll voting
  const handleVote = (pollId: string, optionId: string) => {
    setPolls((prev) =>
      prev.map((poll) => {
        if (poll.id !== pollId) return poll;
        if (poll.userVotedOptionId) return poll;
        return {
          ...poll,
          userVotedOptionId: optionId,
          totalVotes: poll.totalVotes + 1,
          options: poll.options.map((opt) =>
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt,
          ),
        };
      }),
    );
  };

  // Seller post management
  const updatePostStatus = (postId: string, newStatus: ItemStatus) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: newStatus } : p)),
    );
  };

  const deletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  // Organizer opportunity management
  const toggleVolStatus = (volId: string) => {
    setOpportunities((prev) =>
      prev.map((v) =>
        v.id === volId
          ? { ...v, status: v.status === "open" ? "closed" : "open" }
          : v,
      ),
    );
  };

  // Handle new post creation
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim()) return;

    const locObj = campusLocations.find((l) => l.id === newPostPlaceId);
    const locName =
      newPostLocationCustom.trim() || locObj?.name || "Campus Pickup";
    const newId = `post-${Date.now()}`;
    const newPost: CommunityPost = {
      id: newId,
      type: "marketplace",
      title: newPostTitle.trim(),
      description:
        newPostDescription.trim() ||
        "Student listing on UniWay campus marketplace.",
      category: newPostCategory,
      price: parseFloat(newPostPrice) || 0,
      condition: newPostCondition,
      sellerName: newPostSellerName.trim() || "Student Seller",
      sellerContact: newPostSellerContact.trim() || "student@campus.uniway.edu",
      placeId: newPostPlaceId,
      locationName: locName,
      pickupWindow: newPostPickupWindow.trim() || "By appointment",
      status: "available",
      badge: "My Listing",
      createdAt: new Date().toISOString(),
    };

    setPosts((prev) => [newPost, ...prev]);
    setIsCreatingPost(false);
    setNewPostTitle("");
    setNewPostDescription("");
  };

  // Handle new volunteer opportunity creation
  const handleCreateVol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVolTitle.trim() || !newVolOrg.trim()) return;

    const locObj = campusLocations.find((l) => l.id === newVolPlaceId);
    const locName = locObj?.name || "Campus Grounds";
    const newId = `vol-${Date.now()}`;
    const reqList = newVolReqs
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const newVol: VolunteerOpportunity = {
      id: newId,
      title: newVolTitle.trim(),
      organization: newVolOrg.trim(),
      description:
        newVolDesc.trim() || "Join fellow students in community action.",
      focusArea: newVolFocus === "All" ? "Sustainability" : newVolFocus,
      hoursCredit: parseFloat(newVolHours) || 2.0,
      spotsTotal: parseInt(newVolSpots, 10) || 5,
      spotsFilled: 0,
      eventDate: newVolDate.trim() || "Upcoming Weekend",
      placeId: newVolPlaceId,
      locationName: locName,
      requirements: reqList.length > 0 ? reqList : ["All students welcome"],
      status: "open",
    };

    setOpportunities((prev) => [newVol, ...prev]);
    setIsCreatingVol(false);
    setNewVolTitle("");
    setNewVolOrg("");
    setNewVolDesc("");
  };

  // Filter Common Posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesCategory =
        commonCategory === "All" || post.category === commonCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.description.toLowerCase().includes(q) ||
        post.locationName.toLowerCase().includes(q) ||
        post.sellerName.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [posts, commonCategory, searchQuery]);

  // Filter Volunteer Opportunities
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      const matchesFocus =
        volunteerFocus === "All" || opp.focusArea === volunteerFocus;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        opp.title.toLowerCase().includes(q) ||
        opp.description.toLowerCase().includes(q) ||
        opp.organization.toLowerCase().includes(q) ||
        opp.locationName.toLowerCase().includes(q);
      return matchesFocus && matchesSearch;
    });
  }, [opportunities, volunteerFocus, searchQuery]);

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !applicantEmail.trim()) return;

    if (applyingVol) {
      setOpportunities((prev) =>
        prev.map((opp) =>
          opp.id === applyingVol.id
            ? {
                ...opp,
                spotsFilled: Math.min(opp.spotsTotal, opp.spotsFilled + 1),
              }
            : opp,
        ),
      );
      const newApp: VolunteerApplication = {
        id: `app-${Date.now()}`,
        opportunityId: applyingVol.id,
        applicantName: applicantName.trim(),
        applicantEmail: applicantEmail.trim(),
        statement: applicantStatement.trim(),
        submittedAt: new Date().toISOString(),
        status: "pending",
      };
      setApplications((prev) => [newApp, ...prev]);
    }
    setApplicationSubmitted(true);
    setTimeout(() => {
      setApplicationSubmitted(false);
      setApplyingVol(null);
      setApplicantName("");
      setApplicantEmail("");
      setApplicantStatement("");
    }, 2000);
  };

  return (
    <div className="connect-container">
      {/* Hero Section */}
      <section className="connect-hero">
        <span className="connect-hero-eyebrow">
          <Sparkles size={14} /> UniWay Connect · Smart Campus Ecosystem
        </span>
        <h1 className="connect-hero-title">
          Find your way. Find your community.
        </h1>
        <p className="connect-hero-subtitle">
          Connect directly with fellow students, local bakes, course supplies,
          academic hackathons, and community greening initiatives across campus.
        </p>
      </section>

      {/* Primary Switcher Tabs: Common vs Volunteer */}
      <nav className="connect-nav-tabs" aria-label="UniWay Connect sections">
        <button
          className={`connect-tab-btn ${activeTab === "common" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("common");
            setSearchQuery("");
          }}
          type="button"
          aria-pressed={activeTab === "common"}
        >
          <ShoppingBag size={18} />
          <span>Common</span>
          <span className="connect-tab-badge">{filteredPosts.length}</span>
        </button>

        <button
          className={`connect-tab-btn ${activeTab === "volunteer" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("volunteer");
            setSearchQuery("");
          }}
          type="button"
          aria-pressed={activeTab === "volunteer"}
        >
          <HeartHandshake size={18} />
          <span>Volunteer</span>
          <span className="connect-tab-badge">
            {filteredOpportunities.length}
          </span>
        </button>
      </nav>

      {/* Controls Bar: Search, Category Filters, Post & Management Buttons */}
      <div className="connect-controls">
        <div className="connect-search-row">
          <div className="connect-search-input-wrap">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="connect-search-input"
              placeholder={
                activeTab === "common"
                  ? "Search textbooks, lab kits, snacks, or sellers..."
                  : "Search sustainability projects, mentoring, or roles..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search listings"
            />
            {searchQuery && (
              <button
                className="connect-clear-search"
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Action Buttons: List an Item / Post Opportunity */}
          {activeTab === "common" ? (
            <button
              type="button"
              className="btn-create-post"
              onClick={() => setIsCreatingPost(true)}
            >
              <Plus size={16} />
              <span>List an Item</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-create-post"
              onClick={() => setIsCreatingVol(true)}
            >
              <Plus size={16} />
              <span>Post Opportunity</span>
            </button>
          )}

          {/* Manage Mode Toggle Button */}
          <button
            type="button"
            className={`btn-manage-toggle ${manageMode ? "active" : ""}`}
            onClick={() => setManageMode(!manageMode)}
            title="Toggle seller status and opportunity management"
          >
            <SlidersHorizontal size={15} />
            <span>
              {manageMode
                ? "Exit Management"
                : activeTab === "common"
                  ? "Seller Controls"
                  : "Organizer Controls"}
            </span>
          </button>
        </div>

        {/* Sub-Filters */}
        {activeTab === "common" ? (
          <div
            className="connect-filter-pills"
            role="toolbar"
            aria-label="Category filters"
          >
            {(
              [
                "All",
                "Textbooks",
                "Tech",
                "Supplies",
                "Snacks",
                "Competitions",
              ] as ConnectCategory[]
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`connect-pill ${commonCategory === cat ? "active" : ""}`}
                onClick={() => setCommonCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : (
          <div
            className="connect-filter-pills"
            role="toolbar"
            aria-label="Volunteer focus filters"
          >
            {(
              [
                "All",
                "Sustainability",
                "Greening",
                "Mentorship",
                "Events",
              ] as VolunteerFocus[]
            ).map((focus) => (
              <button
                key={focus}
                type="button"
                className={`connect-pill ${volunteerFocus === focus ? "active" : ""}`}
                onClick={() => setVolunteerFocus(focus)}
              >
                {focus}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Tab View: Common (Marketplace & Announcements) */}
      {activeTab === "common" && (
        <>
          {/* Management Mode Banner */}
          {manageMode && (
            <div className="manage-banner">
              <div>
                <strong>Seller Dashboard Active</strong> — Update status
                directly on your listings (Available, Low Stock, Reserved, Sold)
                or remove completed offers.
              </div>
              <small>{posts.length} active listings</small>
            </div>
          )}

          {/* Interest Polls Section */}
          {polls.length > 0 && !searchQuery && commonCategory === "All" && (
            <div className="poll-card">
              <div className="poll-header">
                <span className="poll-tag">
                  <Vote size={13} /> Campus Interest Poll
                </span>
                <small style={{ color: "var(--muted)" }}>
                  {polls[0].totalVotes} student responses
                </small>
              </div>
              <h2 className="poll-question">{polls[0].question}</h2>
              <div className="poll-options">
                {polls[0].options.map((opt) => {
                  const pct =
                    polls[0].totalVotes > 0
                      ? Math.round((opt.votes / polls[0].totalVotes) * 100)
                      : 0;
                  const isVoted = polls[0].userVotedOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`poll-option-row ${isVoted ? "voted" : ""}`}
                      onClick={() => handleVote(polls[0].id, opt.id)}
                      disabled={Boolean(polls[0].userVotedOptionId)}
                    >
                      <div
                        className="poll-bar"
                        style={{
                          width: `${pct}%`,
                          background: isVoted
                            ? "rgba(5, 140, 66, 0.32)"
                            : undefined,
                        }}
                      />
                      <span className="poll-option-text">
                        {opt.label} {isVoted && "✓ (Your vote)"}
                      </span>
                      <span className="poll-option-pct">{pct}%</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Posts Feed */}
          {filteredPosts.length === 0 ? (
            <div className="connect-empty">
              <ShoppingBag size={40} />
              <h3>No items found</h3>
              <p>
                Try selecting a different category or clearing your search
                query.
              </p>
            </div>
          ) : (
            <div className="connect-grid">
              {filteredPosts.map((post) => (
                <article key={post.id} className="connect-card">
                  <div className="connect-card-top">
                    <span className="connect-category-badge">
                      {post.category}
                    </span>
                    <span className={`connect-status-chip ${post.status}`}>
                      {post.status.replace("_", " ")}
                    </span>
                  </div>

                  <h3 className="connect-card-title">{post.title}</h3>
                  <p className="connect-card-desc">{post.description}</p>

                  <div className="connect-card-price-row">
                    {post.price !== undefined ? (
                      <span className="connect-card-price">
                        Rs. {post.price.toLocaleString()}
                      </span>
                    ) : (
                      <span className="connect-card-price">Free / Notice</span>
                    )}
                    {post.condition && (
                      <span className="connect-card-condition">
                        · {post.condition}
                      </span>
                    )}
                  </div>

                  <div className="connect-card-location">
                    <MapPin
                      size={14}
                      style={{ color: "#058c42", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {post.locationName}
                    </span>
                  </div>

                  {/* Seller Status Controls (visible in Manage Mode) */}
                  {manageMode && (
                    <div
                      style={{
                        paddingTop: 8,
                        borderTop: "1px dashed rgba(36, 78, 67, 0.2)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700 }}>
                        Status:
                      </span>
                      <div className="manage-status-group">
                        <button
                          type="button"
                          className={`status-btn ${post.status === "available" ? "active" : ""}`}
                          onClick={() => updatePostStatus(post.id, "available")}
                        >
                          Available
                        </button>
                        <button
                          type="button"
                          className={`status-btn low_stock ${post.status === "low_stock" ? "active" : ""}`}
                          onClick={() => updatePostStatus(post.id, "low_stock")}
                        >
                          Low Stock
                        </button>
                        <button
                          type="button"
                          className={`status-btn reserved ${post.status === "reserved" ? "active" : ""}`}
                          onClick={() => updatePostStatus(post.id, "reserved")}
                        >
                          Reserved
                        </button>
                        <button
                          type="button"
                          className={`status-btn sold ${post.status === "sold" ? "active" : ""}`}
                          onClick={() => updatePostStatus(post.id, "sold")}
                        >
                          Sold
                        </button>
                        <button
                          type="button"
                          className="btn-delete-post"
                          onClick={() => deletePost(post.id)}
                          title="Delete listing"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="connect-card-actions">
                    <button
                      type="button"
                      className="btn-navigate-to-location"
                      onClick={() =>
                        onNavigateToLocation(post.placeId, post.locationName)
                      }
                      title="Open turn-by-turn route to seller"
                    >
                      <Navigation size={14} />
                      <span>Navigate</span>
                    </button>
                    <button
                      type="button"
                      className="btn-view-details"
                      onClick={() => setSelectedPost(post)}
                    >
                      Details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Active Tab View: Volunteer (Opportunities & Greening) */}
      {activeTab === "volunteer" && (
        <>
          {/* Management Mode Banner */}
          {manageMode && (
            <div className="manage-banner">
              <div>
                <strong>Volunteer Coordinator Dashboard</strong> — Toggle
                recruitment open/closed and review incoming applications.
              </div>
              <small>{applications.length} total applicant(s)</small>
            </div>
          )}

          {filteredOpportunities.length === 0 ? (
            <div className="connect-empty">
              <HeartHandshake size={40} />
              <h3>No opportunities found</h3>
              <p>
                Try switching the focus filter or clearing your search term.
              </p>
            </div>
          ) : (
            <div className="connect-grid">
              {filteredOpportunities.map((opp) => (
                <article key={opp.id} className="connect-card">
                  <div className="connect-card-top">
                    <span className="connect-category-badge">
                      {opp.focusArea}
                    </span>
                    <span
                      className="connect-status-chip available"
                      style={{
                        background:
                          opp.status === "closed"
                            ? "rgba(119, 128, 119, 0.15)"
                            : "rgba(5, 140, 66, 0.12)",
                        color: opp.status === "closed" ? "#778077" : "#058c42",
                      }}
                    >
                      {opp.status === "closed"
                        ? "Closed"
                        : `${opp.spotsTotal - opp.spotsFilled} spots left`}
                    </span>
                  </div>

                  <h3 className="connect-card-title">{opp.title}</h3>
                  <small
                    style={{
                      color: "#058c42",
                      fontWeight: 600,
                      marginTop: -4,
                    }}
                  >
                    {opp.organization}
                  </small>
                  <p className="connect-card-desc">{opp.description}</p>

                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Clock size={13} /> {opp.hoursCredit} hrs credit
                    </span>
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Calendar size={13} /> {opp.eventDate.split("·")[0]}
                    </span>
                  </div>

                  <div className="connect-card-location">
                    <MapPin
                      size={14}
                      style={{ color: "#058c42", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {opp.locationName}
                    </span>
                  </div>

                  {/* Organizer Management Controls */}
                  {manageMode && (
                    <div
                      style={{
                        paddingTop: 8,
                        borderTop: "1px dashed rgba(36, 78, 67, 0.2)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700 }}>
                          Recruitment:
                        </span>
                        <button
                          type="button"
                          className={`status-btn ${opp.status === "open" ? "active" : "sold active"}`}
                          onClick={() => toggleVolStatus(opp.id)}
                        >
                          {opp.status === "open"
                            ? "Status: OPEN"
                            : "Status: CLOSED"}
                        </button>
                      </div>

                      {applications.filter((a) => a.opportunityId === opp.id)
                        .length > 0 && (
                        <div
                          style={{
                            background: "rgba(0,0,0,0.03)",
                            padding: 8,
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        >
                          <strong>
                            Applicants (
                            {
                              applications.filter(
                                (a) => a.opportunityId === opp.id,
                              ).length
                            }
                            ):
                          </strong>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              marginTop: 4,
                            }}
                          >
                            {applications
                              .filter((a) => a.opportunityId === opp.id)
                              .map((app) => (
                                <div
                                  key={app.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <span>
                                    {app.applicantName} ({app.applicantEmail})
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      color:
                                        app.status === "approved"
                                          ? "#058c42"
                                          : "#778077",
                                    }}
                                  >
                                    {app.status}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="connect-card-actions">
                    <button
                      type="button"
                      className="btn-navigate-to-location"
                      onClick={() =>
                        onNavigateToLocation(opp.placeId, opp.locationName)
                      }
                      title="Open turn-by-turn route to volunteer venue"
                    >
                      <Navigation size={14} />
                      <span>Directions</span>
                    </button>
                    <button
                      type="button"
                      className="btn-view-details"
                      onClick={() => setApplyingVol(opp)}
                      disabled={opp.status === "closed"}
                    >
                      {opp.status === "closed" ? "Closed" : "Apply / Join"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal: Create Marketplace Post */}
      {isCreatingPost && (
        <div
          className="connect-modal-backdrop"
          onClick={() => setIsCreatingPost(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="connect-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="connect-modal-close"
              type="button"
              onClick={() => setIsCreatingPost(false)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <span
              className="connect-category-badge"
              style={{ width: "fit-content" }}
            >
              Seller Dashboard · List an Item
            </span>
            <h2 style={{ margin: 0, fontSize: 20 }}>Create Campus Listing</h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--muted)",
                margin: "0 0 10px",
              }}
            >
              Offer course materials, lab kits, homemade snacks, or dorm
              supplies directly to fellow students with verified pickup.
            </p>

            <form
              onSubmit={handleCreatePost}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div className="form-group">
                <label htmlFor="post-title">Item Title *</label>
                <input
                  id="post-title"
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. Organic Chemistry 8th Edition with Solutions"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="post-category">Category *</label>
                  <select
                    id="post-category"
                    className="form-control"
                    value={newPostCategory}
                    onChange={(e) =>
                      setNewPostCategory(
                        e.target.value as CommunityPost["category"],
                      )
                    }
                  >
                    <option value="Textbooks">Textbooks</option>
                    <option value="Tech">Tech & Lab</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Snacks">Homemade Snacks / Bakery</option>
                    <option value="Competitions">Competitions</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="post-price">Price (LKR / Rs.) *</label>
                  <input
                    id="post-price"
                    type="number"
                    min="0"
                    step="50"
                    required
                    className="form-control"
                    placeholder="e.g. 1500"
                    value={newPostPrice}
                    onChange={(e) => setNewPostPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="post-condition">Condition</label>
                  <select
                    id="post-condition"
                    className="form-control"
                    value={newPostCondition}
                    onChange={(e) =>
                      setNewPostCondition(
                        e.target.value as CommunityPost["condition"],
                      )
                    }
                  >
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="post-pickup">Pickup Time Window</label>
                  <input
                    id="post-pickup"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Weekdays 12:00 – 14:00"
                    value={newPostPickupWindow}
                    onChange={(e) => setNewPostPickupWindow(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="post-location">
                  Verified Campus Pickup Location *
                </label>
                <select
                  id="post-location"
                  className="form-control"
                  value={newPostPlaceId}
                  onChange={(e) => setNewPostPlaceId(e.target.value)}
                >
                  {campusLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="post-seller">Seller Name *</label>
                  <input
                    id="post-seller"
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Amina K. (3rd Yr)"
                    value={newPostSellerName}
                    onChange={(e) => setNewPostSellerName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="post-contact">Contact Email or Phone *</label>
                  <input
                    id="post-contact"
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. amina@campus.uniway.edu"
                    value={newPostSellerContact}
                    onChange={(e) => setNewPostSellerContact(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="post-desc">Item Description</label>
                <textarea
                  id="post-desc"
                  rows={2}
                  className="form-control"
                  style={{ height: "auto", padding: "8px 12px" }}
                  placeholder="Describe condition, course relevance, notes included..."
                  value={newPostDescription}
                  onChange={(e) => setNewPostDescription(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button
                  type="submit"
                  className="btn-create-post"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <Check size={16} /> Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Post Volunteer Opportunity */}
      {isCreatingVol && (
        <div
          className="connect-modal-backdrop"
          onClick={() => setIsCreatingVol(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="connect-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="connect-modal-close"
              type="button"
              onClick={() => setIsCreatingVol(false)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <span
              className="connect-category-badge"
              style={{ width: "fit-content" }}
            >
              Organizer Dashboard · Post Opportunity
            </span>
            <h2 style={{ margin: 0, fontSize: 20 }}>
              Recruit Campus Volunteers
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--muted)",
                margin: "0 0 10px",
              }}
            >
              Connect student societies with enthusiastic volunteers for
              sustainability drives, litter audits, and academic events.
            </p>

            <form
              onSubmit={handleCreateVol}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div className="form-group">
                <label htmlFor="vol-title-input">Opportunity Title *</label>
                <input
                  id="vol-title-input"
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. Campus Biodiversity & Native Planting Drive"
                  value={newVolTitle}
                  onChange={(e) => setNewVolTitle(e.target.value)}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="vol-org-input">Hosting Student Club *</label>
                  <input
                    id="vol-org-input"
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Green Campus Society"
                    value={newVolOrg}
                    onChange={(e) => setNewVolOrg(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="vol-focus-input">Focus Area *</label>
                  <select
                    id="vol-focus-input"
                    className="form-control"
                    value={newVolFocus}
                    onChange={(e) =>
                      setNewVolFocus(e.target.value as VolunteerFocus)
                    }
                  >
                    <option value="Sustainability">Sustainability</option>
                    <option value="Greening">Campus Greening</option>
                    <option value="Mentorship">Mentorship</option>
                    <option value="Events">Faculty Events</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="vol-hours-input">Hours Credit (hrs) *</label>
                  <input
                    id="vol-hours-input"
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    className="form-control"
                    placeholder="e.g. 3.0"
                    value={newVolHours}
                    onChange={(e) => setNewVolHours(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="vol-spots-input">Volunteer Spots *</label>
                  <input
                    id="vol-spots-input"
                    type="number"
                    min="1"
                    required
                    className="form-control"
                    placeholder="e.g. 10"
                    value={newVolSpots}
                    onChange={(e) => setNewVolSpots(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="vol-date-input">Event Date & Time *</label>
                  <input
                    id="vol-date-input"
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Saturday, Nov 15 · 09:00 – 12:00"
                    value={newVolDate}
                    onChange={(e) => setNewVolDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="vol-loc-input">Campus Venue *</label>
                  <select
                    id="vol-loc-input"
                    className="form-control"
                    value={newVolPlaceId}
                    onChange={(e) => setNewVolPlaceId(e.target.value)}
                  >
                    {campusLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="vol-reqs-input">
                  Key Requirements (comma-separated)
                </label>
                <input
                  id="vol-reqs-input"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Wear sturdy footwear, Bring water bottle, No experience needed"
                  value={newVolReqs}
                  onChange={(e) => setNewVolReqs(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="vol-desc-input">Detailed Description</label>
                <textarea
                  id="vol-desc-input"
                  rows={2}
                  className="form-control"
                  style={{ height: "auto", padding: "8px 12px" }}
                  placeholder="Explain event agenda, safety briefing, tools provided..."
                  value={newVolDesc}
                  onChange={(e) => setNewVolDesc(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button
                  type="submit"
                  className="btn-create-post"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <Check size={16} /> Publish Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Details Modal */}
      {selectedPost && (
        <div
          className="connect-modal-backdrop"
          onClick={() => setSelectedPost(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="connect-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="connect-modal-close"
              type="button"
              onClick={() => setSelectedPost(null)}
              aria-label="Close details"
            >
              <X size={18} />
            </button>

            <span
              className="connect-category-badge"
              style={{ width: "fit-content" }}
            >
              {selectedPost.category} ·{" "}
              {selectedPost.badge || "Student Listing"}
            </span>

            <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.3 }}>
              {selectedPost.title}
            </h2>

            {selectedPost.price !== undefined && (
              <div style={{ fontSize: 22, fontWeight: 800, color: "#058c42" }}>
                Rs. {selectedPost.price.toLocaleString()}
                {selectedPost.condition && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--muted)",
                      marginLeft: 8,
                    }}
                  >
                    ({selectedPost.condition})
                  </span>
                )}
              </div>
            )}

            <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              {selectedPost.description}
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 14,
                borderRadius: 10,
                background: "rgba(36, 78, 67, 0.05)",
                fontSize: 13,
              }}
            >
              <div>
                <strong>Seller:</strong> {selectedPost.sellerName}
              </div>
              {selectedPost.sellerContact && (
                <div>
                  <strong>Contact:</strong>{" "}
                  <a
                    href={`mailto:${selectedPost.sellerContact}`}
                    style={{ color: "#058c42", textDecoration: "underline" }}
                  >
                    {selectedPost.sellerContact}
                  </a>
                </div>
              )}
              {selectedPost.pickupWindow && (
                <div>
                  <strong>Pickup window:</strong> {selectedPost.pickupWindow}
                </div>
              )}
              <div>
                <strong>Location:</strong> {selectedPost.locationName}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn-navigate-to-location"
                style={{ height: 44 }}
                onClick={() => {
                  const pid = selectedPost.placeId;
                  const loc = selectedPost.locationName;
                  setSelectedPost(null);
                  onNavigateToLocation(pid, loc);
                }}
              >
                <Navigation size={16} />
                <span>Navigate to Seller Location</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Volunteer Application Modal */}
      {applyingVol && (
        <div
          className="connect-modal-backdrop"
          onClick={() => !applicationSubmitted && setApplyingVol(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="connect-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="connect-modal-close"
              type="button"
              onClick={() => setApplyingVol(null)}
              aria-label="Close modal"
              disabled={applicationSubmitted}
            >
              <X size={18} />
            </button>

            {applicationSubmitted ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <CheckCircle2 size={48} style={{ color: "#058c42" }} />
                <h3 style={{ margin: 0, fontSize: 20 }}>Interest Expressed!</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                  Thank you! The coordinator from {applyingVol.organization} has
                  been notified.
                </p>
              </div>
            ) : (
              <>
                <span
                  className="connect-category-badge"
                  style={{ width: "fit-content" }}
                >
                  Volunteer Application · {applyingVol.focusArea}
                </span>

                <h2 style={{ margin: 0, fontSize: 19 }}>{applyingVol.title}</h2>
                <div
                  style={{ fontSize: 13, color: "#058c42", fontWeight: 600 }}
                >
                  {applyingVol.organization}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  <span>
                    <strong>Credit:</strong> {applyingVol.hoursCredit} Hours
                  </span>
                  <span>
                    <strong>Date:</strong> {applyingVol.eventDate}
                  </span>
                </div>

                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <strong>Key Requirements:</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {applyingVol.requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>

                <form
                  onSubmit={handleApplySubmit}
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div>
                    <label
                      htmlFor="vol-name"
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Full Name *
                    </label>
                    <input
                      id="vol-name"
                      type="text"
                      required
                      placeholder="e.g. Kasun Perera"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      style={{
                        width: "100%",
                        height: 40,
                        borderRadius: 8,
                        border: "1px solid rgba(36, 78, 67, 0.2)",
                        padding: "0 12px",
                        fontSize: 14,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="vol-email"
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Campus Email *
                    </label>
                    <input
                      id="vol-email"
                      type="email"
                      required
                      placeholder="your.name@campus.uniway.edu"
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      style={{
                        width: "100%",
                        height: 40,
                        borderRadius: 8,
                        border: "1px solid rgba(36, 78, 67, 0.2)",
                        padding: "0 12px",
                        fontSize: 14,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="vol-note"
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Brief Note / Availability
                    </label>
                    <textarea
                      id="vol-note"
                      rows={2}
                      placeholder="e.g. Available Saturday morning, have joined previous green drives."
                      value={applicantStatement}
                      onChange={(e) => setApplicantStatement(e.target.value)}
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        border: "1px solid rgba(36, 78, 67, 0.2)",
                        padding: "8px 12px",
                        fontSize: 13,
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button
                      type="submit"
                      className="btn-navigate-to-location"
                      style={{ height: 44 }}
                    >
                      <Check size={16} /> Submit Application
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
