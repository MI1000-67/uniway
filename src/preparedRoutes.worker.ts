import { routesOnMap } from "./preparedMap";
import type { PreparedMap } from "./preparedMap";
self.onmessage = (
  event: MessageEvent<{
    map: PreparedMap;
    from: string;
    to: string;
    stepFree: boolean;
  }>,
) => {
  try {
    const { map, from, to, stepFree } = event.data;
    self.postMessage({ routes: routesOnMap(map, from, to, stepFree) });
  } catch {
    self.postMessage({
      error:
        "This route could not be calculated. Check the path connections and try again.",
    });
  }
};
