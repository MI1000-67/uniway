import { useId } from "react";
import type { CSSProperties } from "react";
import "./routeChoices.css";

export const routeStyles = [
  {
    color: "var(--route-shortest, #237c68)",
    dashArray: undefined,
    label: "Shortest path",
    pattern: "Solid",
  },
  {
    color: "var(--route-alternative-one, #b97928)",
    dashArray: "12 7",
    label: "Alternative 1",
    pattern: "Dashed",
  },
  {
    color: "var(--route-alternative-two, #bd6755)",
    dashArray: "2 8",
    label: "Alternative 2",
    pattern: "Dotted",
  },
] as const;

export type RouteChoiceItem = {
  meters: number | null;
  minutes: number | null;
  distancePixels: number;
};

function distanceLabel(
  item: RouteChoiceItem,
  shortest: number,
  context: "demo" | "prepared",
) {
  if (item.meters !== null) {
    const distance =
      item.meters >= 1000
        ? `${(item.meters / 1000).toFixed(1)} km`
        : `${Math.round(item.meters)} m`;
    return `${distance}${item.minutes === null ? "" : ` · ${item.minutes} min`}${context === "demo" ? " on demo map" : " estimated"}`;
  }
  if (shortest <= 0 || item.distancePixels === shortest)
    return "Distance not calibrated";
  const percent = Math.round((item.distancePixels / shortest - 1) * 100);
  return percent > 0
    ? `${percent}% longer on this layout`
    : "Similar length on this layout";
}

export function RouteChoices({
  items,
  activeIndex,
  onSelect,
  context = "prepared",
}: {
  items: RouteChoiceItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  context?: "demo" | "prepared";
}) {
  const descriptionId = useId();
  const choices = items.slice(0, 3);
  const calibrated = choices.every((choice) => choice.meters !== null);
  if (!choices.length)
    return (
      <p className="route-choices-note" role="status">
        No connected route is available for this journey.
      </p>
    );
  return (
    <section className="route-choices" aria-label="Walking route choices">
      <div
        className="route-choices-list"
        role="group"
        aria-label="Choose a walking route"
        aria-describedby={descriptionId}
      >
        {choices.map((item, index) => {
          const style = routeStyles[index];
          return (
            <button
              key={index}
              type="button"
              className={`route-choice ${activeIndex === index ? "is-selected" : ""}`}
              aria-pressed={activeIndex === index}
              onClick={() => onSelect(index)}
              style={{ "--choice-color": style.color } as CSSProperties}
            >
              <svg
                className="route-choice-swatch"
                width="28"
                height="12"
                viewBox="0 0 28 12"
                aria-hidden="true"
              >
                <path
                  d="M2 6H26"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={style.dashArray}
                />
              </svg>
              <span className="route-choice-copy">
                <strong>{style.label}</strong>
                <span>
                  {distanceLabel(item, choices[0].distancePixels, context)}
                </span>
              </span>
              <span className="route-choice-pattern">{style.pattern}</span>
            </button>
          );
        })}
      </div>
      <p className="route-choices-note" id={descriptionId}>
        {choices.length === 1
          ? choices[0].distancePixels === 0
            ? "You’re already at your destination."
            : "One connected route is available for this journey."
          : choices.length === 2
            ? "Two connected routes are available. Green is shortest; amber is the alternative."
            : "Green is shortest. Amber and terracotta show alternatives; line patterns distinguish them too."}
        {!calibrated && " Set a known scale to see metres and walking times."}
      </p>
    </section>
  );
}
