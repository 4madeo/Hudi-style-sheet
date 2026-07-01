import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: "landing.html",
      onwarn(warning, defaultHandler) {
        if (
          warning.message?.includes("contains an annotation that Rollup cannot interpret")
          && warning.message.includes("/*#__PURE__*/")
        ) {
          return;
        }
        defaultHandler(warning);
      }
    }
  }
});
