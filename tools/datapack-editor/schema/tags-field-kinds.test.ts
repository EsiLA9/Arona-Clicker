import { describe, it, expect } from 'vitest';
import { TABLES } from '../schema/datapack.schema';
import { EditorModel } from '../model/editor-model';

describe('tags field kinds after regen', () => {
  it('shows field kinds', () => {
    const t = TABLES.find((x) => x.key === 'tags');
    console.log('TAGSFIELDS:', JSON.stringify(t!.fields.map((f) => ({ key: f.key, kind: f.type.kind, required: f.required })), null, 2));
  });

  it('addRow works on fresh model', () => {
    const m = new EditorModel();
    m.loadDatapack({});
    const idx = m.addRow('tags');
    const row = m.rowsOf('tags')[idx];
    console.log('FRESH ROW:', JSON.stringify(row));
    expect(row.id).toBe('');
    const issues = m.validate();
    console.log('FRESH VALIDATE ERRORS:', JSON.stringify(issues.filter((i) => i.table === 'tags')));
  });
});
