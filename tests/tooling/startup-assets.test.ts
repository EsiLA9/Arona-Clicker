import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { createServer, type ViteDevServer } from 'vite';

describe('startup asset delivery', () => {
  let server: ViteDevServer;
  let origin: string;
  beforeAll(async () => {
    server = await createServer({
      configFile: 'vite.config.ts',
      cacheDir: '.test-artifacts/vite-startup-assets-test',
      server: { host: '127.0.0.1', port: 5374, open: false, watch: { ignored: '**/.test-artifacts/**' } },
    });
    await server.listen();
    origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`;
  }, 30000);
  afterAll(async () => { await server?.close(); });

  async function getModule(path: string): Promise<string> {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(25000) }).catch(error => {
      throw new Error(`Vite did not serve ${path}: ${String(error)}`);
    });
    expect(response.ok, path).toBe(true);
    return response.text();
  }

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

  it('keeps shared styles in the startup module and loads editor styles separately', async () => {
    const main = await getModule('/src/ui/main.ts');
    const styles = [...main.matchAll(/import\(["']([^"']+\.css)["']\)/g)].map(match => match[1]);
    expect(styles).toEqual(['/src/ui/css/game.css']);
    const css = await getModule(`${styles[0]}?import`);
    expect(css).toContain('--muted-on-panel');
    expect(css).toContain('.choice-option');
    expect(css).toContain('.condition-reference-picker');
    expect(css).toContain('.console-background-layer');
    expect(css.indexOf('--muted-on-panel')).toBeLessThan(css.indexOf('.console-background-layer'));
    expect(css).not.toMatch(/import ["']\/src\/ui\/css\//);
    expect(css).not.toContain('.story-editor-list-content');
    expect(css).not.toContain('.runtime-editor-panel');
    expect(css).not.toContain('.runtime-editor-codex__search');

    const entries = await getModule('/src/ui/utilities/editor-styles.ts');
    expect(entries).toContain('import("/src/ui/css/story-editor.css")');
    expect(entries).toContain('import("/src/ui/css/runtime-editor.css")');
    const story = await getModule('/src/ui/css/story-editor.css?import');
    const runtime = await getModule('/src/ui/css/runtime-editor.css?import');
    expect(story).toContain('.story-editor-list-content');
    expect(runtime).toContain('.runtime-editor-panel');
    expect(runtime).toContain('.runtime-editor-codex__search');
  }, 30000);

  it('uses the pre-bundled JSZip in both archive readers and the shared writer', async () => {
    for (const path of [
      '/src/data-services/datapack/zip-loader.ts',
      '/src/data-services/datapack/pack-parser.ts',
      '/src/data-services/archive/archive-writer.ts',
    ]) {
      const code = await getModule(path);
      expect(code).toMatch(/\/deps\/jszip\.js\?v=/);
    }
  }, 30000);
});
