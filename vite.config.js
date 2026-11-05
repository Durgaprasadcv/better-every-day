import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png}"] },
      manifest: {
        id: "/",
        name: "Better Every Day",
        short_name: "Better Day",
        description: "A private, local-first personal growth tracker.",
        theme_color: "#142a26",
        background_color: "#f5f7f2",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules") &&
            (id.includes("@firebase/auth") || id.includes("firebase/auth"))
          )
            return "firebase-auth";
          if (
            id.includes("node_modules") &&
            (id.includes("@firebase/firestore") ||
              id.includes("firebase/firestore"))
          )
            return "firebase-firestore";
        },
      },
    },
  },
});
