import { performance } from 'node:perf_hooks';
import { normalizePath, type Plugin } from 'vite';
import type { StartupServerTiming, StartupServerWork } from '../src/ui/startup/startup-phase';

const transformKinds: Readonly<Record<string, StartupServerWork['kind'] | undefined>> = {
  'vite:css': 'css',
  'vite:esbuild': 'esbuild',
  'vite:import-analysis': 'imports',
};

export function startupDiagnostics(): Plugin {
  const pending = new Set<Omit<StartupServerWork, 'durationMs'> & { startedAt: number }>();
  const recentSlow: { work: StartupServerWork; endedAt: number }[] = [];

  function begin(path: string, kind: StartupServerWork['kind']): () => void {
    const work = { path, kind, startedAt: performance.now() };
    pending.add(work);
    return () => {
      pending.delete(work);
      const endedAt = performance.now();
      const durationMs = Math.round(endedAt - work.startedAt);
      if (durationMs < 1000) return;
      recentSlow.push({ work: { path, kind, durationMs }, endedAt });
      if (recentSlow.length > 12) recentSlow.shift();
    };
  }

  return {
    name: 'ac-startup-diagnostics',
    apply: 'serve',
    configResolved(config) {
      const prefix = `${normalizePath(config.root)}/`;
      for (const plugin of config.plugins) {
        const kind = transformKinds[plugin.name];
        const hook = plugin.transform;
        if (!kind || !hook) continue;
        const handler = typeof hook === 'function' ? hook : hook.handler;
        const transform: typeof handler = async function (...args) {
          const id = args[1].split('?', 1)[0];
          const path = id.startsWith(prefix) ? `/${id.slice(prefix.length)}` : '';
          if (!path.startsWith('/src/')) return handler.apply(this, args);
          const end = begin(path, kind);
          try { return await handler.apply(this, args); }
          finally { end(); }
        };
        plugin.transform = typeof hook === 'function' ? transform : { ...hook, handler: transform };
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?', 1)[0];
        if (req.method === 'GET' && /^\/(?:src\/|datapack-dev\/|node_modules\/\.vite\/|@vite\/client$)/.test(path)) {
          res.once('close', begin(path, 'request'));
        }
        next();
      });
      server.ws.on('ac:startup-timing', (_data, client) => {
        const now = performance.now();
        const byDuration = (left: StartupServerWork, right: StartupServerWork) => right.durationMs - left.durationMs;
        const active = [...pending]
          .map(({ path, kind, startedAt }) => ({ path, kind, durationMs: Math.round(now - startedAt) }))
          .sort(byDuration);
        const sample: StartupServerTiming = {
          pendingCount: pending.size,
          pending: [...active.filter(work => work.kind !== 'request').slice(0, 3), ...active.filter(work => work.kind === 'request').slice(0, 3)],
          recentSlow: recentSlow.filter(item => now - item.endedAt < 10000).map(item => item.work).sort(byDuration).slice(0, 6),
        };
        client.send('ac:startup-timing', sample);
      });
    },
  };
}
