import { describe, expect, it, vi } from 'vitest';
import { runStartupPhase } from '../../../src/ui/startup/startup-phase';

describe('启动阶段编排', () => {
  it('先显示阶段并让出绘制机会，再执行工作并记录完成', async () => {
    const events: string[] = [];
    const reporter = {
      begin: vi.fn((id: string, _label: string, detail?: string) => events.push(`begin:${id}:${detail}`)),
      complete: vi.fn((id: string) => events.push(`complete:${id}`)),
      work: vi.fn((id: string) => events.push(`work-start:${id}`)),
    };
    const result = await runStartupPhase(
      reporter,
      'packs',
      '正在检查数据包…',
      async () => { events.push('paint'); },
      async () => { events.push('work'); return 'ready'; },
      '正在读取 base 的内容清单',
    );

    expect(events).toEqual(['begin:packs:正在读取 base 的内容清单', 'paint', 'work-start:packs', 'work', 'complete:packs']);
    expect(result).toBe('ready');
  });

  it('阶段失败时保留异常并停止后续阶段完成信号', async () => {
    const error = new Error('registry rejected the pack');
    const reporter = { begin: vi.fn(), complete: vi.fn() };
    const laterStage = vi.fn();

    await expect(runStartupPhase(
      reporter,
      'content-apply',
      '正在校验并装载游戏内容…',
      async () => undefined,
      () => { throw error; },
    ).then(() => laterStage())).rejects.toBe(error);

    expect(reporter.begin).toHaveBeenCalledWith('content-apply', '正在校验并装载游戏内容…', undefined);
    expect(reporter.complete).not.toHaveBeenCalled();
    expect(laterStage).not.toHaveBeenCalled();
  });
});
