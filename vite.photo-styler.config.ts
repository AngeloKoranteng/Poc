import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  plugins: [
    vue({
      customElement: /\.ce\.vue$/,
    }),
  ],
  build: {
    lib: {
      entry: "src/web-component/photo-styler.ts",
      formats: ["es"],
      fileName: "photo-styler",
    },
    outDir: "dist/photo-styler",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
