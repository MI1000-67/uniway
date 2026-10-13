import { useState, useRef, useEffect } from 'react';
import type { Campus, Place, Point } from '../data';
import { Icon } from '../icons';
import { CampusArt } from '../CampusArt';

type Props = {
  campus: Campus;
  custom: boolean;
  floor: number;
  selected?: Place;
  start: string;
  directions: boolean;
  paths: Point[][];
  activeRoute: number;
  walking: boolean;
  currentStep?: Point;
  saved: boolean;
  minutes: number;
  startName: string;
  edit: 'none' | 'pin' | 'connect';
  connectFrom: string | null;
  pathAccessible: boolean;
  onPathAccessible: (value: boolean) => void;
  onFloor: (floor: number) => void;
  onSelect: (place: Place) => void;
  onAdd: (point: Point) => void;
  onEdit: (mode: 'none' | 'pin' | 'connect') => void;
  onSave: () => void;
  onDirections: () => void;
  onDelete: () => void;
  onHelp: () => void;
  onShare: () => void;
  onReview: () => void;
  children?: React.ReactNode;
};
export function MapView(p: Props) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [bearing, setBearing] = useState(0),
    [source, setSource] = useState(false);
  const svg = useRef<SVGSVGElement>(null),
    group = useRef<SVGGElement>(null);
  const pointers = useRef(new Map<number, Point>()),
    gesture = useRef<{
      points: Point[];
      pan: Point;
      zoom: number;
      bearing: number;
      moved: boolean;
    } | null>(null);
  const image = p.campus.images[p.floor],
    place = p.selected;
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBearing(0);
  };
  useEffect(() => {
    reset();
    setSource(false);
  }, [p.floor, p.campus.name, image?.data]);
  const pointOnMap = (x: number, y: number) =>
    new DOMPoint(x, y).matrixTransform(group.current!.getScreenCTM()!.inverse());
  const rebase = () => {
    gesture.current = { points: [...pointers.current.values()], pan, zoom, bearing, moved: false };
  };
  const down = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || (event.target as Element).closest('[data-pin]')) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    rebase();
  };
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()],
      original = gesture.current;
    if (points.length !== original.points.length) {
      rebase();
      return;
    }
    const average = (a: Point[]) =>
      a.reduce((s, q) => ({ x: s.x + q.x / a.length, y: s.y + q.y / a.length }), { x: 0, y: 0 });
    const a = average(points),
      b = average(original.points),
      matrix = svg.current!.getScreenCTM()!;
    const delta = new DOMPoint(a.x - b.x, a.y - b.y).matrixTransform(
      new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, 0, 0]).inverse(),
    );
    if (Math.hypot(a.x - b.x, a.y - b.y) > 4 || points.length > 1) original.moved = true;
    if (original.moved) setPan({ x: original.pan.x + delta.x, y: original.pan.y + delta.y });
    if (points.length === 2) {
      const vector = (q: Point[]) => ({ x: q[1].x - q[0].x, y: q[1].y - q[0].y });
      const v = vector(points),
        w = vector(original.points);
      setZoom(
        Math.max(
          0.75,
          Math.min(3, (original.zoom * Math.hypot(v.x, v.y)) / (Math.hypot(w.x, w.y) || 1)),
        ),
      );
      setBearing(
        original.bearing + ((Math.atan2(v.y, v.x) - Math.atan2(w.y, w.x)) * 180) / Math.PI,
      );
    }
  };
  const up = (event: React.PointerEvent<SVGSVGElement>) => {
    const initial = gesture.current;
    pointers.current.delete(event.pointerId);
    if (!initial?.moved && initial?.points.length === 1 && p.edit === 'pin') {
      const q = pointOnMap(event.clientX, event.clientY);
      if (q.x >= 0 && q.x <= 1000 && q.y >= 0 && q.y <= 800) p.onAdd({ x: q.x, y: q.y });
    }
    if (pointers.current.size) rebase();
    else gesture.current = null;
  };
  const keyboard = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return;
    const keys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      '+',
      '=',
      '-',
      '[',
      ']',
      'Home',
      'Enter',
    ];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key.startsWith('Arrow'))
      setPan((q) => ({
        x: q.x + (event.key === 'ArrowLeft' ? 35 : event.key === 'ArrowRight' ? -35 : 0),
        y: q.y + (event.key === 'ArrowUp' ? 35 : event.key === 'ArrowDown' ? -35 : 0),
      }));
    if (event.key === '+' || event.key === '=') setZoom((z) => Math.min(3, z + 0.25));
    if (event.key === '-') setZoom((z) => Math.max(0.75, z - 0.25));
    if (event.key === '[' || event.key === ']')
      setBearing((b) => b + (event.key === '[' ? -45 : 45));
    if (event.key === 'Home') reset();
    if (event.key === 'Enter' && p.edit === 'pin') {
      const r = svg.current!.getBoundingClientRect(),
        q = pointOnMap(r.x + r.width / 2, r.y + r.height / 2);
      if (q.x >= 0 && q.x <= 1000 && q.y >= 0 && q.y <= 800) p.onAdd(q);
    }
  };
  return (
    <section
      className={`map-panel ${p.edit !== 'none' ? 'editing' : ''}`}
      aria-label="Interactive campus map"
    >
      <div className="map-topbar">
        <div className="map-location">
          <span className="map-location-icon">
            <Icon name="building" />
          </span>
          <div>
            <strong>{p.campus.name}</strong>
            <small>
              {p.custom
                ? `${p.campus.places.filter((q) => q.floor === p.floor).length} places · Generated from your layout`
                : 'A campus full of possibilities'}
              <span className="map-demo">{p.custom ? 'LOCAL MAP' : 'FICTIONAL DEMO'}</span>
            </small>
          </div>
        </div>
        {!p.custom && (
          <button
            className="map-share icon-button"
            onClick={p.onShare}
            aria-label="Share campus QR code"
          >
            <Icon name="qr" />
          </button>
        )}
      </div>
      <div className="map-viewport">
        <svg
          ref={svg}
          tabIndex={0}
          onKeyDown={keyboard}
          className={`interactive-map ${p.edit === 'pin' ? 'add-pin-mode' : ''}`}
          viewBox="0 0 1000 800"
          aria-label="Campus map. Arrow keys move, plus and minus zoom, brackets rotate, Home resets."
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={(event) => {
            pointers.current.delete(event.pointerId);
            gesture.current = null;
          }}
        >
          <g
            ref={group}
            transform={`translate(${500 + pan.x} ${400 + pan.y}) scale(${zoom}) rotate(${bearing}) translate(-500 -400)`}
          >
            {p.custom ? (
              <>
                <rect width="1000" height="800" className="map-land" />
                {source ? (
                  <image
                    href={image?.data}
                    width="1000"
                    height="800"
                    preserveAspectRatio="xMidYMid meet"
                  />
                ) : (
                  <>
                    <pattern id="import-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <circle cx="3" cy="3" r=".8" className="grid-dot" />
                    </pattern>
                    <rect width="1000" height="800" fill="url(#import-grid)" />
                    {image?.buildings?.map((b, i) => (
                      <rect
                        key={i}
                        className="generated-building"
                        x={b.x}
                        y={b.y}
                        width={b.width}
                        height={b.height}
                        rx="4"
                      />
                    ))}
                  </>
                )}
                {p.campus.edges.map((e, i) => {
                  const nodes = [...p.campus.places, ...(p.campus.junctions ?? [])],
                    a = nodes.find((n) => n.id === e.a),
                    b = nodes.find((n) => n.id === e.b);
                  return a && b && a.floor === p.floor ? (
                    <polyline
                      key={i}
                      className={`generated-road ${e.confirmed === false ? 'unreviewed' : ''}`}
                      points={(e.points ?? [a, b]).map((q) => `${q.x},${q.y}`).join(' ')}
                    />
                  ) : null;
                })}
              </>
            ) : (
              <CampusArt />
            )}
            {p.directions &&
              [...p.paths.keys()].reverse().map((i) => (
                <g key={i}>
                  <polyline
                    className="route-under"
                    points={p.paths[i].map((q) => `${q.x},${q.y}`).join(' ')}
                  />
                  <polyline
                    className={`route-line route-${i} ${i === p.activeRoute ? 'chosen' : 'alternative'}`}
                    points={p.paths[i].map((q) => `${q.x},${q.y}`).join(' ')}
                  />
                </g>
              ))}
            {p.campus.places
              .filter((q) => q.floor === p.floor)
              .map((q) => (
                <g
                  key={q.id}
                  data-pin
                  role="button"
                  tabIndex={0}
                  aria-label={`${q.name}, ${q.category}${place?.id === q.id ? ', selected' : ''}`}
                  className={`map-pin ${q.category.toLowerCase()} ${place?.id === q.id ? 'selected' : ''} ${p.connectFrom === q.id ? 'connecting' : ''}`}
                  transform={`translate(${q.x} ${q.y}) rotate(${-bearing})`}
                  onClick={(event) => {
                    event.stopPropagation();
                    p.onSelect(q);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      p.onSelect(q);
                    }
                  }}
                >
                  <circle className="pin-hit" r="26" />
                  <circle r={place?.id === q.id ? 22 : 16} />
                  <g transform="translate(-9 -9)">
                    <Icon name={q.icon} size={18} />
                  </g>
                  <text className="pin-label" textAnchor="middle" y={place?.id === q.id ? 43 : 37}>
                    {q.name}
                  </text>
                  {q.id === p.start && p.directions && (
                    <text textAnchor="middle" y="-33" className="pin-label">
                      START HERE
                    </text>
                  )}
                </g>
              ))}
            {p.walking && p.currentStep && (
              <g transform={`translate(${p.currentStep.x} ${p.currentStep.y})`}>
                <circle r="14" className="position-marker" />
                <circle r="7" className="position-center" />
              </g>
            )}
          </g>
        </svg>
      </div>
      <div className="map-options">
        <div className="level-control">
          <Icon name="layers" size={17} />
          {p.custom ? (
            <select
              aria-label="Map image"
              value={p.floor}
              onChange={(event) => p.onFloor(Number(event.target.value))}
            >
              {p.campus.images.map((im, i) => (
                <option value={i} key={i}>
                  {im.name}
                </option>
              ))}
            </select>
          ) : (
            <span>Campus · Ground</span>
          )}
        </div>
        {p.custom && (
          <>
            <button className="editor-toggle" onClick={() => setSource((s) => !s)}>
              <Icon name={source ? 'map' : 'layers'} size={16} />
              {source ? 'Generated map' : 'Source image'}
            </button>
            <button
              className={`editor-toggle ${p.edit !== 'none' ? 'active' : ''}`}
              onClick={() => p.onEdit(p.edit === 'none' ? 'pin' : 'none')}
            >
              <Icon name="edit" size={16} />
              {p.edit === 'none' ? 'Edit' : 'Done'}
            </button>
          </>
        )}
      </div>
      <button
        className="map-compass"
        onClick={() => setBearing(0)}
        aria-label={
          p.custom
            ? 'Reset map to original orientation; geographic north is not calibrated'
            : 'Reset map to north'
        }
        title={p.custom ? 'Map up · north is uncalibrated' : 'Reset north'}
      >
        <span>{p.custom ? 'UP' : 'N'}</span>
        <svg viewBox="0 0 24 32" style={{ transform: `rotate(${bearing}deg)` }}>
          <path d="m12 3 8 24-8-6-8 6Z" fill="currentColor" />
          <path d="m12 3 8 24-8-6Z" className="compass-shade" />
        </svg>
      </button>
      {p.custom && image?.reviewed !== true && p.edit === 'none' && (
        <div className="review-banner">
          <Icon name="info" size={17} />
          <div>
            <strong>Check your generated map</strong>
            <small>
              {image?.warnings?.[0] || 'Confirm the detected labels and paths before navigating.'}
            </small>
            <button onClick={p.onReview}>
              Review places and paths
              <Icon name="arrow" size={13} />
            </button>
          </div>
        </div>
      )}
      {p.edit !== 'none' && (
        <div className="editor-toolbar">
          <div className="editor-tools">
            <button className={p.edit === 'pin' ? 'active' : ''} onClick={() => p.onEdit('pin')}>
              <Icon name="pin" size={16} />
              Add places
            </button>
            <button
              className={p.edit === 'connect' ? 'active' : ''}
              onClick={() => p.onEdit('connect')}
            >
              <Icon name="route" size={16} />
              Connect paths
            </button>
          </div>
          <p>
            {p.edit === 'pin'
              ? 'Click the map to add a place. Keyboard: focus the map and press Enter.'
              : 'Select two places to add a verified walkway.'}
          </p>
          {p.edit === 'connect' && (
            <label>
              <input
                type="checkbox"
                checked={p.pathAccessible}
                onChange={(event) => p.onPathAccessible(event.target.checked)}
              />
              I checked this path is step-free
            </label>
          )}
        </div>
      )}
      <div className="zoom-controls">
        <button
          aria-label="Zoom in"
          disabled={zoom >= 3}
          onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
        >
          <Icon name="plus" />
        </button>
        <button
          aria-label="Zoom out"
          disabled={zoom <= 0.75}
          onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
        >
          <Icon name="minus" />
        </button>
        <button aria-label="Rotate map left" onClick={() => setBearing((b) => b - 45)}>
          <span aria-hidden="true">↶</span>
        </button>
        <button aria-label="Rotate map right" onClick={() => setBearing((b) => b + 45)}>
          <span aria-hidden="true">↷</span>
        </button>
        <button className="fit-map" aria-label="Fit and reset map" onClick={reset}>
          <Icon name="locate" />
        </button>
      </div>
      {place && p.edit === 'none' && !p.walking && (
        <div className="destination-card">
          <div className="destination-heading">
            <span className={`destination-icon ${place.category.toLowerCase()}`}>
              <Icon name={place.icon} size={25} />
            </span>
            <div>
              <span className="eyebrow">{place.category}</span>
              <h2>{place.name}</h2>
            </div>
            <button
              className={`icon-button save-button ${p.saved ? 'saved' : ''}`}
              aria-label={p.saved ? 'Unsave place' : 'Save place'}
              onClick={p.onSave}
            >
              <Icon name="bookmark" />
            </button>
          </div>
          <p>{place.description}</p>
          <div className="destination-bottom">
            <span className="walk-distance">
              <Icon name="walk" size={16} />
              {p.custom
                ? 'Your layout, made interactive'
                : `${p.minutes} min from ${p.startName.toLowerCase()}`}
            </span>
            <button className="primary compact" onClick={p.onDirections}>
              Directions
              <Icon name="arrow" size={17} />
            </button>
          </div>
        </div>
      )}
      {place && p.edit !== 'none' && (
        <div className="edit-place-card">
          <span>
            <strong>{place.name}</strong>
            <small>
              {p.campus.edges.filter((e) => e.a === place.id || e.b === place.id).length} connected
              paths
            </small>
          </span>
          <button className="icon-button" onClick={p.onDelete} aria-label={`Delete ${place.name}`}>
            <Icon name="trash" size={18} />
          </button>
        </div>
      )}
      {p.children}
      <div className="map-bottom">
        <span className="scale-bar">
          {p.custom ? 'Scale unknown' : '~ 50 m'}
          <i />
        </span>
        <span className="map-watermark">
          uniway<span> · {p.custom ? 'Personal map' : 'Demo campus'} · Temporary session</span>
        </span>
        <button className="map-help" onClick={p.onHelp}>
          <Icon name="help" size={17} />
          <span>Map help</span>
        </button>
      </div>
    </section>
  );
}
