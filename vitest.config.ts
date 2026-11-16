import { defineWorkersProject } from "@cloudflare/vitest-pool-workers/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["shared/**/*.test.ts", "client/**/*.test.ts", "scripts/**/*.test.ts", "worker/**/*.unit.test.ts"],
        },
      },
      defineWorkersProject({
        test: {
          name: "worker",
          include: ["worker/**/*.worker.test.ts"],
          poolOptions: {
            workers: {
              isolatedStorage: false,
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: { bindings: { CREATE_KEY: "test-create-key-xx" } },
            },
          },
        },
      }),
    ],
  },
});
