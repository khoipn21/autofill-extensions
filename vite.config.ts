import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// Chrome extension config with separate builds for popup vs scripts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.DEV': JSON.stringify(false),
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

// Export separate configs for content and background scripts
export const contentConfig = defineConfig({
  define: {
    'import.meta.env.DEV': JSON.stringify(false),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'content',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

export const backgroundConfig = defineConfig({
  define: {
    'import.meta.env.DEV': JSON.stringify(false),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/background/index.ts'),
      name: 'background',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
