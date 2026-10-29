// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // The UI is shared on the PRIVATE local network. All WhatsApp tokens
  // remain in the loopback-only Node API; browsers use the same-origin proxy.
  vite: {
    server: {
      host: "0.0.0.0",
      port: 8080,
      strictPort: true,
      proxy: {
        "/ideal-api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
          rewrite: (path: string) => path.startsWith("/ideal-api") ? path.slice("/ideal-api".length) || "/" : path,
          configure(proxy) {
            // Translate only same-site UI requests to the backend's trusted
            // localhost origin. Keep other Origin values intact so the
            // backend rejects cross-site POSTs rather than enabling CSRF.
            proxy.on("proxyReq", (request, incoming) => {
              const origin = incoming.headers.origin;
              const host = incoming.headers.host;
              if (origin && host && origin === `http://${host}`)
                request.setHeader("origin", "http://127.0.0.1:8080");
            });
          },
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
