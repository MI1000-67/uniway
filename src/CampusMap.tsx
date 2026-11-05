import { memo, useRef, useState, useEffect, useCallback } from "react";
import {
  Plus,
  Minus,
  LocateFixed,
  Maximize,
  Footprints,
  Layers,
} from "lucide-react";
import { places, edges, nodeById, entrances } from "./campus";
import type { Place, Point, PathNode } from "./campus";
import type { Route } from "./routing";
import { fitMapView, mapInsets, zoomView } from "./mapView";
import type { View } from "./mapView";
import MapCompass from "./MapCompass";
import RouteOverlay from "./RouteOverlay";
import { unrotate } from "./rotation";
import StreetLamps from "./StreetLamps";
const initial: View = { x: 40, y: 12, w: 1110, h: 870 };
function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const trees = Array.from({ length: 330 }, (_, i) => ({
  x: 105 + ((i * 173.17) % 1020),
  y: 60 + ((i * 137.91) % 735),
  r: 7 + (i % 5) * 1.4,
}))
  .filter(
    (p) =>
      !places.some(
        (b) =>
          p.x > b.x - 30 &&
          p.x < b.x + b.w + 30 &&
          p.y > b.y - 30 &&
          p.y < b.y + b.h + 30,
      ),
  )
  .filter(
    (p) =>
      !edges.some(
        (e) =>
          segmentDistance(p, nodeById.get(e.from)!, nodeById.get(e.to)!) < 30,
      ),
  )
  .filter(
    (p) =>
      !(p.x > 765 && p.y > 640) &&
      !(p.x > 320 && p.x < 535 && p.y > 665) &&
      !(Math.hypot(p.x - 620, p.y - 420) < 85),
  );

function CampusMap({
  selected,
  onSelect,
  route,
  routes,
  activeRouteIndex = 0,
  startNode,
  routeVersion,
  sidebarCollapsed = false,
  currentStepIndex = 0,
}: {
  selected: Place | null;
  onSelect: (p: Place) => void;
  route: Route | null;
  routes?: PathNode[][];
  activeRouteIndex?: number;
  startNode: string;
  routeVersion: number;
  sidebarCollapsed?: boolean;
  currentStepIndex?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rotation, setRotation] = useState(0);
  const [view, setView] = useState<View>(initial);
  const [dragging, setDragging] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const drag = useRef<{ x: number; y: number; view: View } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const animation = useRef<number | undefined>(undefined);
  const animateTo = useCallback((target: View) => {
    if (animation.current !== undefined)
      window.cancelAnimationFrame(animation.current);
    if (
      !window.requestAnimationFrame ||
      (import.meta as any).env?.MODE === "test" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setView(target);
      return;
    }
    const from = viewRef.current,
      began = performance.now();
    const frame = (time: number) => {
      const progress = Math.min(1, (time - began) / 220),
        ease = 1 - Math.pow(1 - progress, 3);
      setView({
        x: from.x + (target.x - from.x) * ease,
        y: from.y + (target.y - from.y) * ease,
        w: from.w + (target.w - from.w) * ease,
        h: from.h + (target.h - from.h) * ease,
      });
      if (progress < 1) animation.current = window.requestAnimationFrame(frame);
    };
    animation.current = window.requestAnimationFrame(frame);
  }, []);
  useEffect(
    () => () => {
      if (animation.current !== undefined)
        window.cancelAnimationFrame(animation.current);
    },
    [],
  );
  const zoom = useCallback(
    (factor: number) => {
      animateTo(zoomView(viewRef.current, factor));
    },
    [animateTo],
  );
  const fitCampus = useCallback(() => {
    setRotation(0);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) {
      animateTo(initial);
      return;
    }
    animateTo(fitMapView(initial, rect, mapInsets(svgRef.current)));
  }, [animateTo]);
  useEffect(() => fitCampus(), [fitCampus]);
  const fitRoute = useCallback(() => {
    if (!route?.points.length) return;
    setRotation(0);
    const xs = route.points.map((p) => p.x),
      ys = route.points.map((p) => p.y);
    if (selected) {
      xs.push(selected.x - 12, selected.x + selected.w + 12);
      ys.push(selected.y - 48, selected.y + selected.h + 12);
    }
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const rect = svgRef.current?.getBoundingClientRect();
    const width = rect?.width || 1000,
      height = rect?.height || 800;
    animateTo(
      fitMapView(
        {
          x: minX - 20,
          y: minY - 20,
          w: Math.max(180, maxX - minX + 40),
          h: Math.max(180, maxY - minY + 40),
        },
        { width, height },
        mapInsets(svgRef.current),
      ),
    );
  }, [route, selected, animateTo]);
  useEffect(() => {
    if (routeVersion) fitRoute();
  }, [routeVersion, fitRoute]);
  useEffect(() => {
    if (route) fitRoute();
    else fitCampus();
  }, [sidebarCollapsed]);
  useEffect(() => {
    const resize = () => (route ? fitRoute() : fitCampus());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [route, fitRoute, fitCampus]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.1 : 0.9);
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [zoom]);
  const activeStepPoint =
    route && route.points.length > 0
      ? route.points[Math.min(currentStepIndex, route.points.length - 1)]
      : null;
  useEffect(() => {
    if (!route || currentStepIndex === undefined || currentStepIndex === 0)
      return;
    const pt =
      route.points[Math.min(currentStepIndex, route.points.length - 1)];
    if (!pt) return;
    const cur = viewRef.current;
    const pad = 60;
    const inView =
      pt.x >= cur.x + pad &&
      pt.x <= cur.x + cur.w - pad &&
      pt.y >= cur.y + pad &&
      pt.y <= cur.y + cur.h - pad;
    if (!inView) {
      animateTo({
        x: pt.x - cur.w / 2,
        y: pt.y - cur.h / 2,
        w: cur.w,
        h: cur.h,
      });
    }
  }, [currentStepIndex, route, animateTo]);
  const start = nodeById.get(startNode);
  return (
    <div className={`map-surface ${dragging ? "dragging" : ""}`}>
      <div className="map-topline">
        <span className="map-breadcrumb">
          Willowbrook University <span>/</span> Main campus
        </span>
        <span className="demo-badge">
          <i /> DEMO CAMPUS
        </span>
      </div>
      <svg
        ref={svgRef}
        className="campus-svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="group"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            zoom(0.8);
          }
          if (event.key === "-") {
            event.preventDefault();
            zoom(1.25);
          }
          if (event.key.startsWith("Arrow")) {
            event.preventDefault();
            const delta = unrotate(
              event.key === "ArrowRight"
                ? 40
                : event.key === "ArrowLeft"
                  ? -40
                  : 0,
              event.key === "ArrowDown"
                ? 40
                : event.key === "ArrowUp"
                  ? -40
                  : 0,
              rotation,
            );
            setView((current) => ({
              ...current,
              x: current.x + delta.x,
              y: current.y + delta.y,
            }));
          }
        }}
        aria-label="Interactive fictional Willowbrook campus map. Select a building or use the destination list. Drag to pan."
        onPointerDown={(e) => {
          if (e.button !== 0 || (e.target as Element).closest("[data-place]"))
            return;
          if (animation.current !== undefined)
            window.cancelAnimationFrame(animation.current);
          drag.current = { x: e.clientX, y: e.clientY, view: viewRef.current };
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const d = drag.current,
            rect = e.currentTarget.getBoundingClientRect();
          const scale = Math.min(rect.width / d.view.w, rect.height / d.view.h);
          const delta = unrotate(
            (e.clientX - d.x) / scale,
            (e.clientY - d.y) / scale,
            rotation,
          );
          setView({ ...d.view, x: d.view.x - delta.x, y: d.view.y - delta.y });
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        <defs>
          <pattern
            id="paper"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="1"
              cy="1"
              r=".6"
              fill="var(--map-paper, #849986)"
              opacity=".13"
            />
          </pattern>
          <pattern
            id="grass"
            width="15"
            height="15"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M4 8l2-3m2 3l-1-3"
              stroke="var(--map-grass, #bed0ad)"
              strokeWidth=".8"
            />
          </pattern>
          <pattern
            id="sports-lines"
            width="72"
            height="150"
            patternUnits="userSpaceOnUse"
          >
            <rect
              width="36"
              height="150"
              fill="var(--map-field-stripe, #9fb897)"
              opacity=".3"
            />
          </pattern>
          <filter
            id="building-shadow"
            x="-20%"
            y="-20%"
            width="150%"
            height="150%"
          >
            <feDropShadow
              dx="3"
              dy="6"
              stdDeviation="1"
              floodColor="#425642"
              floodOpacity=".13"
            />
          </filter>
          <filter id="pin-shadow" x="-80%" y="-70%" width="260%" height="260%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="4"
              floodColor="#123f36"
              floodOpacity=".18"
            />
          </filter>
        </defs>
        <g
          data-map-rotation={rotation}
          transform={`rotate(${rotation} ${view.x + view.w / 2} ${view.y + view.h / 2})`}
        >
          <rect
            x="-3000"
            y="-3000"
            width="7000"
            height="7000"
            fill="var(--map-ground, #f0f2e9)"
          />
          <rect
            x="-3000"
            y="-3000"
            width="7000"
            height="7000"
            fill="url(#paper)"
          />
          <path
            d="M72 -300V866H1450M-200 32H1145V1150"
            fill="none"
            stroke="var(--map-road, #dee1d9)"
            strokeWidth="42"
            strokeLinejoin="round"
          />
          <path
            d="M72 -300V866H1450M-200 32H1145V1150"
            fill="none"
            stroke="var(--map-road-line, #fbfcf7)"
            strokeWidth="2"
            strokeDasharray="12 15"
          />
          <text x="450" y="870" className="road-label">
            W I L L O W B R O O K A V E N U E
          </text>
          <text
            x="69"
            y="360"
            transform="rotate(-90 69 360)"
            className="road-label"
          >
            C O L L E G E R O A D
          </text>
          <path
            d="M315 670Q420 632 535 684L558 782Q421 839 317 780Z"
            fill="var(--map-garden, #e0e9d2)"
          />
          <path
            d="M320 680Q432 640 537 688L551 778Q423 825 319 777Z"
            fill="url(#grass)"
          />
          <path
            d="M359 703C384 669 453 679 468 708C484 739 509 717 514 743C520 782 440 805 398 776C378 762 333 742 359 703Z"
            fill="var(--map-water, #bcd8d4)"
            stroke="var(--map-water-edge, #a9ccc5)"
            strokeWidth="3"
          />
          <path
            d="M372 710C397 690 440 692 448 705M460 769q25 0 35-15"
            fill="none"
            stroke="var(--map-water-light, #dceae3)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text x="432" y="738" textAnchor="middle" className="nature-label">
            Willow Pond
          </text>
          <rect
            x="773"
            y="671"
            width="310"
            height="149"
            rx="65"
            fill="var(--map-track, #dfc7b9)"
            stroke="var(--map-track-edge, #d4b9aa)"
            strokeWidth="2"
          />
          <rect
            x="782"
            y="680"
            width="292"
            height="131"
            rx="57"
            fill="none"
            stroke="var(--map-track-line, #f2e2d7)"
            strokeWidth="2"
          />
          <rect
            x="790"
            y="688"
            width="276"
            height="115"
            rx="50"
            fill="var(--map-field, #adbf9e)"
            stroke="var(--map-track-line, #f2e2d7)"
            strokeWidth="2"
          />
          <rect
            x="835"
            y="694"
            width="190"
            height="103"
            fill="url(#sports-lines)"
            stroke="var(--map-field-line, #eaf0dd)"
            strokeWidth="2"
          />
          <path
            d="M930 694V797M835 720h26v53h-26M1025 720h-26v53h26"
            fill="none"
            stroke="var(--map-field-line, #eaf0dd)"
            strokeWidth="2"
          />
          <circle
            cx="930"
            cy="745"
            r="22"
            fill="none"
            stroke="var(--map-field-line, #eaf0dd)"
            strokeWidth="2"
          />
          <text x="930" y="847" textAnchor="middle" className="landmark-label">
            UNIVERSITY SPORTS GROUND
          </text>
          <path
            d="M133 685H282V790H133Z"
            fill="var(--map-garden, #e1e8d5)"
            stroke="var(--map-grass, #d6dfc9)"
            strokeWidth="2"
          />
          <path
            d="M140 738H275M207 692V783"
            stroke="var(--map-path, #faf9ef)"
            strokeWidth="8"
          />
          <text x="208" y="810" textAnchor="middle" className="nature-label">
            The quiet garden
          </text>
          {edges.map((e, i) => {
            const a = nodeById.get(e.from)!,
              b = nodeById.get(e.to)!;
            return (
              <g key={i}>
                <path
                  d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                  stroke="var(--map-path-edge, #dedecf)"
                  strokeWidth="19"
                  strokeLinecap="round"
                />
                <path
                  d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                  stroke="var(--map-path, #faf8ed)"
                  strokeWidth="15"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          <path
            d="M620 805V865M110 420H73M620 65V32"
            stroke="var(--map-path, #faf8ed)"
            strokeWidth="18"
          />
          <circle
            cx="620"
            cy="420"
            r="67"
            fill="var(--map-square, #e8e6d7)"
            stroke="var(--map-path-edge, #dedecf)"
            strokeWidth="2"
          />
          <circle
            cx="620"
            cy="420"
            r="57"
            fill="none"
            stroke="var(--map-square-edge, #f9f8ee)"
            strokeWidth="8"
          />
          <circle
            cx="650"
            cy="449"
            r="18"
            fill="var(--map-water, #c0d7cc)"
            stroke="var(--map-water-edge, #fbfaf3)"
            strokeWidth="5"
          />
          <circle
            cx="650"
            cy="449"
            r="6"
            fill="var(--map-water-light, #93bfb2)"
          />
          <text x="620" y="514" textAnchor="middle" className="landmark-label">
            FOUNDERS’ SQUARE
          </text>
          <text x="520" y="637" className="walk-label">
            G A R D E N W A L K
          </text>
          <text x="686" y="411" className="walk-label">
            U N I V E R S I T Y W A L K
          </text>
          {trees.map((t, i) => (
            <g key={i} aria-hidden="true">
              <ellipse
                cx={t.x + 2}
                cy={t.y + 3}
                rx={t.r}
                ry={t.r * 0.85}
                fill="#5e7757"
                opacity=".13"
              />
              <circle
                cx={t.x}
                cy={t.y}
                r={t.r}
                fill={
                  [
                    "var(--map-tree-one, #b2c69e)",
                    "var(--map-tree-two, #a8c29b)",
                    "var(--map-tree-three, #c1cfaa)",
                    "var(--map-tree-four, #bdd0ad)",
                  ][i % 4]
                }
              />
              <path
                d={`M${t.x - 3} ${t.y + 3}l3-8 4 6`}
                fill="none"
                stroke="var(--map-tree-detail, #8da780)"
                opacity=".5"
                strokeWidth="1.2"
              />
            </g>
          ))}
          {[
            { x: 555, y: 460 },
            { x: 672, y: 358 },
            { x: 660, y: 598 },
            { x: 555, y: 228 },
            { x: 325, y: 675 },
          ].map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y})`}>
              <rect
                width="19"
                height="6"
                rx="2"
                fill="var(--map-bench, #b49c7c)"
              />
              <path
                d="M3 -2v10M16 -2v10"
                stroke="var(--map-bench-edge, #867a68)"
                strokeWidth="2"
              />
            </g>
          ))}
          <StreetLamps />
          {places.map((p) => {
            const active = selected?.id === p.id;
            const colors =
              p.color === "rose"
                ? [
                    "var(--map-rose-wall, #e3cec2)",
                    "var(--map-rose-roof, #eadad0)",
                    "var(--map-rose-edge, #bea797)",
                  ]
                : p.color === "sand"
                  ? [
                      "var(--map-sand-wall, #e4d9ba)",
                      "var(--map-sand-roof, #efe6cf)",
                      "var(--map-sand-edge, #bfb28c)",
                    ]
                  : [
                      "var(--map-stone-wall, #d5dbd1)",
                      "var(--map-stone-roof, #e2e6dc)",
                      "var(--map-stone-edge, #acb7a6)",
                    ];
            return (
              <g
                key={p.id}
                data-place={p.id}
                role="button"
                tabIndex={0}
                aria-label={`${p.name}, ${p.category}`}
                aria-pressed={active}
                className={`map-building ${active ? "is-selected" : ""}`}
                onClick={() => onSelect(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p);
                  }
                }}
              >
                <title>{p.name}</title>
                {active && (
                  <rect
                    x={p.x - 7}
                    y={p.y - 7}
                    width={p.w + 14}
                    height={p.h + 14}
                    rx="11"
                    className="building-outline"
                    fill="var(--map-selected-edge, #258773)"
                    fillOpacity=".09"
                    stroke="var(--map-selected-edge, #26836e)"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                )}
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  rx="5"
                  fill={
                    p.color === "parking"
                      ? "var(--map-parking, #dfe2d8)"
                      : colors[0]
                  }
                  stroke={
                    active ? "var(--map-selected-edge, #337b65)" : colors[2]
                  }
                  strokeWidth="1.5"
                  filter="url(#building-shadow)"
                />
                {p.color === "parking" ? (
                  <g>
                    {Array.from({ length: 6 }, (_, i) => (
                      <g key={i}>
                        <path
                          d={`M${p.x + 10} ${p.y + 12 + i * 17}h30m40 0h30`}
                          stroke="var(--map-parking-line, #f9f9f3)"
                          strokeWidth="2"
                        />
                        {i % 2 === 0 && (
                          <rect
                            x={p.x + 15}
                            y={p.y + 15 + i * 17}
                            width="18"
                            height="9"
                            rx="3"
                            fill="var(--map-car, #a4b6a6)"
                          />
                        )}
                      </g>
                    ))}
                    <text
                      x={p.x + p.w / 2}
                      y={p.y + 70}
                      textAnchor="middle"
                      fill="var(--map-parking-label, #869886)"
                      fontSize="27"
                      fontWeight="600"
                    >
                      P
                    </text>
                  </g>
                ) : (
                  <g>
                    <rect
                      x={p.x + 8}
                      y={p.y + 8}
                      width={p.w - 16}
                      height={p.h - 16}
                      rx="2"
                      fill={
                        active ? "var(--map-selected-roof, #dfebd8)" : colors[1]
                      }
                      stroke={colors[2]}
                      strokeWidth=".8"
                    />
                    <path
                      d={`M${p.x + 8} ${p.y + 8}l9 9h${p.w - 34}l9-9M${p.x + 17} ${p.y + 17}v${p.h - 34}l-9 9M${p.x + p.w - 17} ${p.y + 17}v${p.h - 34}l9 9M${p.x + 17} ${p.y + p.h - 17}h${p.w - 34}`}
                      fill="none"
                      stroke={colors[2]}
                      strokeWidth=".7"
                    />
                    {Array.from({ length: Math.floor(p.w / 28) }, (_, i) => (
                      <rect
                        key={i}
                        x={p.x + 18 + i * 27}
                        y={p.y + 2}
                        width="12"
                        height="4"
                        rx="1"
                        fill={colors[2]}
                      />
                    ))}
                    {p.id === "library" && (
                      <g>
                        <rect
                          x={p.x + 68}
                          y={p.y + 25}
                          width="68"
                          height="31"
                          fill="var(--map-glass, #ced7c3)"
                          stroke="var(--map-glass-edge, #a8b59b)"
                        />
                        <path
                          d={`M${p.x + 85} ${p.y + 25}v31m17-31v31m17-31v31`}
                          stroke="var(--map-glass-line, #e7ecdf)"
                          strokeWidth="2"
                        />
                      </g>
                    )}
                  </g>
                )}
                {showLabels && (
                  <g>
                    <rect
                      x={
                        p.x +
                        p.w / 2 -
                        Math.min(85, p.shortName.length * 3.2 + 10)
                      }
                      y={p.y + p.h / 2 + 8}
                      width={Math.min(170, p.shortName.length * 6.4 + 20)}
                      height="24"
                      rx="5"
                      fill={
                        active
                          ? "var(--map-selected-label-bg, #174f42)"
                          : "var(--map-label-bg, #fffef8)"
                      }
                      fillOpacity={active ? 1 : 0.94}
                    />
                    <text
                      x={p.x + p.w / 2}
                      y={p.y + p.h / 2 + 24}
                      textAnchor="middle"
                      className={`building-label ${active ? "selected-label" : ""}`}
                    >
                      {p.shortName}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <path
            d="M446 385h18m-18 6h18m-18 6h18m-18 6h18"
            stroke="var(--map-stairs, #c3ba9e)"
            strokeWidth="2"
          />
          {entrances.map((e) => (
            <g key={e.id}>
              <path
                d={`M${e.x - 16} ${e.y - 5}v10m32-10v10`}
                stroke="var(--map-gate, #8d9c85)"
                strokeWidth="4"
              />
              <text
                x={e.x}
                y={e.y + 28}
                textAnchor="middle"
                className="gate-label"
              >
                {e.name.toUpperCase()}
              </text>
            </g>
          ))}
          <RouteOverlay
            key={routeVersion}
            routes={routes ?? (route ? [route.points] : [])}
            activeIndex={activeRouteIndex}
          />
          {start && (
            <g pointerEvents="none">
              <circle
                cx={start.x}
                cy={start.y}
                r="18"
                fill="var(--map-start, #467dcd)"
                fillOpacity=".12"
              />
              <circle
                cx={start.x}
                cy={start.y}
                r="9"
                fill="var(--map-start, #507ccc)"
                stroke="white"
                strokeWidth="4"
              />
              {!route && (
                <g>
                  <rect
                    x={start.x - 64}
                    y={start.y - 49}
                    width="128"
                    height="25"
                    rx="12.5"
                    fill="var(--map-label-bg, #fffef9)"
                    filter="url(#pin-shadow)"
                  />
                  <text
                    x={start.x}
                    y={start.y - 32}
                    textAnchor="middle"
                    className="start-label"
                  >
                    Your starting point
                  </text>
                </g>
              )}
            </g>
          )}
          {route && activeStepPoint && (
            <g
              className="traveler-marker-group"
              transform={`translate(${activeStepPoint.x} ${activeStepPoint.y})`}
              pointerEvents="none"
            >
              <circle
                r="18"
                className="traveler-beacon"
                fill="#058c42"
                fillOpacity="0.25"
              />
              <circle
                r="9"
                className="position-marker"
                fill="#ffffff"
                stroke="#058c42"
                strokeWidth="3.5"
              />
              <circle r="4" className="position-center" fill="#058c42" />
            </g>
          )}
          {selected && (
            <g
              transform={`translate(${selected.x + selected.w / 2} ${selected.y - 19})`}
              pointerEvents="none"
              filter="url(#pin-shadow)"
            >
              <path
                d="M0 10C-5 2-16-3-16-14a16 16 0 0132 0C16-3 5 2 0 10Z"
                fill="var(--map-pin, #195a47)"
              />
              <circle
                cx="0"
                cy="-14"
                r="5"
                fill="var(--map-pin-dot, #f8fbef)"
              />
            </g>
          )}
        </g>
      </svg>
      <MapCompass
        rotation={rotation}
        onRotationChange={setRotation}
        northOffset={0}
      />
      <div className="map-controls">
        <button
          className="icon-button"
          aria-label="Zoom in"
          onClick={() => zoom(0.8)}
        >
          <Plus size={20} />
        </button>
        <button
          className="icon-button"
          aria-label="Zoom out"
          onClick={() => zoom(1.25)}
        >
          <Minus size={20} />
        </button>
        <span />
        <button
          className="icon-button"
          aria-label="Fit campus"
          onClick={fitCampus}
        >
          <Maximize size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Fit route"
          disabled={!route}
          onClick={fitRoute}
        >
          <LocateFixed size={19} />
        </button>
      </div>
      <button
        className={`layers-control ${showLabels ? "active" : ""}`}
        aria-label="Toggle map labels"
        aria-pressed={showLabels}
        onClick={() => setShowLabels((v) => !v)}
      >
        <Layers size={17} /> <span>Labels</span>
      </button>
      <div className="map-caption">
        <Footprints size={15} />
        <span>A little less lost. A little more at home.</span>
      </div>
      <div className="map-attribution">
        Illustrated demo · Not for real-world navigation
      </div>
    </div>
  );
}

export default memo(CampusMap);
