// Vite client. Build output is dist/client so the Worker can serve it as static assets.
// Dev server rewrites /__fixtures to the SPA shell. Production Worker returns 404 for that path.
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const root = new URL(".", import.meta.url).pathname;

function fixtureRewrite(): Plugin {
  return {
    name: "fixture-rewrite",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const request = req as { url?: string };
        if (request.url?.startsWith("/__fixtures")) request.url = "/index.html";
        next();
      });
    },
  };
}

export default defineConfig({
  root,
  plugins: [fixtureRewrite(), react()],
  build: { outDir: "../dist/client", emptyOutDir: true },
  appType: "spa",
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:8787", ws: true, changeOrigin: true } },
  },
});
