import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { startupDiagnostics } from './scripts/vite-startup-diagnostics';

const resolveEntry = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * MPA 入口路由：把 /game、/editor 映射到对应 HTML。
 * Vite 构建产物按「相对 root 的路径」保留目录结构（web-dist/src/ui/index.html 等），
 * 因此 dev（源码）与 preview（产物）使用同一套映射。
 */
function mpaRoutes(): Plugin {
  const targets: Record<string, string> = {
    '/game': '/src/ui/index.html',
    '/editor': '/tools/datapack-editor/ui/index.html',
  };
  const redirect = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const url = req.url ?? '';
    const queryIndex = url.indexOf('?');
    const pathname = queryIndex < 0 ? url : url.slice(0, queryIndex);
    const target = targets[pathname];
    if (!target) return next();
    res.statusCode = 302;
    res.setHeader('Location', `${target}${queryIndex < 0 ? '' : url.slice(queryIndex)}`);
    res.end();
  };
  return {
    name: 'ac-mpa-routes',
    configureServer(server) {
      server.middlewares.use(redirect);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect);
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        if (!context.server || context.path !== '/src/ui/index.html') return;
        // Discover the tiny boot dependencies before other tabs' module requests fill the queue.
        return ['startup-phase', 'startup-content'].map(name => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', href: `/src/ui/startup/${name}.ts`, fetchpriority: 'high' },
          injectTo: 'head-prepend' as const,
        }));
      },
    },
  };
}

export default defineConfig({
  root: '.',
  optimizeDeps: {
    // 显式列出需要预打包的依赖，让冷启动跳过四个 HTML 入口的扫描。
    noDiscovery: true,
    include: ['jszip'],
  },
  css: {
    // 显式配置，避免首次处理样式时向父目录逐层搜索 PostCSS 配置。
    postcss: { plugins: [] },
  },
  server: {
    port: 5173,
    open: '/',
    watch: { ignored: '**/.test-artifacts/**' },
  },
  preview: {
    port: 4173,
  },
  build: {
    // 与 tsconfig 的 outDir ./dist（tsc 产物）隔离
    outDir: 'web-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        portal: resolveEntry('index.html'),
        game: resolveEntry('src/ui/index.html'),
        editor: resolveEntry('tools/datapack-editor/ui/index.html'),
        infiniteBoard: resolveEntry('prototypes/infinite-board/index.html'),
      },
    },
  },
  plugins: [mpaRoutes(), startupDiagnostics()],
});
