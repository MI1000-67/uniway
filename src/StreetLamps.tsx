import { memo, useId } from "react";

// Decorative lamps follow the existing demo paths. They never modify routing.
const lamps = [
  [286, 236],
  [286, 348],
  [286, 472],
  [286, 594],
  [360, 215],
  [565, 215],
  [695, 215],
  [912, 215],
  [416, 436],
  [505, 436],
  [730, 436],
  [880, 436],
  [350, 666],
  [472, 666],
  [704, 666],
  [851, 666],
  [966, 666],
  [636, 293],
  [636, 545],
  [636, 734],
  [636, 794],
  [966, 290],
  [966, 398],
  [966, 560],
  [577, 376],
  [671, 383],
  [575, 460],
  [676, 458],
  [336, 707],
  [378, 794],
  [524, 762],
  [164, 436],
];

function StreetLamps() {
  const glow = useId().replace(/:/g, "");
  return (
    <g className="street-lamps" aria-hidden="true" pointerEvents="none">
      <defs>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#f2d18e" stopOpacity=".34" />
          <stop offset=".35" stopColor="#edbd69" stopOpacity=".12" />
          <stop offset="1" stopColor="#edbd69" stopOpacity="0" />
        </radialGradient>
      </defs>
      {lamps.map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <circle className="street-lamp-light" r="20" fill={`url(#${glow})`} />
          <path d="M0 5V-4" stroke="#576766" strokeWidth="1.5" />
          <ellipse cx="1" cy="6" rx="3" ry="1.3" fill="#13251f" opacity=".18" />
          <rect
            className="street-lamp-head"
            x="-2.2"
            y="-5"
            width="4.4"
            height="3.5"
            rx="1.2"
          />
        </g>
      ))}
    </g>
  );
}

export default memo(StreetLamps);
