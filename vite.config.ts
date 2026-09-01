import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [dts({ include: ["src"], rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "SomesTs",
      fileName: "somes-ts",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: [],
    },
    sourcemap: true,
  },
  test: {
    globalSetup: ["./test/globalSetup.ts"],
    testTimeout: 15_000,
  },
});
