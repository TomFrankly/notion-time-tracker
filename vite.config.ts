import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, rmSync } from 'fs';

// Plugin to copy extension files after build
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    writeBundle() {
      const distDir = resolve(__dirname, 'dist');
      
      // Ensure dist directory exists
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }
      
      // Read and transform manifest.json
      const manifest = JSON.parse(
        readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8')
      );
      
      // Update popup path for built version
      manifest.action.default_popup = 'popup.html';
      
      // Write transformed manifest
      writeFileSync(
        resolve(distDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );
      
      // Copy icons
      const iconsDir = resolve(__dirname, 'public/icons');
      const distIconsDir = resolve(distDir, 'icons');
      
      if (!existsSync(distIconsDir)) {
        mkdirSync(distIconsDir, { recursive: true });
      }
      
      if (existsSync(iconsDir)) {
        const iconFiles = readdirSync(iconsDir);
        for (const file of iconFiles) {
          copyFileSync(
            resolve(iconsDir, file),
            resolve(distIconsDir, file)
          );
        }
      }
      
      // Copy and fix popup.html from src/popup.html to root
      const srcPopupPath = resolve(distDir, 'src/popup.html');
      const destPopupPath = resolve(distDir, 'popup.html');
      if (existsSync(srcPopupPath)) {
        let html = readFileSync(srcPopupPath, 'utf-8');
        // Fix relative paths from ../assets to ./assets
        html = html.replace(/\.\.\/assets\//g, './assets/');
        writeFileSync(destPopupPath, html);
        
        // Clean up the src folder
        rmSync(resolve(distDir, 'src'), { recursive: true, force: true });
      }
    }
  };
}

export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
    copyExtensionFiles()
  ],
  base: './',
  resolve: {
    alias: {
      '$lib': resolve(__dirname, 'src/popup/lib'),
      '$components': resolve(__dirname, 'src/popup/components')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});
