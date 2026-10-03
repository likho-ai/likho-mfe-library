import { createModuleFederationConfig } from '@module-federation/vite';

// This app is a remote: the shell loads ./App at run time. The shared packages are singletons
// so that the router, the query cache and the design tokens are the shell's.
export default createModuleFederationConfig({
  name: 'library',
  filename: 'remoteEntry.js',
  exposes: {
    './App': './src/App.tsx',
  },
  // The app's own stylesheet travels with the exposed module.
  bundleAllCSS: true,
  // Types of remotes are not generated: the shell loads apps by name and keeps its own types.
  dts: false,
  shared: {
    react: { singleton: true, requiredVersion: '^19.0.0' },
    'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
    'react-router': { singleton: true, requiredVersion: '^8.0.0' },
    '@tanstack/react-query': { singleton: true, requiredVersion: '^5.0.0' },
    '@likho-ai/ui': { singleton: true },
    '@likho-ai/web-sdk': { singleton: true },
  },
});
