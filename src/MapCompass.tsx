import { useEffect, useId, useRef, useState } from "react";
import { Compass, RotateCcw, RotateCw, Smartphone, X } from "lucide-react";
import {
  compassDirection,
  headingFromOrientation,
  headingUpRotation,
  normalizeDegrees,
  northUpRotation,
} from "./compass";
import type { CompassReading } from "./compass";
import "./compass.css";

export type MapCompassProps = {
  /** Clockwise rotation applied to the map, in degrees. */
  rotation: number;
  onRotationChange: (degrees: number) => void;
  /** Clockwise angle from the unrotated image's top to north; null if unknown. */
  northOffset?: number | null;
  onNorthOffsetChange?: (degrees: number) => void;
  className?: string;
};

type SensorStatus = "off" | "requesting" | "waiting" | "live" | "error";
type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<PermissionState>;
};

export default function MapCompass({
  rotation,
  onRotationChange,
  northOffset = null,
  onNorthOffsetChange,
  className = "",
}: MapCompassProps) {
  const panelId = useId();
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SensorStatus>("off");
  const [message, setMessage] = useState("");
  const [heading, setHeading] = useState<number | null>(null);
  const stopListening = useRef<() => void>(() => {});
  const generation = useRef(0);
  const knownNorth = northOffset !== null && Number.isFinite(northOffset);
  const northAngle = normalizeDegrees(
    rotation + (knownNorth ? northOffset : 0),
  );
  const running =
    status === "waiting" || status === "live" || status === "requesting";

  function stopSensor() {
    generation.current += 1;
    stopListening.current();
    stopListening.current = () => {};
    setStatus("off");
    setHeading(null);
    setMessage("");
  }

  useEffect(
    () => () => {
      generation.current += 1;
      stopListening.current();
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  async function startSensor() {
    stopSensor();
    const request = generation.current;
    const Constructor = window.DeviceOrientationEvent as
      OrientationConstructor | undefined;
    if (!window.isSecureContext || !Constructor) {
      setStatus("error");
      setMessage(
        "Device compass is unavailable here. You can still rotate the map manually.",
      );
      return;
    }
    setStatus("requesting");
    try {
      // Called directly from this button gesture, as required by Safari and the spec.
      const permission = Constructor.requestPermission
        ? await Constructor.requestPermission(true)
        : "granted";
      if (generation.current !== request) return;
      if (permission !== "granted") {
        setStatus("error");
        setMessage(
          "Compass access was not allowed. Manual map rotation still works.",
        );
        return;
      }
      setStatus("waiting");
      setMessage("Hold your phone flat while we find north.");
      let staleTimer: ReturnType<typeof setTimeout>;
      let lastUpdate = 0;
      function cleanup() {
        window.removeEventListener("deviceorientationabsolute", orientation);
        window.removeEventListener("deviceorientation", orientation);
        document.removeEventListener("visibilitychange", visibility);
        clearTimeout(staleTimer);
      }
      function unavailable() {
        cleanup();
        setHeading(null);
        setStatus("error");
        setMessage(
          "No reliable compass reading yet. Hold the phone flat and try again, or use manual rotation.",
        );
      }
      function orientation(event: Event) {
        const reading = headingFromOrientation(
          event as unknown as CompassReading,
          window.screen.orientation?.angle ?? 0,
        );
        if (reading === null) return;
        clearTimeout(staleTimer);
        staleTimer = setTimeout(unavailable, 10000);
        const now = Date.now();
        if (now - lastUpdate < 120) return;
        lastUpdate = now;
        setHeading(Math.round(reading) % 360);
        setStatus("live");
        setMessage(
          "Keep your phone flat. Nearby metal can affect the reading.",
        );
      }
      function visibility() {
        if (document.visibilityState === "hidden") {
          cleanup();
          setHeading(null);
          setStatus("off");
          setMessage(
            "Device compass paused while the app was in the background.",
          );
        }
      }
      window.addEventListener("deviceorientationabsolute", orientation);
      window.addEventListener("deviceorientation", orientation);
      document.addEventListener("visibilitychange", visibility);
      staleTimer = setTimeout(unavailable, 8000);
      stopListening.current = cleanup;
    } catch {
      if (generation.current !== request) return;
      setStatus("error");
      setMessage(
        "Device compass could not start. Check your browser's motion permission or use manual rotation.",
      );
    }
  }

  return (
    <div
      ref={container}
      className={`map-compass ${className}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="map-compass-trigger"
        aria-label={
          knownNorth
            ? "Map compass and rotation"
            : "Map rotation; north not calibrated"
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="map-compass-letter" aria-hidden="true">
          {knownNorth ? "N" : "?"}
        </span>
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          aria-hidden="true"
          style={{ transform: `rotate(${northAngle}deg)` }}
        >
          <circle
            cx="14"
            cy="14"
            r="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            opacity=".45"
          />
          <path d="M14 4 19 20 14 17 9 20Z" fill="currentColor" />
          <path d="M14 4V17L9 20Z" fill="var(--cream)" opacity=".75" />
        </svg>
      </button>
      {open && (
        <section
          id={panelId}
          className="map-compass-panel"
          aria-label="Map orientation controls"
        >
          <header>
            <strong>
              <Compass size={16} /> Map orientation
            </strong>
            <button
              type="button"
              aria-label="Close compass controls"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          </header>
          <p>
            {knownNorth
              ? "North follows this map's orientation."
              : "North is not calibrated for this image."}
          </p>
          <div className="map-compass-actions">
            <button
              type="button"
              aria-label="Rotate map left"
              title="Rotate left 30°"
              onClick={() => onRotationChange(normalizeDegrees(rotation - 30))}
            >
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              className="map-compass-reset"
              onClick={() =>
                onRotationChange(knownNorth ? northUpRotation(northOffset) : 0)
              }
            >
              {knownNorth ? "North up" : "Reset view"}
            </button>
            <button
              type="button"
              aria-label="Rotate map right"
              title="Rotate right 30°"
              onClick={() => onRotationChange(normalizeDegrees(rotation + 30))}
            >
              <RotateCw size={18} />
            </button>
          </div>
          <label className="compass-angle">
            Map rotation <span aria-hidden="true">{Math.round(rotation)}°</span>
            <input
              type="range"
              min="0"
              max="359"
              step="1"
              value={rotation}
              onChange={(event) => onRotationChange(Number(event.target.value))}
            />
          </label>
          {onNorthOffsetChange && (
            <div className="map-compass-calibration">
              <p>
                Rotate until the map's printed north arrow points up, then
                confirm.
              </p>
              <button
                type="button"
                onClick={() => onNorthOffsetChange(normalizeDegrees(-rotation))}
              >
                {knownNorth ? "Recalibrate north" : "Use this as north"}
              </button>
            </div>
          )}
          <div className="map-compass-sensor">
            <button
              type="button"
              className="map-compass-device"
              onClick={running ? stopSensor : startSensor}
            >
              <Smartphone size={16} />
              {running ? "Turn device compass off" : "Use device compass"}
            </button>
            {heading !== null && (
              <div className="map-compass-reading">
                <strong>
                  {heading}° {compassDirection(heading)}
                </strong>
                <span>Device heading</span>
              </div>
            )}
            {heading !== null && knownNorth && (
              <button
                type="button"
                className="map-compass-align"
                onClick={() =>
                  onRotationChange(headingUpRotation(heading, northOffset))
                }
              >
                Align map to this heading
              </button>
            )}
            <p className="map-compass-status" role="status">
              {message ||
                "Optional, on this device. Your position is not tracked."}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
