import { useEffect, useRef, useState } from "react";
import { ArrowRight, ScanLine, ShieldCheck } from "lucide-react";
import { layoutLanguages } from "./engine/languages";
import type { LayoutLanguage } from "./engine/languages";
import type { UploadedImage } from "./UploadPanel";
import type { PreparedMap } from "./preparedMap";

export default function MapPreparation({
  image,
  draft,
  onAnalyzed,
  onManual,
  onPreview,
}: {
  image: UploadedImage;
  draft?: PreparedMap;
  onAnalyzed: (map: PreparedMap) => void;
  onManual: () => void;
  onPreview: () => void;
}) {
  const [language, setLanguage] = useState<LayoutLanguage>(
    draft?.analysis?.language ?? "eng",
  );
  const [progress, setProgress] = useState<{
    stage: string;
    progress: number;
  } | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );
  async function analyze() {
    controller.current?.abort();
    const job = new AbortController();
    controller.current = job;
    setError("");
    setProgress({ stage: "Preparing local analysis", progress: 0 });
    try {
      const { analyzeUploadedMap } = await import("./engine");
      if (job.signal.aborted) return;
      const map = await analyzeUploadedMap(
        image,
        language,
        (next) => {
          if (controller.current === job)
            setProgress((current) => ({
              ...next,
              progress: Math.max(current?.progress ?? 0, next.progress),
            }));
        },
        job.signal,
      );
      if (!job.signal.aborted && controller.current === job) onAnalyzed(map);
    } catch (cause) {
      if (!job.signal.aborted && controller.current === job)
        setError(
          cause instanceof Error
            ? cause.message
            : "This image needs a closer look. Try again or add places manually.",
        );
    } finally {
      if (controller.current === job) {
        controller.current = null;
        setProgress(null);
      }
    }
  }
  return (
    <section className="local-preparation" aria-label="Local map preparation">
      <label className="map-field language-field">
        Layout text language
        <select
          value={language}
          disabled={!!progress}
          onChange={(e) => setLanguage(e.target.value as LayoutLanguage)}
        >
          {layoutLanguages.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p className="small-copy">
        Choose the language printed on the map. Names stay in their original
        language.
      </p>
      {progress ? (
        <div className="analysis-progress">
          <div role="status">
            <ScanLine size={18} />
            <strong>{progress.stage}</strong>
          </div>
          <progress
            aria-label="Map analysis progress"
            value={progress.progress}
            max={1}
          />
          <p>
            Reading labels and visible paths on your device. Larger maps take a
            little longer.
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              controller.current?.abort();
              controller.current = null;
              setProgress(null);
            }}
          >
            Cancel analysis
          </button>
        </div>
      ) : (
        <div className="upload-map-actions">
          <button
            className="primary-button"
            onClick={draft ? onManual : () => void analyze()}
          >
            {draft ? "Review places & paths" : "Make this map interactive"}
            <ArrowRight size={17} />
          </button>
          <button className="secondary-button" onClick={onPreview}>
            Open map preview
          </button>
          {draft ? (
            <button className="text-button" onClick={() => void analyze()}>
              Analyze image again
            </button>
          ) : (
            <button className="text-button" onClick={onManual}>
              Prepare manually
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="analysis-message" role="status">
          {error} Your original image is still available.
        </p>
      )}
      <p className="local-privacy">
        <ShieldCheck size={15} /> Local analysis · No image uploads to an AI
        service
      </p>
    </section>
  );
}
