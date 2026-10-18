import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, existsSync } from "node:fs";
import { parse } from "dotenv";
import { fileURLToPath } from "node:url";
import { developmentApiTarget } from "../shared/dev-config";
// Read the API port without applying the server's NODE_ENV to the client build.
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const serverEnv = existsSync(envPath) ? parse(readFileSync(envPath)) : {};
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": developmentApiTarget({
        ...serverEnv,
        ...process.env,
      }),
    },
  },
  build: { outDir: "dist" },
});
