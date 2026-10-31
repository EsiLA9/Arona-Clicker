import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createServer, type ViteDevServer } from 'vite';

describe('startup asset delivery', () => {
  let server: ViteDevServer;
  beforeAll(async () => {
    server = await createServer({
      configFile: 'vite.config.ts',
      cacheDir: '.test-artifacts/vite-startup-assets-test',
      server: { middlewareMode: true, preTransformRequests: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
  });
  afterAll(async () => { await server?.close(); });

  it('preloads critical helpers before the main module is discovered', async () => {
    const html = await server.transformIndexHtml('/src/ui/index.html', readFileSync('src/ui/index.html', 'utf8'));
    for (const helper of ['startup-phase', 'startup-content']) {
      const preload = html.indexOf(`href="/src/ui/startup/${helper}.ts"`);
      expect(preload).toBeGreaterThan(-1);
      expect(preload).toBeLessThan(html.indexOf('src="./main.ts"'));
    }
    const portal = await server.transformIndexHtml('/', readFileSync('index.html', 'utf8'));
    expect(portal).not.toContain('/src/ui/startup/');
  }, 30000);

  it('delivers startup CSS in one module with both early and late styles intact', async () => {
    const main = (await server.transformRequest('/src/ui/main.ts'))!.code;
    const styles = [...main.matchAll(/import\(["']([^"']+\.css)["']\)/g)].map(match => match[1]);
    expect(styles).toEqual(['/src/ui/css/game.css']);
    const css = (await server.transformRequest(styles[0]))!.code;
    expect(css).toContain('--muted-on-panel');
    expect(css).toContain('.choice-option');
    expect(css).toContain('.console-background-layer');
    expect(css.indexOf('--muted-on-panel')).toBeLessThan(css.indexOf('.console-background-layer'));
    expect(css).not.toMatch(/import ["']\/src\/ui\/css\//);
  }, 30000);
});
