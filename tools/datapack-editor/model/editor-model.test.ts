/**
 * editor-model.test.ts —— EditorModel 数据模型单测
 */
import { describe, expect, it } from 'vitest';
import { EditorModel } from './editor-model';

const spot = (id: string, name: string) => ({
  id,
  areaId: 'base:area:test',
  name,
  description: '测试设施',
  baseCost: { type: 'const', value: 10 },
  baseCostResource: 'base:resource:credit',
  baseYield: { type: 'const', value: 5 },
  baseYieldResource: 'base:resource:credit',
  baseCapacity: 1,
});

const sample = {
  spots: [spot('base:spot:alpha', 'A'), spot('base:spot:beta', 'B')],
  extras: { 'meta/author': { t: 'str', v: 'admin' } },
  triggerDefs: [{ id: 'base:trigger:t1', on: { kind: 'tick', every: 60 } }],
};

describe('EditorModel', () => {
  it('加载与导出往返一致', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    expect(m.toDatapack()).toEqual(sample);
  });

  it('新增行带默认值并可设置值', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    const idx = m.addRow('spots');
    expect(idx).toBe(2);
    expect(m.rowsOf('spots')).toHaveLength(3);
    m.setValue('spots', idx, ['name'], 'C');
    expect(m.rowAt('spots', idx).name).toBe('C');
  });

  it('对从未加载数据的空表（tags）addRow 仍能创建并持久化', () => {
    const m = new EditorModel();
    m.loadDatapack({}); // 不含任何表数据
    const idx = m.addRow('tags');
    expect(idx).toBe(0);
    expect(m.rowsOf('tags')).toHaveLength(1);
    expect(m.rowAt('tags', 0)).toEqual({ id: '', name: '', description: '' });
    // 导出应包含新行，undo 应移除
    expect(m.toDatapack().tags).toEqual([{ id: '', name: '', description: '' }]);
    expect(m.undo()).toBe(true);
    expect(m.rowsOf('tags')).toHaveLength(0);
  });

  it('divider 横条不进入数据行（不参与 JSON 合并）', () => {
    const m = new EditorModel();
    m.loadDatapack({ inits: [{ id: 'base:init:test', name: '测试', description: '' }] });
    const idx = m.addRow('inits');
    const row = m.rowAt('inits', idx);
    // schema 中存在 divider，但数据行与导出 JSON 中无任何痕迹
    expect(Object.keys(row)).not.toContain('__divider');
    expect(JSON.stringify(m.toDatapack())).not.toContain('__divider');
  });

  it('删除 / 复制 / 移动行', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    m.duplicateRow('spots', 0);
    // [alpha, alpha', beta]
    expect(m.rowsOf('spots')).toHaveLength(3);
    expect(m.rowAt('spots', 1).id).toBe('base:spot:alpha');
    m.moveRow('spots', 2, 0);
    // [beta, alpha, alpha']
    expect(m.rowAt('spots', 0).id).toBe('base:spot:beta');
    expect(m.rowAt('spots', 1).id).toBe('base:spot:alpha');
    m.removeRow('spots', 1);
    // [beta, alpha']
    expect(m.rowsOf('spots')).toHaveLength(2);
    expect(m.rowAt('spots', 0).id).toBe('base:spot:beta');
  });

  it('嵌套路径写入（不影响其他字段）', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    m.setValue('spots', 0, ['baseCost', 'value'], 99);
    expect(m.rowAt('spots', 0).baseCost).toEqual({ type: 'const', value: 99 });
    expect(m.rowAt('spots', 0).name).toBe('A');
  });

  it('record 表读写', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    expect(m.hasRecordKey('extras', 'meta/author')).toBe(true);
    m.setRecordKey('extras', 'meta/author', { t: 'str', v: 'editor' });
    expect(m.recordOf('extras')['meta/author']).toEqual({ t: 'str', v: 'editor' });
    m.removeRecordKey('extras', 'meta/author');
    expect(m.hasRecordKey('extras', 'meta/author')).toBe(false);
  });

  it('撤销 / 重做（逐层）', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    m.addRow('spots'); // 3 行
    m.setValue('spots', 2, ['name'], 'X');
    expect(m.rowAt('spots', 2).name).toBe('X');
    expect(m.undo()).toBe(true); // 撤销 setValue
    expect(m.rowsOf('spots')).toHaveLength(3);
    expect(m.undo()).toBe(true); // 撤销 addRow
    expect(m.rowsOf('spots')).toHaveLength(2);
    expect(m.redo()).toBe(true); // 恢复 addRow
    expect(m.rowsOf('spots')).toHaveLength(3);
    expect(m.redo()).toBe(true); // 恢复 setValue
    expect(m.rowAt('spots', 2).name).toBe('X');
    expect(m.undo()).toBe(true);
    expect(m.rowAt('spots', 2).name).toBe('');
  });

  it('加载后历史清空', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    m.addRow('spots');
    m.loadDatapack(sample);
    expect(m.canUndo()).toBe(false);
  });

  it('校验真实工作集 0 error', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    const errors = m.validate().filter((e) => e.severity === 'error');
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  it('onChange 订阅与退订', () => {
    const m = new EditorModel();
    const calls: string[] = [];
    const off = m.onChange((r) => calls.push(r));
    m.addRow('spots');
    off();
    m.addRow('spots');
    expect(calls).toHaveLength(1);
  });
});
