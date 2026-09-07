import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: "src/system.ts",
      formats: ["es"],
      fileName: () => "system.js",
      cssFileName: "system",
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "system.json", dest: "." },
        { src: "lang", dest: "." },
        { src: "templates", dest: "." },
      ],
    }),
  ],
});
