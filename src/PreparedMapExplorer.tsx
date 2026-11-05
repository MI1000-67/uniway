import { useEffect, useRef, useState } from "react";
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Footprints,
  MapPin,
  Menu,
  PanelLeftClose,
  Pencil,
  Route as RouteIcon,
  Search,
  Timer,
  X,
} from "lucide-react";
import type { PreparedMap } from "./preparedMap";
import { usePreparedRoutes } from "./usePreparedRoutes";
import { categories } from "./campus";
import type { Category } from "./campus";
import { CategoryIcon } from "./icons";
import ImageMapCanvas from "./ImageMapCanvas";
import { RouteChoices } from "./RouteChoices";
import { searchMatchingPlaces } from "./search";

export default function PreparedMapExplorer({
  map,
  onDemo,
  onEdit,
  sessionTime,
}: {
  map: PreparedMap;
  onDemo: () => void;
  onEdit: () => void;
  sessionTime?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [routeMode, setRouteMode] = useState(false);
  const [routeVersion, setRouteVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [selected, setSelected] = useState("");
  const [start, setStart] = useState(
    map.places.find((p) => p.entrance)?.nodeId ?? map.places[0]?.nodeId ?? "",
  );
  const [requested, setRequested] = useState(false);
  const [stepFree, setStepFree] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const destination = map.places.find((p) => p.nodeId === selected);
  const matches = searchMatchingPlaces(
    map.places.filter((p) => category === "All" || p.category === category),
    query,
  );
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const {
    routes: alternatives,
    pending,
    error: routeError,
  } = usePreparedRoutes(
    map,
    start,
    selected,
    stepFree,
    !!(map.published && requested && selected),
  );
  useEffect(() => setActiveRouteIndex(0), [map, start, selected, stepFree]);
  const route = alternatives[activeRouteIndex] ?? alternatives[0] ?? null;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  useEffect(
    () => setCurrentStepIndex(0),
    [map, start, selected, stepFree, activeRouteIndex, requested],
  );
  const activeStepRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (typeof activeStepRef.current?.scrollIntoView === "function") {
      activeStepRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentStepIndex]);

  function select(id: string) {
    setSelected(id);
    setRequested(false);
    setExpanded(true);
    setCollapsed(false);
  }

  function beginRoute() {
    if (!selected) return;
    setRouteMode(true);
    setRequested(true);
    setRouteVersion((v) => v + 1);
    setExpanded(false);
  }

  function resetExplore() {
    setRouteMode(false);
    setRequested(false);
    setSelected("");
    setQuery("");
    setCategory("All");
  }

  const entrances = map.places.filter((p) => p.entrance);
  const nonEntrances = map.places.filter((p) => !p.entrance);

  return (
    <div
      className={`prepared-workspace ${collapsed ? "sidebar-collapsed" : ""} ${expanded ? "prepared-expanded" : ""}`}
    >
      <aside className="prepared-sidebar" aria-label="Uploaded campus explorer">
        <button
          className="prepared-sheet-handle"
          aria-label={
            expanded
              ? "Collapse uploaded map panel"
              : "Expand uploaded map panel"
          }
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        <div className="sidebar-tabs">
          <button className={!routeMode ? "active" : ""} onClick={resetExplore}>
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
        <div className="prepared-scroll">
          {!routeMode && (
            <>
              <div className="prepared-heading">
                <div>
                  <p className="eyebrow">YOUR INTERACTIVE CAMPUS</p>
                  <h1>{map.name}</h1>
                </div>
                <button
                  className="icon-button"
                  aria-label="Edit this map"
                  onClick={onEdit}
                >
                  <Pencil size={18} />
                </button>
              </div>
              {!map.published && (
                <div className="draft-notice">
                  <strong>Explore your map preview</strong>
                  <p>
                    {map.places.length
                      ? "Places are ready to explore. Review the suggested paths before using directions."
                      : "Your image is ready to explore. Add or detect places to enable search and directions."}
                  </p>
                  <button className="text-button" onClick={onEdit}>
                    <Pencil size={15} /> Review places & paths
                  </button>
                </div>
              )}
              {!destination ? (
                <>
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      aria-label="Search uploaded map"
                      placeholder="Where do you want to go?"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setSelected("");
                        setRequested(false);
                        setExpanded(true);
                      }}
                    />
                  </div>
                  <div
                    className="category-list"
                    aria-label="Filter uploaded places"
                  >
                    <button
                      className={category === "All" ? "selected" : ""}
                      aria-pressed={category === "All"}
                      onClick={() => setCategory("All")}
                    >
                      All places
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
                    <span>PLACES ON YOUR MAP</span>
                    <span>{matches.length} places</span>
                  </div>
                  <div className="place-list">
                    {matches.map((p) => (
                      <button
                        className="place-row"
                        key={p.id}
                        aria-label={`Select ${p.name}`}
                        onClick={() => select(p.nodeId)}
                      >
                        <span className="place-icon" data-category={p.category}>
                          <CategoryIcon category={p.category} size={22} />
                        </span>
                        <span className="place-row-text">
                          <strong dir="auto">{p.name}</strong>
                          <small>
                            {p.entrance
                              ? "Campus entrance"
                              : p.aliases?.length
                                ? `${p.category} · ${p.aliases.slice(0, 2).join(", ")}`
                                : p.category}
                          </small>
                        </span>
                        <ArrowRight size={17} />
                      </button>
                    ))}
                  </div>
                  {!matches.length && (
                    <div className="empty-state">
                      <Search size={25} />
                      <h3>No places found</h3>
                      <p>Try another name or category.</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          setQuery("");
                          setCategory("All");
                        }}
                      >
                        Show all places
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="place-details" style={{ padding: "8px 0" }}>
                  <button
                    className="back-button"
                    onClick={() => {
                      setSelected("");
                      setRequested(false);
                    }}
                  >
                    <ArrowLeft size={16} /> Back to explore
                  </button>
                  <div className="prepared-destination">
                    <span
                      className="place-icon"
                      data-category={destination.category}
                    >
                      <CategoryIcon category={destination.category} size={24} />
                    </span>
                    <div>
                      <p className="eyebrow">{destination.category}</p>
                      <h2 dir="auto">{destination.name}</h2>
                      {destination.aliases?.length ? (
                        <p
                          className="small-copy"
                          style={{ marginTop: "0.25rem", opacity: 0.85 }}
                        >
                          Also includes: {destination.aliases.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <label className="map-field">
                    Starting point
                    <select
                      aria-label="Uploaded map starting point"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    >
                      {map.places.map((p) => (
                        <option key={p.id} value={p.nodeId}>
                          {p.name}
                          {p.entrance ? " · Entrance" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {destination.approachEstimated && (
                    <p className="small-copy">
                      Directions end at the marked approach point. Check the
                      building entrance on arrival.
                    </p>
                  )}
                  <label className="stepfree-option">
                    <span>
                      <Accessibility size={18} />
                      <span>
                        Step-free paths only
                        <small>
                          Use paths marked step-free during preparation.
                        </small>
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
                    disabled={!map.published}
                    onClick={beginRoute}
                  >
                    <Compass size={18} /> Show walking route{" "}
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </>
          )}

          {routeMode && (
            <div
              className={`directions-panel ${requested && route ? "has-route" : ""}`}
              style={{ paddingTop: "12px" }}
            >
              <p className="eyebrow">ONE STEP AT A TIME</p>
              <h2>{destination ? destination.name : "Let’s get you there."}</h2>
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
                      {entrances.length > 0 && (
                        <optgroup label="Campus entrances">
                          {entrances.map((e) => (
                            <option key={e.id} value={e.nodeId}>
                              {e.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Campus places">
                        {(entrances.length > 0 ? nonEntrances : map.places).map(
                          (p) => (
                            <option key={p.id} value={p.nodeId}>
                              {p.name}
                            </option>
                          ),
                        )}
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
                      value={selected}
                      onChange={(e) => {
                        setSelected(e.target.value);
                        setRequested(true);
                      }}
                    >
                      <option value="" disabled>
                        Choose your destination
                      </option>
                      {map.places.map((p) => (
                        <option key={p.id} value={p.nodeId}>
                          {p.name}
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
                    Step-free paths only
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
                disabled={!selected || !map.published}
                onClick={beginRoute}
              >
                <RouteIcon size={18} />
                {requested ? "Fit route on map" : "Show walking route"}
                <ArrowRight size={18} />
              </button>
              {destination?.approachEstimated && (
                <p className="small-copy" style={{ marginTop: "12px" }}>
                  Directions end at the marked approach point. Check the
                  building entrance on arrival.
                </p>
              )}
              {route && (
                <div className="route-result">
                  <div className="route-summary">
                    <span className="walk-icon">
                      <Footprints size={26} />
                    </span>
                    <div>
                      <strong>
                        {route.minutes === null
                          ? "Your route is ready"
                          : route.minutes === 0
                            ? "You’re here"
                            : `${route.minutes} min walk`}
                      </strong>
                      <span>
                        {route.meters === null
                          ? "Distance not calibrated"
                          : `${route.meters} m · `}
                        {stepFree ? "Step-free path" : "Walking route"}
                      </span>
                    </div>
                    <Check size={20} />
                  </div>
                  <p className="route-estimate">
                    Green is shortest. Amber and terracotta show alternatives;
                    line patterns distinguish them too. Set a known scale to see
                    metres and walking times.
                  </p>
                  <div className="section-heading">
                    <span>YOUR WALK, STEP BY STEP</span>
                  </div>
                  <RouteChoices
                    items={alternatives}
                    activeIndex={activeRouteIndex}
                    onSelect={setActiveRouteIndex}
                  />
                  <ol className="route-instructions">
                    {route.instructions.map((instruction, i) => (
                      <li
                        key={i}
                        ref={i === currentStepIndex ? activeStepRef : null}
                        className={i === currentStepIndex ? "active-step" : ""}
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
                            <ArrowRight size={14} />
                          )}
                        </span>
                        <p>{instruction}</p>
                      </li>
                    ))}
                  </ol>
                  <button
                    className="secondary-button full-width"
                    onClick={() => {
                      setRequested(false);
                      setRouteMode(false);
                    }}
                  >
                    <X size={16} /> End directions
                  </button>
                </div>
              )}
              {pending && (
                <p role="status" className="small-copy">
                  Finding your route choices…
                </p>
              )}
              {routeError && (
                <p role="alert" className="error-message">
                  {routeError}
                </p>
              )}
              {requested && !route && !pending && !routeError && (
                <p className="error-message" role="alert">
                  No connected {stepFree ? "step-free " : ""}path was marked
                  between these places.{" "}
                  {stepFree ? "Turn off step-free routing or " : ""}Edit the map
                  to connect the path network.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="prepared-footer">
          {sessionTime && (
            <div className="prepared-timer">
              <Timer size={16} />
              Visitor session <strong>{sessionTime}</strong>
            </div>
          )}
          <button className="text-button" onClick={onDemo}>
            <ArrowLeft size={15} /> Willowbrook demo
          </button>
          <small>Prepared in this tab · No live GPS</small>
        </div>
      </aside>
      <section
        className="prepared-map-region"
        aria-label="Uploaded interactive campus map"
      >
        <ImageMapCanvas
          map={map}
          selected={selected}
          route={route?.points}
          routes={alternatives.map((item) => item.points)}
          activeRouteIndex={activeRouteIndex}
          routeVersion={routeVersion}
          sidebarCollapsed={collapsed}
          onNode={select}
          currentStepIndex={currentStepIndex}
        />
        {collapsed && (
          <button
            className="reopen-sidebar"
            onClick={() => setCollapsed(false)}
          >
            <Menu size={18} /> Explore map
          </button>
        )}
        <div className="prepared-map-badge">
          <Check size={14} />{" "}
          {map.published
            ? "Your prepared map"
            : "Interactive preview · Review needed"}
        </div>
        {route && destination && (
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
                ? route.minutes !== null
                  ? `${route.minutes} min`
                  : route.meters !== null
                    ? `${route.meters} m`
                    : "Walking route"
                : `Step ${currentStepIndex + 1}/${route.instructions.length}`}
            </strong>
            <span>
              {currentStepIndex === 0
                ? `${route.meters !== null && route.minutes !== null ? ` · ${route.meters} m` : ""} to ${destination.name}`
                : ` · ${route.instructions[currentStepIndex]}`}
            </span>
            <button
              aria-label={
                currentStepIndex === route.instructions.length - 1
                  ? "Arrived at destination"
                  : "Next step"
              }
              className="icon-button"
              onClick={() => {
                setCollapsed(false);
                setExpanded(true);
                setRouteMode(true);
                setCurrentStepIndex((prev) =>
                  Math.min(route.instructions.length - 1, prev + 1),
                );
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
    </div>
  );
}
