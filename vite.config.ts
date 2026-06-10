import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
    }),
  ],
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/domain/**/*.ts"],
      exclude: ["src/domain/models.ts"],
    },
  },
});
