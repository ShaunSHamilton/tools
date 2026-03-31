import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import prism from "vite-plugin-prismjs";

export default defineConfig(async () => ({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
    prism({
      languages: [
        "markup",
        "html",
        "xml",
        "svg",
        "rss",
        "css",
        "javascript",
        "arduino",
        "armasm",
        "aspnet",
        "bash",
        "batch",
        "c",
        "cs",
        "cpp",
        "cmake",
        "csv",
        "d",
        "diff",
        "docker",
        "elixir",
        "erlang",
        "fortran",
        "git",
        "go",
        "gradle",
        "graphql",
        "haskell",
        "http",
        "java",
        "json",
        "json5",
        "latex",
        "log",
        "matlab",
        "mongodb",
        "nginx",
        "php",
        "powershell",
        "pug",
        "python",
        "r",
        "jsx",
        "tsx",
        "renpy",
        "ruby",
        "rust",
        "sass",
        "scss",
        "sql",
        "swift",
        "toml",
        "typescript",
        "vim",
        "visual-basic",
        "wasm",
        "yaml",
        "zig",
      ],
      plugins: ["line-numbers"],
      theme: "okaidia",
      css: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/server/**", "**/target/**"],
    },
    proxy: {
      // exam-creator
      "/exam-creator/api": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      "/exam-creator/auth": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      "/exam-creator/ws": {
        target: `ws://127.0.0.1:${process.env.PORT ?? "8080"}`,
        ws: true,
      },
      "/exam-creator/status": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      // task-tracker
      "/task-tracker/auth": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      "/task-tracker/health": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      "/task-tracker/reports": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      "/task-tracker/orgs": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      "/task-tracker/github": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      "/task-tracker/share": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      // universal auth
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      // team-board
      "/team-board/api": {
        target: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
        changeOrigin: true,
        secure: false,
      },
      "/team-board/ws": {
        target: `ws://127.0.0.1:${process.env.PORT ?? "8080"}`,
        ws: true,
      },
    },
    hmr: {
      host: "127.0.0.1",
      port: 1420,
    },
  },
  optimizeDeps: {
    exclude: ["bson"],
  },
  esbuild: {
    supported: {
      "top-level-await": true,
    },
  },
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              name: "react-vendor",
              test: /\/node_modules\/(react|react-dom)\//,
            },
            {
              name: "react-query",
              test: /\/node_modules\/@tanstack\/react-query\//,
            },
            {
              name: "react-router",
              test: /\/node_modules\/@tanstack\/react-router\//,
            },
            { name: "charts", test: /\/node_modules\/recharts\// },
            { name: "d3-vendor", test: /\/node_modules\/(d3-|victory-)/ },
            {
              name: "icons",
              test: /\/node_modules\/(lucide-react|react-icons)\//,
            },
            {
              name: "state",
              test: /\/node_modules\/(immer|use-immer|zustand)\//,
            },
            { name: "dnd", test: /\/node_modules\/@dnd-kit/ },
            { name: "radix", test: /\/node_modules\/(radix-ui|@radix-ui)\// },
          ],
        },
      },
    },
  },
}));
