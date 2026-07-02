import { analyzeRaster } from './vision.mjs';
self.onmessage = (event) => {
  try {
    self.postMessage({ result: analyzeRaster(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Map analysis failed.' });
  }
};
