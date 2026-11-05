import { useId } from "react";
import type { PathNode } from "./campus";
import { routeStyles } from "./RouteChoices";

export default function RouteOverlay({
  routes,
  activeIndex = 0,
  scale = 1,
}: {
  routes: PathNode[][];
  activeIndex?: number;
  scale?: number;
}) {
  const id = useId().replace(/:/g, "");
  const order = routes
    .map((points, index) => ({ points, index }))
    .filter((item) => item.index !== activeIndex)
    .reverse();
  if (routes[activeIndex])
    order.push({ points: routes[activeIndex], index: activeIndex });
  return (
    <g pointerEvents="none" className="route-overlays">
      {order.map(({ points, index }) => {
        const style = routeStyles[index] ?? routeStyles[0];
        const coordinates = points.map((p) => `${p.x},${p.y}`).join(" ");
        const active = index === activeIndex;
        const maskId = `${id}-route-${index}`;
        return (
          <g
            key={`${index}-${points.map((p) => p.id).join()}`}
            opacity={active ? 1 : 0.8}
          >
            <defs>
              <mask
                id={maskId}
                maskUnits="userSpaceOnUse"
                x="-100000"
                y="-100000"
                width="200000"
                height="200000"
              >
                <polyline
                  className="route-reveal"
                  points={coordinates}
                  fill="none"
                  stroke="white"
                  strokeWidth={14 / scale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength="1"
                />
              </mask>
            </defs>
            <g mask={`url(#${maskId})`}>
              <polyline
                points={coordinates}
                fill="none"
                stroke="var(--map-route-casing, #fffef8)"
                strokeWidth={(active ? 7 : 6) / scale}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                data-route-index={index}
                points={coordinates}
                fill="none"
                stroke={style.color}
                strokeWidth={(active ? 5 : 4) / scale}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={style.dashArray
                  ?.split(" ")
                  .map((n) => Number(n) / scale)
                  .join(" ")}
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}
