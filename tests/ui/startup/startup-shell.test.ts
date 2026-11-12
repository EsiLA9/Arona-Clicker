// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

const html = readFileSync('src/ui/index.html', 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)!;
const body = /<body>([\s\S]*?)<\/body>/.exec(html)![1];
let listeners: MockInstance<Window['addEventListener']>;
let restartShell: (navigationOffset?: number) => void;
let resourceEntries: Partial<PerformanceResourceTiming>[];
let shell: {
  begin(id: string, label: string, detail?: string): void;
  work(id: string): void;
  update(label: string, detail?: string): void;
  complete(id: string): void;
  warn(message: string, detail?: string): void;
  fail(phase: string, error: unknown): void;
  finish(): void;
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem('acprogram_startup_logs');
  resourceEntries = [];
  listeners = vi.spyOn(window, 'addEventListener');
  const mount = () => { document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, ''); };
  // Match parser order: the static shell must exist before its script queries or binds it.
  if (script.index! > html.indexOf('<section id="startup-shell"')) mount();
  restartShell = (navigationOffset = 0) => {
    const start = Date.now();
    new Function('window', 'document', 'performance', 'HTMLScriptElement', 'navigator', script[1])(
      window, document, { now: () => Date.now() - start + navigationOffset, mark: vi.fn(), measure: vi.fn(), getEntriesByType: (type: string) => type === 'resource' ? resourceEntries : [] }, HTMLScriptElement, navigator,
    );
    shell = window.__startupShell!;
  };
  restartShell();
  if (script.index! < html.indexOf('<section id="startup-shell"')) mount();
  shell = (window as unknown as { __startupShell: typeof shell }).__startupShell;
});

afterEach(() => {
  shell.finish();
  for (const [type, listener, options] of listeners.mock.calls) window.removeEventListener(type, listener, options);
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('静态载入界面', () => {
  it('报告拆分同源资源的请求前等待、DNS、连接与响应，不导出查询参数', () => {
    const timing = { startTime: 100, duration: 1000, requestStart: 900, responseStart: 1000, responseEnd: 1100,
      domainLookupStart: 100, domainLookupEnd: 120, connectStart: 120, connectEnd: 170,
      workerStart: 0, nextHopProtocol: 'http/1.1', transferSize: 300 };
    resourceEntries = [
      { ...timing, name: `${window.location.origin}/slow.ts?private=value` },
      { ...timing, name: 'https://unrelated.example/private' },
    ];
    vi.advanceTimersByTime(2000);
    expect(window.__startupLog!.report()?.resources).toEqual([
      expect.objectContaining({ path: '/slow.ts', preRequestMs: 800, dnsMs: 20, connectMs: 50, responseWaitMs: 100, downloadMs: 100 }),
    ]);
    shell.finish();
    const saved = JSON.parse(localStorage.getItem('acprogram_startup_logs')!)[0];
    expect(saved.resources).toHaveLength(1);
    expect(JSON.stringify(saved.resources)).not.toContain('private');
  });

  it('占比包含启动壳脚本执行之前的导航耗时', () => {
    shell.finish();
    restartShell(3000);
    vi.advanceTimersByTime(1000);
    const report = window.__startupLog!.report()!;
    expect(report.totalMs).toBe(4000);
    expect(report.phases.find(phase => phase.id === 'document')).toMatchObject({ durationMs: 3000, percent: 75 });
    expect(report.phases.find(phase => phase.id === 'entry')).toMatchObject({ durationMs: 1000, percent: 25 });
  });

  it('主模块尚未执行时也记录前序等待，并在刷新后保留中断现场', () => {
    vi.advanceTimersByTime(5000);
    const log = window.__startupLog!;
    expect(log.report()?.phases.find(phase => phase.id === 'entry')).toMatchObject({ state: 'running', durationMs: 5000 });
    window.dispatchEvent(new Event('pagehide'));
    const saved = JSON.parse(localStorage.getItem('acprogram_startup_logs')!);
    expect(saved[0]).toMatchObject({ state: 'interrupted', totalMs: 5000 });
    expect(saved[0].phases.find((phase: { id: string }) => phase.id === 'entry').durationMs).toBe(5000);
  });

  it('以导航总耗时计算互不重叠的阶段占比，区分绘制等待和实际工作', () => {
    vi.advanceTimersByTime(200);
    shell.begin('modules', '装载模块');
    vi.advanceTimersByTime(50);
    shell.work('modules');
    vi.advanceTimersByTime(200);
    shell.complete('modules');
    vi.advanceTimersByTime(50);
    shell.begin('runtime', '创建运行环境');
    shell.work('runtime');
    vi.advanceTimersByTime(100);
    shell.complete('runtime');
    shell.finish();
    const report = window.__startupLog!.report()!;
    expect(report).toMatchObject({ state: 'complete', totalMs: 600, otherMs: 50 });
    expect(report.phases.find(phase => phase.id === 'modules')).toMatchObject({ durationMs: 250, beforeWorkMs: 50, workMs: 200 });
    expect(report.phases.reduce((sum, phase) => sum + phase.percent, report.otherPercent)).toBeCloseTo(100, 1);
    vi.advanceTimersByTime(5000);
    expect(window.__startupLog!.report()!.totalMs).toBe(600);
  });

  it('保留失败时的并行模块状态，迟到回调不改写失败快照', () => {
    const log = window.__startupLog!;
    shell.begin('modules', '装载模块');
    shell.work('modules');
    log.taskBegin('Base');
    log.taskBegin('Styles');
    vi.advanceTimersByTime(500);
    log.taskEnd('Base', new Error('module rejected'));
    shell.fail('装载模块', new Error('module rejected'));
    const report = log.report();
    vi.advanceTimersByTime(1000);
    log.taskEnd('Styles');
    shell.complete('modules');
    expect(log.report()).toEqual(report);
    expect(report?.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'Base', state: 'error', durationMs: 500 }),
      expect.objectContaining({ id: 'Styles', state: 'running', durationMs: 500 }),
    ]));
  });

  it('诊断持久化失败不会中断启动，复制结果包含耗时报告', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    expect(() => { shell.begin('runtime', '创建运行环境'); shell.complete('runtime'); }).not.toThrow();
    expect(window.__startupLog!.report()?.storageError).toContain('quota');
    document.querySelector<HTMLButtonElement>('#startup-copy')!.click();
    await Promise.resolve();
    expect(copy.mock.calls[0][0]).toContain('"totalMs"');
  });

  it('跨启动保留最近三次日志，表格查询不会修改现场', () => {
    shell.finish();
    for (const duration of [100, 200, 300]) {
      restartShell();
      vi.advanceTimersByTime(duration);
      shell.finish();
    }
    const log = window.__startupLog!;
    expect(log.report(1)?.totalMs).toBe(200);
    expect(log.report(2)?.totalMs).toBe(100);
    expect(log.report(3)).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('acprogram_startup_logs')!)).toHaveLength(3);
    const before = log.report();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const table = vi.spyOn(console, 'table').mockImplementation(() => undefined);
    expect(log.print()).toEqual(before);
    expect(table).toHaveBeenCalled();
    expect(log.report()).toEqual(before);
  });

  it('诊断缓存损坏时仍可启动并生成新报告', () => {
    shell.finish();
    localStorage.setItem('acprogram_startup_logs', 'broken JSON');
    expect(restartShell).not.toThrow();
    expect(window.__startupLog!.report()?.storageError).toBeTruthy();
    shell.begin('modules', '模块');
    shell.finish();
    expect(window.__startupLog!.report()?.state).toBe('complete');
  });

  it('显示流程、当前内容与真实计时，只更新已有节点', () => {
    const row = document.querySelector('[data-startup-phase="modules"]')!;
    const detail = document.querySelector('#startup-detail');
    shell.begin('modules', '装载模块', '正在等待游戏内容与界面样式');
    shell.update('已就绪 1 / 3 项', '已就绪：游戏内容\n仍在等待：样式、数据服务');
    vi.advanceTimersByTime(3250);
    expect(document.querySelector('#startup-elapsed')?.textContent).toContain('3 秒');
    expect(document.querySelector('#startup-slow')?.hasAttribute('hidden')).toBe(false);
    expect(detail?.textContent).toContain('仍在等待：样式、数据服务');
    expect(document.querySelector('#startup-detail')).toBe(detail);
    expect(document.querySelector('[data-startup-phase="modules"]')).toBe(row);
    expect(row.getAttribute('aria-current')).toBe('step');
    shell.complete('modules');
    shell.begin('runtime', '创建运行环境', '装配游戏服务');
    expect(row.getAttribute('data-state')).toBe('complete');
    expect(row.hasAttribute('aria-current')).toBe(false);
    expect(document.querySelector<HTMLProgressElement>('#startup-progress')?.value).toBe(1);
  });

  it('保留降级步骤与详细警告，并用真实换行复制诊断', async () => {
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    shell.begin('pack-library', '恢复数据包', '读取本机包库');
    shell.warn('包库不可用', '本次继续使用内置内容');
    shell.begin('development-packs', '检查开发包', '准备扫描');
    expect(document.querySelector('[data-startup-phase="pack-library"]')?.getAttribute('data-state')).toBe('warning');
    expect(document.querySelector('#startup-warning')?.textContent).toContain('包库不可用');
    document.querySelector<HTMLButtonElement>('#startup-copy')!.click();
    await Promise.resolve();
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('包库不可用\n本次继续使用内置内容'));
    expect(copy.mock.calls[0][0].split('\n\n{')[0]).not.toContain('\\n');
  });

  it('失败后保留当前内容、失败步骤和未执行步骤，停止慢阶段提示', () => {
    shell.begin('content-apply', '校验游戏内容', '<img src=x> · 12 个剧情');
    shell.fail('校验游戏内容', new Error('引用不存在'));
    shell.update('另一个模块迟到的完成消息', '不应覆盖失败现场');
    vi.advanceTimersByTime(4000);
    expect(document.querySelector('[data-startup-phase="content-apply"]')?.getAttribute('data-state')).toBe('error');
    expect(document.querySelector('[data-startup-phase="ui-mount"]')?.getAttribute('data-state')).toBe('pending');
    expect(document.querySelector('#startup-detail')?.textContent).toContain('<img src=x>');
    expect(document.querySelector('#startup-detail img')).toBeNull();
    expect(document.querySelector('#startup-diagnostics')?.textContent).toContain('引用不存在');
    expect(document.querySelector('#startup-slow')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('#startup-status')?.getAttribute('aria-busy')).toBe('false');
  });

  it('入口模块失败仍能标出失败步骤和诊断', () => {
    const module = document.createElement('script');
    module.type = 'module';
    document.body.append(module);
    module.dispatchEvent(new Event('error'));
    expect(document.querySelector('#startup-shell')?.getAttribute('data-state')).toBe('error');
    expect(document.querySelector('[data-startup-phase="modules"]')?.getAttribute('data-state')).toBe('error');
    expect(document.querySelector('#startup-diagnostics')?.textContent).toContain('加载游戏入口');
  });

  it('入口执行异常通过相同的失败反馈停止等待', () => {
    shell.begin('modules', '装载模块', '读取入口');
    window.dispatchEvent(new ErrorEvent('error', { message: '入口执行异常' }));
    expect(document.querySelector('#startup-shell')?.getAttribute('data-state')).toBe('error');
    expect(document.querySelector('#startup-diagnostics')?.textContent).toContain('入口执行异常');
  });
});
