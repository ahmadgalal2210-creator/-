import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function inlineOfflineTemplatePlugin(): Plugin {
  return {
    name: 'inline-offline-template',
    enforce: 'post',
    generateBundle(_options, bundle) {
      let jsCode = '';
      let cssCode = '';

      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.isEntry) {
          jsCode = item.code;
          delete bundle[fileName];
        } else if (item.type === 'asset' && fileName.endsWith('.css')) {
          cssCode += typeof item.source === 'string' ? item.source : item.source.toString();
          delete bundle[fileName];
        }
      }

      const safeJs = jsCode.replace(/<\/script/gi, '<\\/script');
      const safeCss = cssCode.replace(/<\/style/gi, '<\\/style');

      const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0F172A" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="إدارة البيئة" />
    <meta name="cloud-sync-origin" content="__CLOUD_SYNC_ORIGIN__" />
    <title>إدارة البيئة — السكرتارية | شركة الدقهلية لصناعة وتكرير السكر</title>
    <meta
      name="description"
      content="منظومة إدارة البيئة والسلامة المهنية لشركة الدقهلية لصناعة وتكرير السكر — د. أيمن عبد الحميد (دكتوراه في الكيمياء والسلامة المهنية)."
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>${safeCss}</style>
  </head>
  <body class="bg-slate-50 text-slate-900 antialiased">
    <div id="root"></div>
    <script>window.__OFFLINE_HTML_MODE__ = true;</script>
    <script id="offline-seed-data" type="application/json">__OFFLINE_SEED_JSON__</script>
    <script>${safeJs}</script>
  </body>
</html>`;

      const outPath = path.resolve(__dirname, 'public/offline-template.html');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineOfflineTemplatePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-offline-tmp',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/offlineMain.tsx'),
      output: {
        format: 'iife',
        name: 'EnvOfflineApp',
        inlineDynamicImports: true,
        entryFileNames: 'offline-app.js',
        assetFileNames: 'offline-app.[ext]',
      },
    },
  },
});
