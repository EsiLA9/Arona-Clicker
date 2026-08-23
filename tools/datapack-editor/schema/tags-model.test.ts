import { describe, it, expect } from 'vitest';
import { EditorModel } from '../model/editor-model';

const sample = { tags: [{ id: 'office', name: '办公室', description: '办公主题' }] };

describe('tags model addRow', () => {
  it('addRow on tags creates a row with defaults', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    expect(m.rowsOf('tags')).toHaveLength(1);
    const idx = m.addRow('tags');
    expect(idx).toBe(1);
    expect(m.rowsOf('tags')).toHaveLength(2);
    const row = m.rowAt('tags', idx);
    console.log('ADDED TAG ROW:', JSON.stringify(row));
    expect(row.id).toBe('');
    expect(row.name).toBe('');
    expect(row.description).toBe('');
  });

  it('validate does not throw on tags table', () => {
    const m = new EditorModel();
    m.loadDatapack(sample);
    m.addRow('tags');
    let err: unknown = null;
    try {
      m.validate();
    } catch (e) {
      err = e;
    }
    console.log('VALIDATE THREW:', err);
    expect(err).toBeNull();
  });
});
