import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "./styles.css";
import "./theme.css";
import "./glass.css";
import "./preparedMap.css";
import "./appearance.css";
import { applyTheme, readTheme } from "./useTheme";

applyTheme(readTheme());
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
