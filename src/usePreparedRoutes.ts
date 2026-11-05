import { useEffect, useMemo, useState } from "react";
import type { PreparedMap } from "./preparedMap";
import { routesOnMap } from "./preparedMap";
type Result = ReturnType<typeof routesOnMap>;
export function usePreparedRoutes(
  map: PreparedMap,
  from: string,
  to: string,
  stepFree: boolean,
  enabled: boolean,
) {
  const job = useMemo(
    () => ({ map, from, to, stepFree, enabled }),
    [map, from, to, stepFree, enabled],
  );
  const [result, setResult] = useState<{
    job: typeof job;
    routes: Result;
    error: string;
  } | null>(null);
  const needsWorker = map.nodes.length > 400 && typeof Worker !== "undefined";
  const immediate = useMemo(
    () => (enabled && !needsWorker ? routesOnMap(map, from, to, stepFree) : []),
    [job, needsWorker],
  );
  useEffect(() => {
    if (!enabled || !needsWorker) return;
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("./preparedRoutes.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      setResult({
        job,
        routes: [],
        error: "Route calculation is unavailable. Try reopening the map.",
      });
      return;
    }
    const timer = window.setTimeout(() => {
      worker.terminate();
      setResult({
        job,
        routes: [],
        error:
          "This path network is unusually complex. Simplify its connections and try again.",
      });
    }, 15000);
    worker.onmessage = (event) => {
      clearTimeout(timer);
      setResult({
        job,
        routes: event.data.routes ?? [],
        error: event.data.error ?? "",
      });
      worker.terminate();
    };
    worker.onerror = () => {
      clearTimeout(timer);
      setResult({
        job,
        routes: [],
        error: "Route calculation stopped. Try reopening the map.",
      });
      worker.terminate();
    };
    worker.postMessage({ map, from, to, stepFree });
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [job, needsWorker]);
  return {
    routes: needsWorker
      ? result?.job === job
        ? result.routes
        : []
      : immediate,
    pending: enabled && needsWorker && result?.job !== job,
    error: result?.job === job ? result.error : "",
  };
}
