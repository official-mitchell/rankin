// Client entry. Tokens and local fonts for checklist 3.1.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/russo-one/400.css";
import "./styles/tokens.css";
import "./styles/shell.css";
import "./styles/screens.css";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
