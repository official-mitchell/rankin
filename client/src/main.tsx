// Client entry. Foundation shell only; session UI comes in later phases.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { APP_NAME } from "@we-rankin/shared";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <App title={APP_NAME} />
  </StrictMode>,
);
