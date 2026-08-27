import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

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
    const pathname = (req.url ?? '').split('?')[0];
    const target = targets[pathname];
    if (!target) return next();
    res.statusCode = 302;
    res.setHeader('Location', target);
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
  };
}

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    open: '/',
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
      },
    },
  },
  plugins: [mpaRoutes()],
});
