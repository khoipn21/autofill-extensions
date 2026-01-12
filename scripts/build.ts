import { build } from 'vite';
import { resolve, dirname } from 'path';
import { cpSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Clean dist folder first
console.log('Cleaning dist folder...');
try {
  rmSync(resolve(rootDir, 'dist'), { recursive: true, force: true });
} catch {
  // Ignore if doesn't exist
}

// Build popup (React app with HTML entry)
console.log('Building popup...');
await build({
  configFile: resolve(rootDir, 'vite.config.ts'),
});

// Build content script (IIFE format, bundled)
console.log('Building content script...');
await build({
  configFile: false,
  define: {
    'import.meta.env.DEV': JSON.stringify(false),
  },
  build: {
    outDir: resolve(rootDir, 'dist'),
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      input: resolve(rootDir, 'src/content/index.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
});

// Build background script (IIFE format, bundled)
console.log('Building background script...');
await build({
  configFile: false,
  define: {
    'import.meta.env.DEV': JSON.stringify(false),
  },
  build: {
    outDir: resolve(rootDir, 'dist'),
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      input: resolve(rootDir, 'src/background/index.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'background.js',
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
});

// Copy static files
console.log('Copying static files...');
cpSync(resolve(rootDir, 'public/manifest.json'), resolve(rootDir, 'dist/manifest.json'));
cpSync(resolve(rootDir, 'public/icons'), resolve(rootDir, 'dist/icons'), { recursive: true });

console.log('Build complete!');
