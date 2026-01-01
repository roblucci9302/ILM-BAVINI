import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer, type Plugin } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Custom plugin to provide path polyfill that works in both SSR and client contexts.
 * Uses native Node.js path in SSR, path-browserify in client.
 *
 * This plugin handles path resolution manually because vite-plugin-node-polyfills
 * uses resolve.alias which doesn't distinguish between SSR and client contexts,
 * and path-browserify (CJS) doesn't work in Vite's ESM-based SSR.
 */
function pathPolyfillPlugin(): Plugin {
  return {
    name: 'path-polyfill',
    enforce: 'pre',
    async resolveId(id, importer, options) {
      // Handle path module resolution
      if (id === 'path' || id === 'node:path') {
        if (options?.ssr) {
          // SSR: use native Node.js path
          return { id: 'node:path', external: true };
        }

        // Client: resolve path-browserify to its actual location
        const resolved = await this.resolve('path-browserify', importer, {
          skipSelf: true,
          ...options,
        });

        if (resolved) {
          return { id: resolved.id, external: false };
        }

        // Fallback: return the module name (let Vite resolve it)
        return null;
      }

      // Prevent path-browserify from loading in SSR
      if (options?.ssr && id === 'path-browserify') {
        return { id: 'node:path', external: true };
      }

      return null;
    },
  };
}

export default defineConfig((config) => {
  return {
    build: {
      target: 'esnext', // Modern browsers (code uses top-level await)
      chunkSizeWarningLimit: 500, // Warn if chunk > 500KB
      // Note: Code splitting is handled via React.lazy() wrappers in:
      // - app/components/editor/codemirror/index.tsx (CodeMirror)
      // - app/components/ui/ColorBends.lazy.tsx (Three.js)
      // - app/components/chat/CodeBlock.lazy.tsx (Shiki)
      // Vite will automatically create separate chunks for these lazy-loaded modules
    },
    optimizeDeps: {
      exclude: ['@electric-sql/pglite', 'pyodide'],
    },
    ssr: {
      // Externalize CJS packages and browser-only packages from SSR bundling
      external: [
        'path-browserify',
        '@isomorphic-git/lightning-fs',
        '@isomorphic-git/idb-keyval',
        'isomorphic-git',
      ],
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./app/test/setup.ts'],
      include: ['app/**/*.spec.{ts,tsx}'],
      exclude: ['app/lib/templates/**', 'app/e2e/**', 'node_modules/**'],
      testTimeout: 10000,
      hookTimeout: 10000,
      pool: 'forks',
      isolate: true,
    },
    plugins: [
      pathPolyfillPlugin(),
      nodePolyfills({
        // Path is handled by pathPolyfillPlugin for SSR compatibility
        include: ['buffer'],
      }),
      config.mode !== 'test' && remixCloudflareDevProxy(),
      config.mode !== 'test' &&
        remixVitePlugin({
          future: {
            v3_fetcherPersist: true,
            v3_relativeSplatPath: true,
            v3_throwAbortReason: true,
          },
          ignoredRouteFiles: ['**/*.spec.ts', '**/*.spec.tsx'],
        }),
      UnoCSS(),
      tsconfigPaths(),
      config.mode !== 'test' && chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      config.mode !== 'test' &&
        viteStaticCopy({
          targets: [
            {
              src: 'node_modules/pyodide/*.{js,mjs,wasm,zip,json}',
              dest: 'assets/pyodide',
            },
          ],
        }),
    ],
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}
