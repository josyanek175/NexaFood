import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/assets/burger.jpg": path.resolve(__dirname, "./src/test/stubs/image.ts"),
      "@/assets/combo.jpg": path.resolve(__dirname, "./src/test/stubs/image.ts"),
      "@/assets/porcao.jpg": path.resolve(__dirname, "./src/test/stubs/image.ts"),
      "@/assets/bebida.jpg": path.resolve(__dirname, "./src/test/stubs/image.ts"),
    },
  },
});
