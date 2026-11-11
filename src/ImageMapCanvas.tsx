import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize, Route } from "lucide-react";
import type { PathNode, Point } from "./campus";
import type { PreparedMap } from "./preparedMap";
import type { View } from "./mapView";
import { fitMapView, mapInsets } from "./mapView";
import MapCompass from "./MapCompass";
import RouteOverlay from "./RouteOverlay";
import { unrotate } from "./rotation";

export default function ImageMapCanvas({
  map,
  editing = false,
  tool = "pan",
  selected,
  route,
  routes,
  activeRouteIndex = 0,
  routeVersion,
  sidebarCollapsed,
  onNorthOffsetChange,
  activeNode,
  scalePoints,
  onPoint,
  onNode,
  showCandidateRegions = false,
  currentStepIndex = 0,
}: {
  map: PreparedMap;
  editing?: boolean;
  tool?: string;
  selected?: string;
  route?: PathNode[];
  routes?: PathNode[][];
  activeRouteIndex?: number;
  routeVersion?: number;
  sidebarCollapsed?: boolean;
  onNorthOffsetChange?: (degrees: number) => void;
  activeNode?: string | null;
  scalePoints?: Point[];
  onPoint?: (point: Point) => void;
  onNode: (id: string) => void;
  showCandidateRegions?: boolean;
  currentStepIndex?: number;
}) {
  const initial = { x: 0, y: 0, w: map.image.width, h: map.image.height };
  const [rotation, setRotation] = useState(0);
  const mapGroup = useRef<SVGGElement>(null);
  const [view, setView] = useState<View>(initial);
  const [cursor, setCursor] = useState<Point>({
    x: map.image.width / 2,
    y: map.image.height / 2,
  });
  const [keyboard, setKeyboard] = useState(false);
  const [viewport, setViewport] = useState({ width: 1000, height: 700 });
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: View } | null>(null);
  const dragged = useRef(false);
  const lookup = new Map(map.nodes.map((n) => [n.id, n]));
  const selectedPlace = map.places.find((p) => p.nodeId === selected);
  const screenScale = Math.min(
    viewport.width / view.w,
    viewport.height / view.h,
  );
  const radius = 12 / screenScale;
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width && bounds.height)
        setViewport({ width: bounds.width, height: bounds.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const fitRoute = () => {
    if (!route?.length) return;
    setRotation(0);
    const xs = route.map((p) => p.x),
      ys = route.map((p) => p.y);
    const destination = map.places.find(
      (place) => place.nodeId === selected,
    )?.labelPoint;
    if (destination) {
      xs.push(destination.x);
      ys.push(destination.y);
    }
    const pad = Math.max(map.image.width, map.image.height) * 0.08;
    setView(
      fitMapView(
        {
          x: Math.min(...xs) - pad,
          y: Math.min(...ys) - pad,
          w: Math.max(...xs) - Math.min(...xs) + pad * 2,
          h: Math.max(...ys) - Math.min(...ys) + pad * 2,
        },
        viewport,
        mapInsets(svg.current),
      ),
    );
  };
  function fitImage() {
    setRotation(0);
    setView(fitMapView(initial, viewport, mapInsets(svg.current)));
  }
  useEffect(() => {
    fitImage();
  }, [map.image.id, map.image.width, map.image.height]);
  useEffect(() => {
    if (route) fitRoute();
    else fitImage();
  }, [route, viewport.width, viewport.height]);
  useEffect(() => {
    if (routeVersion) fitRoute();
  }, [routeVersion]);
  useEffect(() => {
    if (sidebarCollapsed !== undefined) {
      if (route) fitRoute();
      else fitImage();
    }
  }, [sidebarCollapsed]);
  const activeStepPoint =
    route && route.length > 0
      ? route[Math.min(currentStepIndex, route.length - 1)]
      : null;
  useEffect(() => {
    if (!route || currentStepIndex === undefined || currentStepIndex === 0)
      return;
    const pt = route[Math.min(currentStepIndex, route.length - 1)];
    if (!pt) return;
    setView((curView) => {
      const pad = 60;
      const inView =
        pt.x >= curView.x + pad &&
        pt.x <= curView.x + curView.w - pad &&
        pt.y >= curView.y + pad &&
        pt.y <= curView.y + curView.h - pad;
      if (!inView) {
        return {
          x: pt.x - curView.w / 2,
          y: pt.y - curView.h / 2,
          w: curView.w,
          h: curView.h,
        };
      }
      return curView;
    });
  }, [currentStepIndex, route]);
  function zoom(factor: number) {
    setView((v) => {
      const w = Math.min(
        map.image.width * 4,
        Math.max(map.image.width / 12, v.w * factor),
      );
      const h = (v.h * w) / v.w;
      return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    });
  }
  function pick(x: number, y: number) {
    const matrix = mapGroup.current?.getScreenCTM();
    if (!matrix) return;
    const p = new DOMPoint(x, y).matrixTransform(matrix.inverse());
    if (p.x < 0 || p.y < 0 || p.x > map.image.width || p.y > map.image.height)
      return;
    setCursor({ x: p.x, y: p.y });
    onPoint?.({ x: p.x, y: p.y });
  }
  return (
    <div
      className={`image-map-stage ${editing ? "is-editing" : ""} tool-${tool}`}
    >
      <svg
        ref={svg}
        viewBox={`${view.x} ${view.y} ${Math.max(1, view.w)} ${Math.max(1, view.h)}`}
        tabIndex={0}
        role="group"
        aria-label={
          editing
            ? "Map editor canvas. Use arrow keys to position the crosshair, Enter to add a point. Use the numbered point buttons to connect existing points."
            : `Interactive map of ${map.name}. Drag to pan. Use the place list to select a destination.`
        }
        onPointerDown={(e) => {
          setKeyboard(false);
          if (e.button !== 0 || (e.target as Element).closest("[data-node]"))
            return;
          e.preventDefault();
          e.currentTarget.focus({ preventScroll: true });
          dragged.current = false;
          drag.current = { x: e.clientX, y: e.clientY, view };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5)
            dragged.current = true;
          if (!dragged.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const scale = Math.min(rect.width / d.view.w, rect.height / d.view.h);
          const delta = unrotate(
            (e.clientX - d.x) / scale,
            (e.clientY - d.y) / scale,
            rotation,
          );
          setView({ ...d.view, x: d.view.x - delta.x, y: d.view.y - delta.y });
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          drag.current = null;
          if (!dragged.current && editing && tool !== "pan")
            pick(e.clientX, e.clientY);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            zoom(0.8);
          }
          if (e.key === "-") {
            e.preventDefault();
            zoom(1.25);
          }
          if (e.key.startsWith("Arrow")) {
            e.preventDefault();
            const screenDx =
              e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
            const screenDy =
              e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
            const { x: dx, y: dy } = unrotate(screenDx, screenDy, rotation);
            if (editing && tool !== "pan") {
              setKeyboard(true);
              const step = e.shiftKey ? 1 : view.w / 50;
              setCursor((p) => ({
                x: Math.max(0, Math.min(map.image.width, p.x + dx * step)),
                y: Math.max(0, Math.min(map.image.height, p.y + dy * step)),
              }));
            } else
              setView((v) => ({
                ...v,
                x: v.x + (dx * v.w) / 20,
                y: v.y + (dy * v.h) / 20,
              }));
          }
          if (e.key === "Enter" && editing && tool !== "pan") {
            e.preventDefault();
            onPoint?.(cursor);
          }
        }}
      >
        <g
          ref={mapGroup}
          data-map-rotation={rotation}
          transform={`rotate(${rotation} ${view.x + view.w / 2} ${view.y + view.h / 2})`}
        >
          <rect
            width={map.image.width}
            height={map.image.height}
            fill="#f9faf5"
          />
          <image
            href={map.image.url}
            width={map.image.width}
            height={map.image.height}
            preserveAspectRatio="none"
          />
          {editing && showCandidateRegions && (
            <g pointerEvents="none" aria-hidden="true">
              {map.analysis?.candidateRegions?.map((region, i) => (
                <rect
                  key={i}
                  x={region.x}
                  y={region.y}
                  width={region.width}
                  height={region.height}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.5 / screenScale}
                  strokeDasharray={`${5 / screenScale} ${4 / screenScale}`}
                />
              ))}
            </g>
          )}
          {scalePoints && (
            <g pointerEvents="none">
              {scalePoints.length === 2 && (
                <line
                  x1={scalePoints[0].x}
                  y1={scalePoints[0].y}
                  x2={scalePoints[1].x}
                  y2={scalePoints[1].y}
                  stroke="#aa45c3"
                  strokeWidth={radius * 0.3}
                  strokeDasharray={`${radius * 0.7} ${radius * 0.4}`}
                />
              )}
              {scalePoints.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={radius}
                    fill="#aa45c3"
                    stroke="#fff"
                    strokeWidth={radius * 0.15}
                  />
                  <text
                    x={p.x}
                    y={p.y + radius * 0.35}
                    textAnchor="middle"
                    fontSize={radius}
                    fill="#fff"
                  >
                    {i === 0 ? "A" : "B"}
                  </text>
                </g>
              ))}
            </g>
          )}
          {editing &&
            map.edges.map((edge, i) => {
              const a = lookup.get(edge.from),
                b = lookup.get(edge.to);
              return a && b ? (
                <g key={i}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#fff"
                    strokeWidth={radius * 0.65}
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={edge.stepFree ? "#14886f" : "#bf7831"}
                    strokeWidth={radius * 0.36}
                    strokeDasharray={
                      edge.stepFree
                        ? undefined
                        : `${radius * 0.5} ${radius * 0.3}`
                    }
                  />
                </g>
              ) : null;
            })}
          <RouteOverlay
            routes={routes ?? (route ? [route] : [])}
            activeIndex={activeRouteIndex}
            scale={screenScale}
          />
          {route?.length ? (
            <g pointerEvents="none">
              {[route[0], route[route.length - 1]].map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={radius * 0.5}
                  fill={index ? "var(--route-shortest, #237c68)" : "#467dcd"}
                  stroke="white"
                  strokeWidth={radius * 0.2}
                >
                  <title>
                    {index
                      ? "Destination approach point"
                      : "Selected starting point"}
                  </title>
                </circle>
              ))}
            </g>
          ) : null}
          {route?.length && activeStepPoint ? (
            <g
              className="traveler-marker-group"
              transform={`translate(${activeStepPoint.x} ${activeStepPoint.y})`}
              pointerEvents="none"
            >
              <circle
                r={radius * 1.1}
                className="traveler-beacon"
                fill="#058c42"
                fillOpacity="0.25"
              />
              <circle
                r={radius * 0.6}
                className="position-marker"
                fill="#ffffff"
                stroke="#058c42"
                strokeWidth={radius * 0.2}
              />
              <circle
                r={radius * 0.25}
                className="position-center"
                fill="#058c42"
              />
            </g>
          ) : null}
          {!editing && selectedPlace?.region && (
            <g pointerEvents="none" aria-hidden="true">
              <rect
                x={selectedPlace.region.x - 3}
                y={selectedPlace.region.y - 3}
                width={selectedPlace.region.width + 6}
                height={selectedPlace.region.height + 6}
                rx={6}
                fill="rgba(5, 140, 66, 0.16)"
                stroke="#058c42"
                strokeWidth={2.5 / screenScale}
              />
            </g>
          )}
          {!editing && (
            <g className="building-hit-areas">
              {map.places.map((place) =>
                place.region ? (
                  <rect
                    key={`hit-${place.id}`}
                    x={place.region.x}
                    y={place.region.y}
                    width={place.region.width}
                    height={place.region.height}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNode(place.nodeId);
                    }}
                  >
                    <title>{place.name}</title>
                  </rect>
                ) : null,
              )}
            </g>
          )}
          {map.nodes.map((node, index) => {
            const place = map.places.find((p) => p.nodeId === node.id);
            if (!editing && !place) return null;
            const active = selected === node.id || activeNode === node.id;
            if (editing && !place && tool !== "path" && !active) return null;
            const markerRadius = place || active ? radius : radius * 0.32;
            const markerNumber =
              place?.labelNumber ??
              (place ? map.places.indexOf(place) + 1 : index + 1);
            const marker =
              !editing && place?.labelPoint ? place.labelPoint : node;
            const label =
              place && place.name.length > 24
                ? `${place.name.slice(0, 23)}…`
                : (place?.name ?? "");
            return (
              <g
                key={node.id}
                data-node={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${place ? place.name : `Path point ${index + 1}`}${active ? ", selected" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onNode(node.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onNode(node.id);
                  }
                }}
              >
                <title>{place?.name ?? node.landmark}</title>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={(place || active ? 22 : 7) / screenScale}
                  fill="transparent"
                />
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={markerRadius * (active ? 1.2 : 1)}
                  fill={
                    active
                      ? "#164b40"
                      : place?.entrance
                        ? "#3562b0"
                        : place
                          ? "#20836c"
                          : "#fff"
                  }
                  stroke={place || active ? "#fff" : "#1a7662"}
                  strokeWidth={radius * 0.19}
                />
                {(place || active) && (
                  <text
                    x={marker.x}
                    y={marker.y + radius * 0.32}
                    textAnchor="middle"
                    fill={place || active ? "#fff" : "#165b49"}
                    fontSize={radius * 0.92}
                    fontWeight="700"
                  >
                    {markerNumber}
                  </text>
                )}
                {place && !editing && active && (
                  <g pointerEvents="none">
                    <rect
                      x={marker.x - (label.length * 0.28 + 0.7) * radius}
                      y={marker.y + radius * 1.4}
                      width={(label.length * 0.56 + 1.4) * radius}
                      height={radius * 1.6}
                      rx={radius * 0.4}
                      fill={active ? "#164b40" : "#fff"}
                    />
                    <text
                      x={marker.x}
                      y={marker.y + radius * 2.52}
                      textAnchor="middle"
                      fill={active ? "#fff" : "#183c33"}
                      fontSize={radius}
                      fontWeight="600"
                    >
                      {label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {keyboard && editing && (
            <g
              pointerEvents="none"
              stroke="#e84a33"
              strokeWidth={radius * 0.15}
            >
              <circle cx={cursor.x} cy={cursor.y} r={radius} fill="#fff8" />
              <path
                d={`M${cursor.x - radius * 1.6} ${cursor.y}h${radius * 3.2}M${cursor.x} ${cursor.y - radius * 1.6}v${radius * 3.2}`}
              />
            </g>
          )}
        </g>
      </svg>
      <MapCompass
        className="image-map-compass"
        rotation={rotation}
        onRotationChange={setRotation}
        northOffset={map.northOffset ?? null}
        onNorthOffsetChange={onNorthOffsetChange}
      />
      <div className="image-map-controls">
        <button
          className="icon-button"
          aria-label="Zoom in uploaded map"
          onClick={() => zoom(0.8)}
        >
          <Plus size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Zoom out uploaded map"
          onClick={() => zoom(1.25)}
        >
          <Minus size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Fit uploaded map"
          onClick={fitImage}
        >
          <Maximize size={17} />
        </button>
        {!editing && (
          <button
            className="icon-button"
            aria-label="Fit uploaded route"
            disabled={!route}
            onClick={fitRoute}
          >
            <Route size={17} />
          </button>
        )}
      </div>
      <span className="image-map-caption">
        {editing
          ? "Drag to pan · + / − to zoom"
          : "Prepared map · Manually selected position"}
      </span>
    </div>
  );
}
