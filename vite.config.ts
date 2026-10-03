import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import prefixer from 'postcss-prefix-selector';
import { defineConfig } from 'vite';
import moduleFederationConfig from './module-federation.config.ts';

// Served under /mfe/library/ by its own container in a real environment, and by `pnpm dev` behind
// the local gateway during development.
export default defineConfig({
  base: '/mfe/library/',
  plugins: [react(), tailwindcss(), federation(moduleFederationConfig)],
  css: {
    // PostCSS runs the scoping below; Vite's default CSS transformer (Lightning CSS) would skip it.
    transformer: 'postcss',
    postcss: {
      plugins: [
        // Every rule of this app's stylesheet applies only under its root element (data-mfe), so
        // the same utility class in the shell and in this app never fight over an element.
        prefixer({
          prefix: '[data-mfe="library"]',
          transform: (prefix, selector, prefixed) =>
            /^(:root|:host|html|body|\.dark|\*|::|:where\(\.space|:where\(\.divide)/.test(selector) ||
            selector.startsWith(prefix)
              ? selector
              : prefixed,
        }),
      ],
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    // Listens on every interface so the gateway container reaches it through the host address.
    host: '0.0.0.0',
    origin: 'http://localhost:5174',
    allowedHosts: ['localhost', 'host.docker.internal'],
  },
  build: { target: 'es2022' },
});
