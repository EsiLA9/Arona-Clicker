import { describe, it } from 'vitest';
import { TABLES } from './datapack.schema.ts';

describe('tags full dump', () => {
  it('dumps tags table', () => {
    const t = TABLES.find((x) => x.key === 'tags');
    console.log('=== TAGS TABLE DUMP ===');
    console.log(JSON.stringify(t, null, 2));
    console.log('=== END DUMP ===');
  });
});
