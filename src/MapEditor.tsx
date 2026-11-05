import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Hand,
  MapPin,
  Route,
  Ruler,
  Trash2,
  Undo2,
} from "lucide-react";
import { categories } from "./campus";
import type { Category, Point } from "./campus";
import {
  addConnection,
  moveMapNode,
  removeMapNode,
  reviewMap,
} from "./preparedMap";
import type { PreparedMap } from "./preparedMap";
import ImageMapCanvas from "./ImageMapCanvas";

type Tool = "place" | "path" | "scale" | "pan" | "move";
export default function MapEditor({
  map,
  onChange,
  onPublish,
  onBack,
  onPreview,
}: {
  map: PreparedMap;
  onChange: (map: PreparedMap) => void;
  onPublish: (map: PreparedMap) => void;
  onBack: () => void;
  onPreview?: (map: PreparedMap) => void;
}) {
  const [tool, setTool] = useState<Tool>(map.analysis ? "pan" : "place");
  const [active, setActive] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [pathAccessible, setPathAccessible] = useState(false);
  const [scalePoints, setScalePoints] = useState<Point[]>([]);
  const [knownDistance, setKnownDistance] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [history, setHistory] = useState<PreparedMap[]>([]);
  const [notice, setNotice] = useState("");
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [showRegions, setShowRegions] = useState(false);
  const current = map.places.find((p) => p.nodeId === active);
  const issues = reviewMap(map);
  function change(next: PreparedMap) {
    setHistory((h) => [...h.slice(-39), map]);
    setReviewed(false);
    onChange({ ...next, published: false });
  }
  function chooseTool(next: Tool) {
    setTool(next);
    setAnchor(null);
    setScalePoints([]);
    setNotice("");
    setPendingLabel(null);
  }
  function point(p: Point) {
    if (tool === "scale") {
      setScalePoints((points) => (points.length === 2 ? [p] : [...points, p]));
      return;
    }
    if (tool === "pan") return;
    if (tool === "move") {
      if (active) change(moveMapNode(map, active, p));
      setTool("pan");
      setNotice(
        "Pin moved. Check its connected paths again before navigation.",
      );
      return;
    }
    const id = crypto.randomUUID();
    const isPlace = tool === "place";
    const candidate = map.unresolvedLabels?.find((l) => l.id === pendingLabel);
    const name = isPlace
      ? (candidate?.text ?? `Place ${map.places.length + 1}`)
      : `Path point ${map.nodes.length + 1}`;
    change({
      ...map,
      unresolvedLabels: candidate
        ? map.unresolvedLabels?.filter((l) => l.id !== candidate.id)
        : map.unresolvedLabels,
      nodes: [...map.nodes, { ...p, id, landmark: name }],
      places: isPlace
        ? [
            ...map.places,
            { id, nodeId: id, name, category: "Services", entrance: false },
          ]
        : map.places,
      edges:
        tool === "path" && anchor
          ? addConnection(map.edges, anchor, id, pathAccessible)
          : map.edges,
    });
    setActive(id);
    setPendingLabel(null);
    if (tool === "path") setAnchor(id);
  }
  function node(id: string) {
    if (tool === "scale") {
      const p = map.nodes.find((n) => n.id === id);
      if (p) point(p);
      return;
    }
    if (tool === "path") {
      if (anchor && anchor !== id)
        change({
          ...map,
          edges: addConnection(map.edges, anchor, id, pathAccessible),
        });
      setAnchor(id);
    }
    setActive(id);
  }
  function rename(name: string) {
    onChange({
      ...map,
      published: false,
      places: map.places.map((p) => (p.nodeId === active ? { ...p, name } : p)),
      nodes: map.nodes.map((n) =>
        n.id === active ? { ...n, landmark: name } : n,
      ),
    });
    setReviewed(false);
  }
  const namesValid =
    map.places.every((p) => p.name.trim()) &&
    new Set(map.places.map((p) => p.name.trim().toLowerCase())).size ===
      map.places.length;
  const scaleLength =
    scalePoints.length === 2
      ? Math.hypot(
          scalePoints[0].x - scalePoints[1].x,
          scalePoints[0].y - scalePoints[1].y,
        )
      : 0;
  return (
    <div className="map-editor">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} /> Your uploads
      </button>
      <div className="editor-intro">
        <div>
          <h3>Make this map interactive.</h3>
          <p>
            {map.analysis
              ? "Your local analysis is ready. Check the places and suggested paths below."
              : "Add places, connect the walking paths, then review your map."}
          </p>
        </div>
        <span className="preparation-badge">
          {map.analysis ? "Local analysis" : "Guided preparation"}
        </span>
      </div>
      {map.analysis && (
        <section className="analysis-report" aria-label="Map analysis result">
          <div>
            <strong>{map.analysis.summary}</strong>
            <span>Review needed</span>
          </div>
          {map.analysis.quality.message && (
            <p className="quality-note">{map.analysis.quality.message}</p>
          )}
          <details>
            <summary>What to check</summary>
            <ul>
              {map.analysis.warnings.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </details>
          {!!map.analysis.candidateRegions?.length && (
            <label className="map-check">
              <input
                type="checkbox"
                checked={showRegions}
                onChange={(e) => setShowRegions(e.target.checked)}
              />
              Show detected outlines for review
            </label>
          )}
        </section>
      )}
      {onPreview && (
        <button
          className="secondary-button editor-preview"
          onClick={() => onPreview(map)}
        >
          Open map preview <ArrowRight size={16} />
        </button>
      )}
      <div className="editor-toolbar" aria-label="Map preparation tools">
        {(
          [
            { id: "place", label: "Add places", icon: MapPin },
            { id: "path", label: "Draw paths", icon: Route },
            { id: "scale", label: "Set scale", icon: Ruler },
            { id: "pan", label: "Move map", icon: Hand },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={tool === t.id ? "active" : ""}
            aria-pressed={tool === t.id}
            onClick={() => chooseTool(t.id)}
          >
            <t.icon size={17} />
            {t.label}
          </button>
        ))}
        <button
          aria-label="Undo map change"
          disabled={!history.length}
          onClick={() => {
            const last = history.at(-1);
            if (last) {
              onChange(last);
              setHistory((h) => h.slice(0, -1));
              setAnchor(null);
              setActive(null);
              setReviewed(false);
            }
          }}
        >
          <Undo2 size={17} /> Undo
        </button>
      </div>
      <div className="editor-layout">
        <div className="editor-canvas-wrap">
          <ImageMapCanvas
            map={map}
            editing
            tool={tool}
            activeNode={tool === "path" ? anchor : active}
            showCandidateRegions={showRegions}
            scalePoints={tool === "scale" ? scalePoints : undefined}
            onPoint={point}
            onNode={node}
            onNorthOffsetChange={(degrees) =>
              change({ ...map, northOffset: degrees })
            }
          />
          <div className="editor-hint" role="status">
            {tool === "place" &&
              !pendingLabel &&
              "Click a building entrance to add a place. Give it a name in the panel."}
            {tool === "place" &&
              pendingLabel &&
              `Choose the entrance for ${map.unresolvedLabels?.find((l) => l.id === pendingLabel)?.text}.`}
            {tool === "move" &&
              "Choose the corrected pin location. Connected paths will need review again."}
            {tool === "path" &&
              (anchor
                ? "Click along the walkway. Click an existing numbered point to connect it."
                : "Click an existing place or junction to start a path.")}
            {tool === "scale" &&
              `${scalePoints.length} of 2 scale points selected. Pick the ends of a known distance.`}
            {tool === "pan" &&
              "Drag to explore. Select a numbered point to edit or remove it."}
          </div>
        </div>
        <div className="editor-inspector">
          <label className="map-field">
            Campus name
            <input
              maxLength={70}
              value={map.name}
              onChange={(e) => {
                onChange({ ...map, name: e.target.value, published: false });
                setReviewed(false);
              }}
            />
          </label>
          {!!map.unresolvedLabels?.length && (
            <details className="editor-tool-options" open>
              <summary>Labels to place ({map.unresolvedLabels.length})</summary>
              <p className="small-copy">
                These names were read, but their positions are unclear. Select a
                name, then choose its entrance on the map.
              </p>
              <div className="editor-point-list">
                {map.unresolvedLabels.map((label) => (
                  <button
                    key={label.id}
                    className={pendingLabel === label.id ? "active" : ""}
                    aria-label={`Place label ${label.text}`}
                    aria-pressed={pendingLabel === label.id}
                    onClick={() => {
                      chooseTool("place");
                      setPendingLabel(label.id);
                    }}
                  >
                    <MapPin size={16} />
                    {label.text}
                  </button>
                ))}
              </div>
            </details>
          )}
          {tool === "path" && (
            <div className="editor-tool-options">
              <label className="map-check">
                <input
                  type="checkbox"
                  checked={pathAccessible}
                  onChange={(e) => setPathAccessible(e.target.checked)}
                />
                <span>
                  These path segments are step-free
                  <small>Enable only for paths you have verified.</small>
                </span>
              </label>
              <button
                className="secondary-button full-width"
                disabled={!anchor}
                onClick={() => setAnchor(null)}
              >
                <Check size={16} /> Finish this path
              </button>
              <p className="small-copy">
                Join paths at the same numbered point. Crossing lines alone do
                not create a junction.
              </p>
            </div>
          )}
          {tool === "scale" && (
            <div className="editor-tool-options">
              <label className="map-field">
                Distance between selected points (m)
                <input
                  type="number"
                  min=".1"
                  step="any"
                  value={knownDistance}
                  onChange={(e) => setKnownDistance(e.target.value)}
                  placeholder="e.g. 50"
                />
              </label>
              <button
                className="secondary-button full-width"
                disabled={
                  scaleLength < 1 ||
                  !Number.isFinite(Number(knownDistance)) ||
                  Number(knownDistance) <= 0
                }
                onClick={() => {
                  change({
                    ...map,
                    metersPerPixel: Number(knownDistance) / scaleLength,
                  });
                  setNotice(
                    "Scale saved. Walking estimates will use this distance.",
                  );
                }}
              >
                {scalePoints.length < 2
                  ? "Select two points on the map first"
                  : "Apply scale"}
              </button>
              {map.metersPerPixel !== null && (
                <button
                  className="text-button"
                  onClick={() => change({ ...map, metersPerPixel: null })}
                >
                  Remove scale
                </button>
              )}
              <p className="small-copy">
                Optional. Without a scale, routes display without distance or
                time estimates.
              </p>
              {notice && (
                <p role="status" className="small-copy">
                  {notice}
                </p>
              )}
            </div>
          )}
          {current && tool !== "scale" && (
            <div className="editor-place-fields">
              <p className="eyebrow">SELECTED PLACE</p>
              {current.approachEstimated && (
                <p className="small-copy">
                  This pin marks a suggested approach on visible linework. Check
                  the building entrance and adjust its connecting paths before
                  navigation.
                </p>
              )}
              <label className="map-field">
                Place name
                <input
                  maxLength={55}
                  value={current.name}
                  onChange={(e) => rename(e.target.value)}
                />
              </label>
              <label className="map-field">
                Category
                <select
                  value={current.category}
                  onChange={(e) =>
                    change({
                      ...map,
                      places: map.places.map((p) =>
                        p.id === current.id
                          ? { ...p, category: e.target.value as Category }
                          : p,
                      ),
                    })
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="map-field">
                Other names (comma separated)
                <input
                  key={current.id}
                  maxLength={200}
                  defaultValue={current.aliases?.join(", ") ?? ""}
                  onBlur={(e) =>
                    change({
                      ...map,
                      places: map.places.map((p) =>
                        p.id === current.id
                          ? {
                              ...p,
                              aliases: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }
                          : p,
                      ),
                    })
                  }
                />
              </label>
              <label className="map-check">
                <input
                  type="checkbox"
                  checked={current.entrance}
                  onChange={(e) =>
                    change({
                      ...map,
                      places: map.places.map((p) =>
                        p.id === current.id
                          ? { ...p, entrance: e.target.checked }
                          : p,
                      ),
                    })
                  }
                />
                Campus entrance
              </label>
            </div>
          )}
          {active && tool !== "scale" && (
            <button
              className="secondary-button full-width"
              onClick={() => chooseTool("move")}
            >
              <MapPin size={16} /> Move selected pin
            </button>
          )}
          {active &&
            map.edges.some((e) => e.from === active || e.to === active) && (
              <details className="editor-tool-options">
                <summary>Connected paths</summary>
                <div className="editor-point-list">
                  {map.edges
                    .filter((e) => e.from === active || e.to === active)
                    .map((edge) => {
                      const other = map.nodes.find(
                        (n) =>
                          n.id === (edge.from === active ? edge.to : edge.from),
                      );
                      return (
                        <button
                          key={`${edge.from}:${edge.to}`}
                          aria-label={`Remove path to ${other?.landmark ?? "point"}`}
                          onClick={() =>
                            change({
                              ...map,
                              edges: map.edges.filter((e) => e !== edge),
                            })
                          }
                        >
                          <Trash2 size={15} /> Remove path to{" "}
                          {other?.landmark ?? "point"}
                        </button>
                      );
                    })}
                </div>
              </details>
            )}
          {active && tool !== "scale" && (
            <button
              className="text-button remove-point"
              onClick={() => {
                change(removeMapNode(map, active));
                setActive(null);
                setAnchor(null);
              }}
            >
              <Trash2 size={15} /> Remove point & connected paths
            </button>
          )}
          <div className="section-heading">
            <span>MAP POINTS</span>
            <span>
              {map.places.length} places · {map.edges.length} paths
            </span>
          </div>
          <div className="editor-point-list">
            {map.nodes
              .filter(
                (n) =>
                  tool === "path" || map.places.some((p) => p.nodeId === n.id),
              )
              .map((n, i) => (
                <button
                  key={n.id}
                  className={active === n.id ? "active" : ""}
                  onClick={() => node(n.id)}
                >
                  <span>
                    {map.places.find((p) => p.nodeId === n.id)?.labelNumber ??
                      i + 1}
                  </span>
                  {n.landmark}
                </button>
              ))}
          </div>
          {!map.nodes.length && (
            <p className="small-copy">
              Your places and path junctions will appear here.
            </p>
          )}
        </div>
      </div>
      <div className="editor-review">
        <div>
          <h4>Ready to navigate?</h4>
          {!!issues.length && (
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {!namesValid && (
            <p className="error-message">
              Give every place a unique, non-empty name.
            </p>
          )}
          {!issues.length && namesValid && (
            <p className="review-success">
              <Check size={16} /> Every place is connected to a walking path.
            </p>
          )}
          <label className="map-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            <span>
              I’ve checked that the marked places and paths match this map.
            </span>
          </label>
        </div>
        <button
          className="primary-button"
          disabled={!!issues.length || !namesValid || !reviewed}
          onClick={() =>
            onPublish({
              ...map,
              name: map.name.trim(),
              places: map.places.map((p) => ({ ...p, name: p.name.trim() })),
              published: true,
            })
          }
        >
          Open interactive map <ArrowRight size={17} />
        </button>
      </div>
      <p className="editor-footnote">
        Your image and map stay in this open tab. Suggested paths need a visual
        check for entrances, crossings and pedestrian access before navigation.
      </p>
    </div>
  );
}
