import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const headers = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' blob: data:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export default defineConfig({
  plugins: [react()],
  // Serve even small font subsets from this origin so the strict font CSP holds.
  build: { assetsInlineLimit: 0 },
  server: {
    host: "127.0.0.1",
    headers: {
      ...headers,
      "Content-Security-Policy": headers["Content-Security-Policy"].replace(
        "script-src 'self'",
        "script-src 'self' 'unsafe-inline'",
      ),
    },
  },
  preview: { host: "127.0.0.1", headers },
});
