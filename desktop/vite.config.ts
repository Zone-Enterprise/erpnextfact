import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM context
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
  return {
    // Configure Vue plugin
    plugins: [
      vue({
        template: {
          compilerOptions: {
            // Treat all tags with a dash as custom elements
            isCustomElement: (tag) => tag.includes('-')
          }
        }
      })
    ],
    
    // Base public path
    base: './',

    // Root directory for Vite (where index.html lives)
    root: path.resolve(__dirname, 'src'),
    
    // Configure path aliases to match tsconfig
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@main': path.resolve(__dirname, 'main'),
        '@config': path.resolve(__dirname, 'config'),
        '@assets': path.resolve(__dirname, 'assets'),
        '@shared': path.resolve(__dirname, 'shared')
      },
      // Ensure .vue files are properly resolved
      extensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    
    // Configure build options
    build: {
      // Output to the dist directory
      // We changed root to `src`, so emit build output one level up
      outDir: '../dist',
      // Generate sourcemaps in development
      sourcemap: !isProduction,
      // Minify in production
      minify: isProduction ? 'esbuild' : false,
      // Target modern browsers
      target: 'es2020',
      // Configure CSS handling
      cssCodeSplit: true,
      // Configure rollup options
      rollupOptions: {
        // External dependencies that should not be bundled
        external: [
          'electron',
          'electron-store',
          'better-sqlite3',
          'knex',
          'pm2',
          'fs',
          'path',
          'os',
          'crypto',
          'child_process',
          'stream',
          'util',
          'events',
          'net',
          'http',
          'https',
          'url',
          'zlib',
          'assert',
          'buffer',
          'querystring',
          'readline'
        ],
        output: {
          // Ensure proper handling of chunks
          manualChunks: (id) => {
            // Group vendor modules
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      },
      // Emit manifest for better debugging
      manifest: true,
      // Ensure proper handling of assets
      assetsDir: 'assets',
      // Empty outDir before building
      emptyOutDir: true
    },
    
    // Configure development server
    server: {
      port: 6969,
      host: '0.0.0.0',
      // Enable strict port (fail if port is in use)
      strictPort: true,
      // Configure CORS for development
      cors: true,
      // Configure HMR
      hmr: {
        // Use WebSocket for HMR
        protocol: 'ws',
        // Fallback to polling if WebSocket fails
        fallback: true
      },
      // Configure proxy for API requests
      proxy: {
        // Proxy API requests to backend server
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false
        }
      },
      // Watch for file changes
      watch: {
        // Use polling in certain environments (WSL, containers)
        usePolling: false,
        // Ignore node_modules
        ignored: ['**/node_modules/**', '**/dist/**']
      }
    },
    
    // Configure preview server (for testing production builds)
    preview: {
      port: 6970,
      host: '0.0.0.0',
      strictPort: true
    },
    
    // Configure optimizations
    optimizeDeps: {
      // Include dependencies that need to be pre-bundled
      include: [
        'vue',
        'vue-router',
        'lodash',
        'luxon'
      ],
      // Exclude dependencies that should not be bundled
      exclude: [
        'electron',
        'electron-store',
        'better-sqlite3',
        'knex',
        'pm2'
      ]
    },
    
    // Configure environment variables
    envPrefix: ['VITE_', 'ELECTRON_']
  };
});
