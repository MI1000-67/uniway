import { resolveDemoLocation } from "./locations";
import { appViewUrl, readAppView } from "./appUrl";
import type { LocationReference } from "./locations";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Footprints,
  GraduationCap,
  HelpCircle,
  Leaf,
  Map,
  MapPin,
  Menu,
  Moon,
  Navigation,
  PanelLeftClose,
  QrCode,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  Upload,
  X,
  Accessibility,
} from "lucide-react";
import CampusMap from "./CampusMap";
import Modal from "./Modal";
import QRPanel from "./QRPanel";
import UploadPanel from "./UploadPanel";
import type { UploadedImage } from "./UploadPanel";
import { categories, entrances, places, searchPlaces } from "./campus";
import type { Category, Place } from "./campus";
import { CategoryIcon } from "./icons";
import { describeRoute } from "./routing";
import { findRouteAlternatives } from "./routeAlternatives";
import { RouteChoices } from "./RouteChoices";
import { formatTime } from "./session";
import { useVisitorSession } from "./useVisitorSession";
import { useTheme } from "./useTheme";
import MapEditor from "./MapEditor";
import PreparedMapExplorer from "./PreparedMapExplorer";
import VisitorTour from "./VisitorTour";
import { newMap } from "./preparedMap";
import type { PreparedMap } from "./preparedMap";
import ConnectView from "./connect/ConnectView";

type Dialog = "upload" | "qr" | "about" | null;
function Brand() {
  return (
    <span className="brand">
      <svg viewBox="0 0 40 42" aria-hidden="true">
        <path
          d="M8 10v15a12 12 0 0024 0V8m-7 7 7-7 7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="8" r="4" fill="#d58c64" />
      </svg>
      <span>
        uniway<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { session, remaining, expired, activate, warning } =
    useVisitorSession();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [selected, setSelected] = useState<Place | null>(null);
  const [start, setStart] = useState(session?.entranceId ?? "south-gate");
  const [routeMode, setRouteMode] = useState(false);
  const [routeRequested, setRouteRequested] = useState(false);
  const [stepFree, setStepFree] = useState(false);
  const [routeVersion, setRouteVersion] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [preparedMaps, setPreparedMaps] = useState<Record<string, PreparedMap>>(
    {},
  );
  const [publishedMaps, setPublishedMaps] = useState<
    Record<string, PreparedMap>
  >({});
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [mapRevision, setMapRevision] = useState(0);
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const activeMap = activeMapId ? publishedMaps[activeMapId] : null;
  const editingMap = editingMapId ? preparedMaps[editingMapId] : null;
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const [toast, setToast] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  const [view, setView] = useState<"navigate" | "connect">(() => {
    return typeof window !== "undefined"
      ? readAppView(window.location)
      : "navigate";
  });

  const switchView = useCallback((newView: "navigate" | "connect") => {
    setView(newView);
    if (typeof window !== "undefined" && window.history) {
      window.history.pushState(null, "", appViewUrl(newView));
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setView(readAppView(window.location));
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onPopState);
    };
  }, []);

  // 3-hour disappearance timer for uploaded maps (privacy, storage hygiene, and local lifecycle)
  useEffect(() => {
    const checkMapExpirations = () => {
      const now = Date.now();
      setImages((currentImages) => {
        const expiredImages = currentImages.filter(
          (img) => img.expiresAt && now >= img.expiresAt,
        );
        if (!expiredImages.length) return currentImages;

        expiredImages.forEach((img) => URL.revokeObjectURL(img.url));
        const expiredIds = new Set(expiredImages.map((img) => img.id));

        setPreparedMaps((maps) => {
          const next = { ...maps };
          expiredIds.forEach((id) => delete next[id]);
          return next;
        });

        setPublishedMaps((maps) => {
          const next = { ...maps };
          expiredIds.forEach((id) => delete next[id]);
          return next;
        });

        setActiveMapId((currentActive) =>
          currentActive && expiredIds.has(currentActive) ? null : currentActive,
        );

        setEditingMapId((currentEditing) =>
          currentEditing && expiredIds.has(currentEditing)
            ? null
            : currentEditing,
        );

        setToast(
          "Uploaded map expired after 3 hours for privacy and storage hygiene.",
        );

        return currentImages.filter((img) => !expiredIds.has(img.id));
      });
    };

    const interval = setInterval(checkMapExpirations, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectNavigate = useCallback(
    (location?: LocationReference, locationName?: string) => {
      const destination = resolveDemoLocation(location);
      switchView("navigate");
      setActiveMapId(null);
      setSelected(destination);
      setRouteMode(!!destination);
      setRouteRequested(!!destination && !expired);
      setActiveRouteIndex(0);
      setCurrentStepIndex(0);
      setQuery("");
      setCategory("All");
      setCollapsed(false);
      setExpanded(true);
      setRouteVersion((version) => version + 1);
      setToast(
        expired
          ? "Scan an entrance code to start a fresh visitor session."
          : destination
            ? `Routing to ${destination.shortName} on the demo campus. Check the listing for pickup details.`
            : `No verified route is available for ${locationName || "this location"}. Choose a mapped destination.`,
      );
    },
    [switchView, expired],
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(
    () => searchPlaces(query, category),
    [query, category],
  );
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const alternatives = useMemo(
    () =>
      !expired && routeRequested && selected
        ? findRouteAlternatives(start, selected.nodeId, stepFree).map((item) =>
            describeRoute(item.points),
          )
        : [],
    [start, selected, stepFree, routeRequested, expired],
  );
  useEffect(
    () => setActiveRouteIndex(0),
    [start, selected, stepFree, routeRequested],
  );
  const route = alternatives[activeRouteIndex] ?? alternatives[0] ?? null;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  useEffect(() => {
    setCurrentStepIndex(0);
  }, [start, selected, stepFree, activeRouteIndex, routeRequested]);
  const activeStepRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (typeof activeStepRef.current?.scrollIntoView === "function") {
      activeStepRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentStepIndex]);
  useEffect(
    () => () => {
      imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    },
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (expired) {
      setSelected(null);
      setRouteRequested(false);
      setRouteMode(false);
      setQuery("");
      setCategory("All");
      setDialog(null);
      setActiveMapId(null);
      setEditingMapId(null);
    }
  }, [expired]);
  const selectPlace = useCallback(
    (place: Place) => {
      setSelected(place);
      setCollapsed(false);
      setExpanded(true);
      if (!routeMode) setRouteRequested(false);
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [routeMode],
  );
  function resetExplore() {
    setRouteMode(false);
    setRouteRequested(false);
    setSelected(null);
    setQuery("");
    setCategory("All");
  }
  function beginRoute() {
    if (!selected) return;
    setRouteMode(true);
    setRouteRequested(true);
    setRouteVersion((v) => v + 1);
    setExpanded(false);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }
  function scanEntrance(id: string) {
    activate(id);
    setStart(id);
    setRouteRequested(false);
    setSelected(null);
    setRouteMode(false);
    setDialog(null);
    setToast("You’re in. Your campus visitor session is ready.");
    setCollapsed(false);
    setActiveMapId(null);
  }
  function prepareImage(image: UploadedImage) {
    setPreparedMaps((maps) => ({
      ...maps,
      [image.id]: maps[image.id] ?? newMap(image),
    }));
    setEditingMapId(image.id);
    setDialog("upload");
  }
  function openPreparedMap(map: PreparedMap) {
    if (expired) {
      setDialog("qr");
      return;
    }
    setPublishedMaps((maps) => ({ ...maps, [map.image.id]: map }));
    setMapRevision((revision) => revision + 1);
    setActiveMapId(map.image.id);
    setEditingMapId(null);
    setDialog(null);
  }
  const searchInput = (mobile = false) => (
    <div className={`search-box ${mobile ? "mobile-search" : ""}`}>
      <Search size={19} />
      <input
        type="search"
        placeholder="Where do you want to go?"
        aria-label={
          mobile ? "Search campus on mobile" : "Search campus destinations"
        }
        value={query}
        onFocus={() => {
          if (mobile) {
            setExpanded(true);
            setSelected(null);
            setRouteMode(false);
            setRouteRequested(false);
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setRouteMode(false);
          setRouteRequested(false);
        }}
      />
      {query && (
        <button
          className="clear-search"
          aria-label="Clear search"
          onClick={() => setQuery("")}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand-link"
          href="#"
          aria-label="Uniway home"
          onClick={(e) => {
            e.preventDefault();
            switchView("navigate");
            if (!expired) resetExplore();
          }}
        >
          <Brand />
        </a>
        <div className="header-campus">
          <span className="campus-icon">
            <GraduationCap size={21} />
          </span>
          <div>
            <strong>
              {view === "connect"
                ? "UniWay Connect"
                : (activeMap?.name ?? "Willowbrook University")}
            </strong>
            <span>
              {view === "connect"
                ? "Find your way. Find your community."
                : "Find your way. Feel at home."}
            </span>
          </div>
          <span className="header-campus-divider" />
          <span className="header-demo">
            {view === "connect"
              ? "Community Hub"
              : activeMap
                ? activeMap.published
                  ? "Your prepared map"
                  : "Map preview"
                : "Interactive demo"}
          </span>
        </div>
        <div
          className="header-nav-switcher"
          role="navigation"
          aria-label="Main module switcher"
        >
          <button
            type="button"
            className={`header-nav-btn ${view === "navigate" ? "active" : ""}`}
            onClick={() => switchView("navigate")}
            aria-pressed={view === "navigate"}
          >
            <Map size={16} />
            <span>Navigate</span>
          </button>
          <button
            type="button"
            className={`header-nav-btn ${view === "connect" ? "active" : ""}`}
            onClick={() => switchView("connect")}
            aria-pressed={view === "connect"}
          >
            <Sparkles size={16} />
            <span>UniWay Connect</span>
          </button>
        </div>
        <div className="header-actions">
          <button
            className="theme-toggle"
            type="button"
            aria-label={
              theme === "day" ? "Switch to night mode" : "Switch to day mode"
            }
            title={
              theme === "day" ? "Switch to night mode" : "Switch to day mode"
            }
            onClick={toggleTheme}
          >
            {theme === "day" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === "day" ? "Night mode" : "Day mode"}</span>
          </button>
          <button
            className="header-upload"
            aria-label="Upload a map"
            onClick={() => {
              setEditingMapId(null);
              setDialog("upload");
            }}
          >
            <Upload size={17} />
            <span>Upload a map</span>
            {images.length > 0 && <b>{images.length}</b>}
          </button>
          <button
            className="header-scan"
            aria-label="Scan QR"
            onClick={() => setDialog("qr")}
          >
            <QrCode size={18} />
            <span>Scan QR</span>
          </button>
          <button
            className="header-tour-btn"
            type="button"
            aria-label="Start guided tour"
            title="Interactive campus tour"
            onClick={() => setTourOpen(true)}
          >
            <Sparkles size={16} />
            <span>Tour</span>
          </button>
          <button
            className="help-button icon-button"
            aria-label="About Uniway"
            onClick={() => setDialog("about")}
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </header>
      {view === "connect" ? (
        <main className="connect-page-main">
          <ConnectView
            onNavigateToLocation={handleConnectNavigate}
            onSwitchToNavigate={() => switchView("navigate")}
          />
        </main>
      ) : (
        <main
          className={`workspace ${!activeMap && collapsed ? "sidebar-collapsed" : ""} ${activeMap ? "has-prepared-map" : ""} ${expired ? "session-expired" : ""}`}
        >
          {expired ? (
            <section className="expired-screen">
              <span className="expired-icon">
                <Timer size={38} />
              </span>
              <p className="eyebrow">UNTIL YOUR NEXT VISIT</p>
              <h1>Time for a fresh start.</h1>
              <p>
                Your 3-hour visitor session has ended.
                <br />
                Scan an entrance code to find your way again.
              </p>
              <button
                className="primary-button"
                onClick={() => setDialog("qr")}
              >
                <QrCode size={18} /> Scan to return
              </button>
              <small>
                The university’s map is still here. Only your visitor session
                has ended.
              </small>
            </section>
          ) : activeMap ? (
            <PreparedMapExplorer
              key={`${activeMap.image.id}-${mapRevision}`}
              map={activeMap}
              onDemo={() => {
                setActiveMapId(null);
                resetExplore();
              }}
              onEdit={() => prepareImage(activeMap.image)}
              sessionTime={session ? formatTime(remaining) : undefined}
            />
          ) : (
            <>
              <aside
                className={`sidebar ${expanded ? "sheet-expanded" : ""}`}
                aria-label="Campus explorer"
              >
                <button
                  className="sheet-handle"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  aria-label={
                    expanded
                      ? "Collapse destination panel"
                      : "Expand destination panel"
                  }
                >
                  <span />
                  {expanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronUp size={16} />
                  )}
                </button>
                <div className="sidebar-tabs">
                  <button
                    className={!routeMode ? "active" : ""}
                    onClick={resetExplore}
                  >
                    <Compass size={17} /> Explore
                  </button>
                  <button
                    className={routeMode ? "active" : ""}
                    onClick={() => {
                      setRouteMode(true);
                      setExpanded(true);
                    }}
                  >
                    <RouteIcon size={17} /> Directions
                  </button>
                  <button
                    className="collapse-sidebar icon-button"
                    aria-label="Collapse sidebar"
                    onClick={() => setCollapsed(true)}
                  >
                    <PanelLeftClose size={17} />
                  </button>
                </div>
                <div className="sidebar-content" ref={contentRef}>
                  {!routeMode && !selected && (
                    <>
                      <div className="explore-intro">
                        <p className="eyebrow">
                          <span /> YOUR CAMPUS, A LITTLE CLOSER
                        </p>
                        <h1>
                          New here?
                          <br />
                          You’re in the right place.
                        </h1>
                        <p>
                          Big campus. Small steps.
                          <br />
                          Let’s find where you need to be.
                        </p>
                        <button
                          type="button"
                          className="explore-tour-cta"
                          onClick={() => setTourOpen(true)}
                        >
                          <Sparkles size={14} />
                          <span>Take interactive tour</span>
                        </button>
                      </div>
                      <div className="desktop-search">{searchInput()}</div>
                      <div className="category-list" aria-label="Filter places">
                        <button
                          className={category === "All" ? "selected" : ""}
                          aria-pressed={category === "All"}
                          onClick={() => setCategory("All")}
                        >
                          <MapPin size={14} /> All places
                        </button>
                        {categories.map((c) => (
                          <button
                            key={c}
                            data-category={c}
                            className={category === c ? "selected" : ""}
                            aria-pressed={category === c}
                            onClick={() => setCategory(c)}
                          >
                            <CategoryIcon category={c} size={14} />
                            {c}
                          </button>
                        ))}
                      </div>
                      <div className="section-heading">
                        <span>
                          {query
                            ? "SEARCH RESULTS"
                            : category === "All"
                              ? "A FEW PLACES TO START"
                              : `${category.toUpperCase()} ON CAMPUS`}
                        </span>
                        <span>{matches.length} places</span>
                      </div>
                      <div className="place-list">
                        {matches.map((p, i) => (
                          <button
                            key={p.id}
                            className={`place-row ${p.id === "library" && !query ? "featured-place" : ""}`}
                            onClick={() => selectPlace(p)}
                            style={{ animationDelay: `${i * 25}ms` }}
                          >
                            <span
                              className={`place-icon ${p.color}`}
                              data-category={p.category}
                            >
                              <CategoryIcon category={p.category} size={22} />
                            </span>
                            <span className="place-row-text">
                              <strong>{p.shortName}</strong>
                              <small>
                                {p.category === "Library"
                                  ? "Study spaces & resources"
                                  : p.category === "Food"
                                    ? "Coffee, food & good company"
                                    : p.category === "Teaching"
                                      ? "Lecture halls & learning"
                                      : p.category === "Services"
                                        ? "A little help along the way"
                                        : p.category === "Toilets"
                                          ? "Accessible campus facilities"
                                          : "Your arrival, made easy"}
                              </small>
                            </span>
                            <ChevronRight size={18} />
                          </button>
                        ))}
                      </div>
                      {!matches.length && (
                        <div className="empty-state">
                          <Search size={28} />
                          <h3>No places found</h3>
                          <p>Try “library”, “coffee”, or another category.</p>
                          <button
                            className="text-button"
                            onClick={() => {
                              setQuery("");
                              setCategory("All");
                            }}
                          >
                            Show all places <ArrowRight size={15} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {selected && !routeMode && (
                    <div className="place-details">
                      <button
                        className="back-button"
                        onClick={() => setSelected(null)}
                      >
                        <ArrowLeft size={16} /> Back to explore
                      </button>
                      <div className={`place-art ${selected.color}`}>
                        <div className="art-orbit orbit-one" />
                        <div className="art-orbit orbit-two" />
                        <div className="art-building">
                          <CategoryIcon
                            category={selected.category}
                            size={48}
                          />
                        </div>
                        <span className="art-leaf">
                          <Leaf size={32} />
                        </span>
                        <span className="art-tag">{selected.tag}</span>
                      </div>
                      <p className="eyebrow">
                        {selected.category.toUpperCase()} · MAIN CAMPUS
                      </p>
                      <h2>{selected.name}</h2>
                      <p className="place-description">
                        {selected.description}
                      </p>
                      <div className="detail-facts">
                        <span>
                          <MapPin size={16} /> Willowbrook University
                        </span>
                        <span>
                          <Accessibility size={16} /> Step-free route available
                        </span>
                      </div>
                      <button
                        className="primary-button full-width"
                        onClick={beginRoute}
                      >
                        <Navigation size={18} /> Get directions{" "}
                        <ArrowRight size={18} />
                      </button>
                      <div className="detail-note">
                        <Leaf size={18} />
                        <p>
                          Take the scenic route to feeling at home.
                          <br />
                          We’ll guide you one step at a time.
                        </p>
                      </div>
                      <div className="section-heading">
                        <span>GOOD TO KNOW</span>
                      </div>
                      <p className="small-copy">
                        This is a fictional campus. Places and routes are here
                        to help you explore the Uniway experience.
                      </p>
                    </div>
                  )}
                  {routeMode && (
                    <div
                      className={`directions-panel ${routeRequested ? "has-route" : ""}`}
                    >
                      <p className="eyebrow">ONE STEP AT A TIME</p>
                      <h2>
                        {routeRequested && selected
                          ? selected.shortName
                          : "Let’s get you there."}
                      </h2>
                      <p className="panel-description">
                        A clear path to your next stop.
                      </p>
                      <div className="route-fields">
                        <div className="route-field">
                          <span className="origin-dot" />
                          <label>
                            Starting point
                            <select
                              aria-label="Starting point"
                              value={start}
                              onChange={(e) => setStart(e.target.value)}
                            >
                              <optgroup label="Campus entrances">
                                {entrances.map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {e.name}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Campus places">
                                {places.map((p) => (
                                  <option key={p.id} value={p.nodeId}>
                                    {p.shortName}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </label>
                        </div>
                        <div className="field-connector" />
                        <div className="route-field">
                          <MapPin size={17} />
                          <label>
                            Destination
                            <select
                              aria-label="Destination"
                              value={selected?.id ?? ""}
                              onChange={(e) => {
                                const p = places.find(
                                  (p) => p.id === e.target.value,
                                );
                                setSelected(p ?? null);
                              }}
                            >
                              <option value="" disabled>
                                Choose your destination
                              </option>
                              {places.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.shortName}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                      <label className="stepfree-option">
                        <span>
                          <Accessibility size={18} />
                          <span>
                            Step-free route
                            <small>Avoid stairs along the way</small>
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={stepFree}
                          onChange={(e) => setStepFree(e.target.checked)}
                        />
                        <span className="switch" aria-hidden="true" />
                      </label>
                      <button
                        className="primary-button full-width"
                        disabled={!selected}
                        onClick={beginRoute}
                      >
                        <RouteIcon size={18} />
                        {routeRequested ? "Fit route on map" : "Find my route"}
                        <ArrowRight size={18} />
                      </button>
                      {route && (
                        <div className="route-result">
                          <div className="route-summary">
                            <span className="walk-icon">
                              <Footprints size={26} />
                            </span>
                            <div>
                              <strong>
                                {route.minutes === 0
                                  ? "You’re here"
                                  : `${route.minutes} min walk`}
                              </strong>
                              <span>
                                {route.meters} m <i />{" "}
                                {stepFree ? "Step-free path" : "Walking route"}
                              </span>
                            </div>
                            <Check size={20} />
                          </div>
                          <p className="route-estimate">
                            Estimated using the illustrated demo campus.
                          </p>
                          <div className="section-heading">
                            <span>YOUR WALK, STEP BY STEP</span>
                          </div>
                          <RouteChoices
                            items={alternatives}
                            activeIndex={activeRouteIndex}
                            onSelect={setActiveRouteIndex}
                            context="demo"
                          />
                          <ol className="route-instructions">
                            {route.instructions.map((instruction, i) => (
                              <li
                                key={`${i}-${instruction}`}
                                ref={
                                  i === currentStepIndex ? activeStepRef : null
                                }
                                className={
                                  i === currentStepIndex ? "active-step" : ""
                                }
                                role="button"
                                tabIndex={0}
                                onClick={() => setCurrentStepIndex(i)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setCurrentStepIndex(i);
                                  }
                                }}
                              >
                                <span
                                  className={
                                    i === currentStepIndex
                                      ? "active-step-icon"
                                      : i === route.instructions.length - 1
                                        ? "arrival-step"
                                        : ""
                                  }
                                >
                                  {i === 0 ? (
                                    <MapPin size={14} />
                                  ) : i === route.instructions.length - 1 ? (
                                    <Check size={14} />
                                  ) : (
                                    <ArrowUpRight size={14} />
                                  )}
                                </span>
                                <p>{instruction}</p>
                              </li>
                            ))}
                          </ol>
                          <button
                            className="secondary-button full-width"
                            onClick={() => {
                              setRouteRequested(false);
                              setRouteMode(false);
                            }}
                          >
                            <X size={16} /> End directions
                          </button>
                        </div>
                      )}
                      {routeRequested && !route && (
                        <p className="error-message" role="alert">
                          There’s no connected {stepFree ? "step-free " : ""}
                          path between these places. Choose another starting
                          point
                          {stepFree ? " or turn off step-free routing" : ""}.
                        </p>
                      )}
                      {!selected && (
                        <div className="route-placeholder">
                          <Map size={35} strokeWidth={1.2} />
                          <p>
                            Choose a destination.
                            <br />
                            We’ll take it from there.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="sidebar-footer">
                  {session ? (
                    <div
                      className={`session-card ${remaining < 300000 ? "session-warning" : ""}`}
                    >
                      <span className="session-icon">
                        <Timer size={20} />
                      </span>
                      <div>
                        <strong>Make yourself at home</strong>
                        <span>
                          Visitor session <b>{formatTime(remaining)}</b>
                        </span>
                      </div>
                      <ShieldCheck size={17} />
                    </div>
                  ) : (
                    <button
                      className="qr-invitation"
                      onClick={() => setDialog("qr")}
                    >
                      <QrCode size={24} />
                      <span>
                        <strong>A new campus? You’re in.</strong>
                        <small>Scan a QR code to find your way.</small>
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  )}
                  <div className="local-note">
                    <span>
                      <i />
                      {session
                        ? "Temporary access · Browser demo"
                        : "Your map stays on this device"}
                    </span>
                    <button
                      aria-label="About privacy and demo limitations"
                      onClick={() => setDialog("about")}
                    >
                      <HelpCircle size={15} />
                    </button>
                  </div>
                </div>
              </aside>
              <section className="map-region" aria-label="Campus map">
                <CampusMap
                  selected={selected}
                  onSelect={selectPlace}
                  route={route}
                  routes={alternatives.map((item) => item.points)}
                  activeRouteIndex={activeRouteIndex}
                  startNode={start}
                  routeVersion={routeVersion}
                  sidebarCollapsed={collapsed}
                  currentStepIndex={currentStepIndex}
                />
                {collapsed && (
                  <button
                    className="reopen-sidebar"
                    onClick={() => setCollapsed(false)}
                  >
                    <Menu size={18} /> Explore campus
                  </button>
                )}
                <div className="mobile-top-search">{searchInput(true)}</div>
                {!selected && !route && (
                  <div className="welcome-map-card">
                    <span className="welcome-map-icon">
                      <Navigation size={20} />
                    </span>
                    <div>
                      <strong>Your next chapter starts here.</strong>
                      <span>Pick a place. We’ll show you the way.</span>
                    </div>
                    <span className="welcome-sparkle">
                      <Sparkles size={19} />
                    </span>
                  </div>
                )}
                {route && (
                  <div className="floating-route">
                    {currentStepIndex > 0 && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Previous step"
                        onClick={() =>
                          setCurrentStepIndex((prev) => Math.max(0, prev - 1))
                        }
                      >
                        <ArrowLeft size={16} />
                      </button>
                    )}
                    <Footprints size={21} />
                    <strong>
                      {currentStepIndex === 0
                        ? `${route.minutes} min`
                        : `Step ${currentStepIndex + 1}/${route.instructions.length}`}
                    </strong>
                    <span>
                      {currentStepIndex === 0
                        ? ` · ${route.meters} m to ${selected?.shortName}`
                        : ` · ${route.instructions[currentStepIndex]}`}
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={
                        currentStepIndex === route.instructions.length - 1
                          ? "Arrived at destination"
                          : "Next step"
                      }
                      onClick={() => {
                        setCollapsed(false);
                        setExpanded(true);
                        setRouteMode(true);
                        if (
                          currentStepIndex ===
                          route.instructions.length - 1
                        ) {
                          setToast("You have reached your destination.");
                        } else {
                          setCurrentStepIndex((prev) =>
                            Math.min(route.instructions.length - 1, prev + 1),
                          );
                        }
                      }}
                    >
                      {currentStepIndex === route.instructions.length - 1 ? (
                        <Check size={18} />
                      ) : (
                        <ArrowRight size={18} />
                      )}
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      )}
      {warning && (
        <div className="storage-warning" role="status">
          {warning}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {dialog === "upload" && (
        <Modal
          title={editingMap ? "Prepare your campus." : "Bring your map."}
          eyebrow="A FAMILIAR PLACE, A NEW PERSPECTIVE"
          onClose={() => setDialog(null)}
          wide
          className={editingMap ? "modal-editor" : ""}
        >
          {editingMap ? (
            <MapEditor
              key={editingMap.image.id}
              map={editingMap}
              onBack={() => setEditingMapId(null)}
              onPreview={openPreparedMap}
              onChange={(map) =>
                setPreparedMaps((maps) => ({ ...maps, [map.image.id]: map }))
              }
              onPublish={(map) => {
                setPreparedMaps((maps) => ({ ...maps, [map.image.id]: map }));
                setPublishedMaps((maps) => ({ ...maps, [map.image.id]: map }));
                setMapRevision((revision) => revision + 1);
                if (expired) {
                  setToast(
                    "Map prepared. Start a fresh visitor session to navigate.",
                  );
                } else {
                  setActiveMapId(map.image.id);
                  setToast(
                    "Your interactive map is ready. Choose a place to begin.",
                  );
                }
                setDialog(null);
                setEditingMapId(null);
              }}
            />
          ) : (
            <UploadPanel
              images={images}
              onAdd={(newImages) => setImages((old) => [...old, ...newImages])}
              preparedMaps={preparedMaps}
              onPrepare={prepareImage}
              onAnalyzed={(map) => {
                setPreparedMaps((maps) => ({ ...maps, [map.image.id]: map }));
                setEditingMapId(map.image.id);
              }}
              onPreview={(image) =>
                openPreparedMap(preparedMaps[image.id] ?? newMap(image))
              }
              onOpen={(id) => {
                if (expired) {
                  setDialog("qr");
                  return;
                }
                setActiveMapId(id);
                setDialog(null);
              }}
              onRemove={(id) => {
                const target = images.find((i) => i.id === id);
                if (target) URL.revokeObjectURL(target.url);
                setImages((old) => old.filter((i) => i.id !== id));
                setPreparedMaps((maps) => {
                  const next = { ...maps };
                  delete next[id];
                  return next;
                });
                setPublishedMaps((maps) => {
                  const next = { ...maps };
                  delete next[id];
                  return next;
                });
                if (activeMapId === id) setActiveMapId(null);
              }}
            />
          )}
        </Modal>
      )}
      {dialog === "qr" && (
        <Modal
          title="One scan. You’re here."
          eyebrow="WELCOME TO YOUR NEXT CHAPTER"
          onClose={() => setDialog(null)}
        >
          <QRPanel onActivate={scanEntrance} />
        </Modal>
      )}
      {dialog === "about" && (
        <Modal
          title="A little less lost."
          eyebrow="MEET UNIWAY"
          onClose={() => setDialog(null)}
        >
          <div className="about-panel">
            <p>
              University is full of firsts. Finding your next class shouldn’t be
              the hard one.
            </p>
            <div className="about-feature">
              <Compass size={22} />
              <div>
                <strong>A campus you can explore</strong>
                <p>
                  Search places, choose your starting point, and follow walking
                  directions. Willowbrook is a fictional university created for
                  this prototype.
                </p>
              </div>
            </div>
            <div className="about-feature">
              <ShieldCheck size={22} />
              <div>
                <strong>Your visit, your device</strong>
                <p>
                  Uploads stay in browser memory. QR visitor sessions expire
                  after 3 hours in this tab. This browser-only timer
                  demonstrates the experience; secure access requires a backend.
                </p>
              </div>
            </div>
            <div className="about-feature">
              <Leaf size={22} />
              <div>
                <strong>Light on your device</strong>
                <p>
                  Navigation uses a prepared path network. No AI model,
                  continuous location tracking, or background camera runs while
                  you explore.
                </p>
              </div>
            </div>
            <div className="about-feature">
              <Upload size={22} />
              <div>
                <strong>Turn your layout into a map</strong>
                <p>
                  Upload a layout and let Uniway read labels and suggest visible
                  paths on your device. Review the names, entrances and
                  connections before navigation. Faint or complex maps may need
                  manual refinement.
                </p>
              </div>
            </div>
            <p className="about-signoff">
              Find your way. Feel at home. <span>uniway.</span>
            </p>
          </div>
        </Modal>
      )}
      <VisitorTour
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        onSelectPlace={(placeId) => {
          const p = places.find((pl) => pl.id === placeId);
          if (p) selectPlace(p);
        }}
        onStartRoute={(placeId) => {
          const p = places.find((pl) => pl.id === placeId);
          if (p) {
            selectPlace(p);
            setRouteMode(true);
            setRouteRequested(true);
          }
        }}
        onToggleStepFree={(val) => setStepFree(val)}
        onSwitchView={(newView) => switchView(newView)}
      />
    </div>
  );
}
