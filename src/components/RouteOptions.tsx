export type RouteOption = { path: string[]; distance: number; edgeIndexes?: number[] };
export function RouteOptions({
  routes,
  active,
  select,
  calibrated,
}: {
  routes: RouteOption[];
  active: number;
  select: (index: number) => void;
  calibrated: boolean;
}) {
  return (
    <div className="route-options" aria-label="Compare walking routes">
      {routes.map((r, i) => (
        <button
          key={r.path.join('|')}
          className={`route-option route-${i} ${active === i ? 'active' : ''}`}
          aria-pressed={active === i}
          onClick={() => select(i)}
        >
          <span className="route-swatch" />
          <span>
            <strong>{i === 0 ? 'Shortest path' : `Alternative ${i}`}</strong>
            <small>
              {calibrated
                ? `${Math.round((r.distance * 0.6) / 5) * 5} m on the demo map`
                : i === 0
                  ? 'Shortest mapped distance'
                  : `${Math.round((r.distance / (routes[0].distance || 1) - 1) * 100)}% longer on this layout`}
            </small>
          </span>
          {i === 0 && <span className="recommended-tag">Recommended</span>}
        </button>
      ))}
      <p className="route-legend">
        Green is shortest, amber is longer, terracotta is longest. Line patterns and labels show the
        difference too.
      </p>
    </div>
  );
}
