import { describe, expect, it } from 'vitest';
import {
  buildFieldTree,
  collectSemanticSummaries,
  DEFINITION_PROFILE_KINDS,
  hasDefinitionProfile,
  renderDefinitionInspector,
  renderFieldTree,
  type DefinitionInspectorViewModel,
} from '../../src/ui/runtime-editor/codex-details';

describe('Runtime Editor Codex inspector', () => {
  it('维护当前 Registry 与 Runtime 补充源的完整 Def Profile 台账', () => {
    expect(DEFINITION_PROFILE_KINDS).toContain('storyEntries');
    expect(DEFINITION_PROFILE_KINDS).toContain('gearConfig');
    expect(DEFINITION_PROFILE_KINDS).toContain('affectorPacks');
    expect(DEFINITION_PROFILE_KINDS).toContain('triggerDefs');
    expect(new Set(DEFINITION_PROFILE_KINDS).size).toBe(DEFINITION_PROFILE_KINDS.length);
    expect(hasDefinitionProfile('futureDefinitionKind')).toBe(false);
    for (const kind of DEFINITION_PROFILE_KINDS) expect(hasDefinitionProfile(kind)).toBe(true);
  });

  it('renders overview, semantic summaries, and all text through HTML escaping', () => {
    const view: DefinitionInspectorViewModel = {
      definitionKind: 'Spot',
      fullId: 'mod:spot:<unsafe>',
      title: '<Unsafe title>',
      description: 'Description <script>alert(1)</script>',
      source: { modId: 'mod<&', version: '1.0"' },
      status: '当前 Runtime',
      summaryFields: [{ label: '额外字段', value: '<unsafe>' }],
      definition: {
        condition: { target: 'resource', key: '<credit>', comparator: '>=', value: 10 },
        effects: [{ op: 'addResource', target: 'base:resource:credit', value: 5 }],
        amount: { type: 'add', left: { type: 'const', value: 1 }, right: { type: 'const', value: 2 } },
        purchaseOptions: [{ id: 'buy', label: '<方案>', costs: [{ type: 'resource', resourceId: 'credit', amount: { type: 'const', value: 5 } }] }],
        revealTriggers: [{ reveal: 'utility', condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } }],
        unknownField: '<keep me>',
      },
    };

    const html = renderDefinitionInspector(view, 'overview', {
      nameOf: (type, id) => type === 'resource' && id === 'base:resource:credit' ? '信用点' : id,
      formatNumber: value => `#${value}`,
    });
    expect(html).toContain('data-codex-inspector-panel="overview"');
    expect(html).toContain('condition');
    expect(html).toContain('effect');
    expect(html).toContain('value');
    expect(html).toContain('payment');
    expect(html).toContain('reveal');
    expect(html).toContain('&lt;Unsafe title&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('详情页签');
    expect(html).toContain('条件');
    expect(html).toContain('效果');
    expect(html).toContain('支付');
    expect(html).toContain('揭示用途');
    expect(html).toContain('信用点');
    expect(html).toContain('$.revealTriggers[0]');
  });

  it('keeps unknown fields, paths, types, cycles, and getter boundaries in the raw tree', () => {
    const source: Record<string, unknown> = { '<unknown>': { nested: true }, list: ['x', 2] };
    source.self = source;
    Object.defineProperty(source, 'lazy', { enumerable: true, get: () => '<should not run>' });

    const tree = buildFieldTree(source);
    const unknown = tree.children.find(child => child.key === '<unknown>');
    const self = tree.children.find(child => child.key === 'self');
    const lazy = tree.children.find(child => child.key === 'lazy');
    expect(unknown?.path).toBe('$["<unknown>"]');
    expect(unknown?.children[0]).toMatchObject({ path: '$["<unknown>"].nested', type: 'boolean' });
    expect(self).toMatchObject({ type: 'object', truncation: 'cycle' });
    expect(lazy).toMatchObject({ truncation: 'getter', displayValue: '[Getter]' });

    const html = renderFieldTree(source);
    expect(html).toContain('$[&quot;&lt;unknown&gt;&quot;]');
    expect(html).toContain('boolean');
    expect(html).toContain('[Getter]');
    expect(html).not.toContain('<should not run>');
  });

  it('reports resolved, missing, and ambiguous references without adding write affordances', () => {
    const view: DefinitionInspectorViewModel = {
      definitionKind: 'Story',
      fullId: 'mod:story:root',
      definition: { next: 'mod:story:missing' },
      references: [
        { path: '$.next', target: { definitionKind: 'Story', fullId: 'mod:story:ok', entryKey: 'Story:mod%3Astory%3Aok' }, status: 'resolved' },
        { path: '$.missing', target: { definitionKind: 'Story', fullId: 'mod:story:missing' }, status: 'missing' },
        {
          path: '$.choice',
          target: { definitionKind: 'Story', fullId: 'mod:story:choice' },
          status: 'ambiguous',
          candidates: [
            { definitionKind: 'Story', fullId: 'a:story:choice', entryKey: 'Story:a%3Astory%3Achoice' },
            { definitionKind: 'Story', fullId: 'b:story:choice', entryKey: 'Story:b%3Astory%3Achoice' },
          ],
        },
      ],
    };

    const html = renderDefinitionInspector(view, 'relations');
    expect(html).toContain('已解析');
    expect(html).toContain('缺失');
    expect(html).toContain('歧义');
    expect(html).toContain('a:story:choice');
    expect((html.match(/data-codex-reference-target=/g) ?? [])).toHaveLength(3);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-controls="runtime-editor-codex-inspector-panel-relations"');
    expect(html).toContain('aria-labelledby="runtime-editor-codex-inspector-tab-relations"');
    expect(html).toContain('data-codex-reference-target="Story:mod%3Astory%3Aok"');
    expect(html).not.toContain('<button type="submit"');
    expect(html).not.toContain('data-codex-write');
  });

  it('在概览提供紧凑的相关组分入口，并保持缺失目标为只读诊断', () => {
    const view: DefinitionInspectorViewModel = {
      definitionKind: 'Spot',
      fullId: 'mod:spot:source',
      definition: {},
      references: [
        { relation: '所属 Area', target: { definitionKind: 'areas', fullId: 'mod:area:main', label: '主区域', entryKey: 'areas:mod%3Aarea%3Amain' }, status: 'resolved' },
        { relation: '目标 Story', target: { definitionKind: 'stories', fullId: 'mod:story:missing' }, status: 'missing' },
      ],
    };
    const html = renderDefinitionInspector(view, 'overview');
    expect(html).toContain('相关组分');
    expect(html).toContain('data-codex-reference-target="areas:mod%3Aarea%3Amain"');
    expect(html).toContain('主区域');
    expect(html).toContain('data-codex-related-status="missing"');
    expect(html).not.toContain('data-codex-write');
  });

  it('按目标聚合相关组分，但保留跨字段和跨方向的引用路径', () => {
    const view: DefinitionInspectorViewModel = {
      definitionKind: 'inits',
      fullId: 'addition-test:init:observatory',
      definition: {},
      references: [
        {
          relation: '资源',
          path: '$.purchaseCost[0].resourceId',
          confidence: 'declared',
          target: { definitionKind: 'resourceDisplays', fullId: 'base:resource:pyroxene', label: '青辉石（测试包）', entryKey: 'resourceDisplays:base%3Aresource%3Apyroxene' },
          status: 'resolved',
        },
        {
          relation: '引用',
          path: '$.revealTriggers[0].condition.conditions[0].key',
          confidence: 'inferred',
          target: { definitionKind: 'resourceDisplays', fullId: 'base:resource:pyroxene', label: '青辉石（测试包）', entryKey: 'resourceDisplays:base%3Aresource%3Apyroxene' },
          status: 'resolved',
        },
      ],
      reverseReferences: [{
        relation: '所属 Init',
        path: '$.initId',
        confidence: 'declared',
        target: { definitionKind: 'inits', fullId: 'addition-test:init:observatory', label: '扩展测试观测线', entryKey: 'inits:addition-test%3Ainit%3Aobservatory' },
        status: 'resolved',
      }],
    };
    const overviewHtml = renderDefinitionInspector(view, 'overview');

    expect(overviewHtml).toContain('相关组分');
    expect(overviewHtml).not.toContain('2 条引用路径');
    expect(overviewHtml).not.toContain('$.purchaseCost[0].resourceId');
    expect(overviewHtml).not.toContain('$.revealTriggers[0].condition.conditions[0].key');
    expect((overviewHtml.match(/data-codex-related-target="resourceDisplays:base:resource:pyroxene"/g) ?? [])).toHaveLength(1);

    const relationsHtml = renderDefinitionInspector(view, 'relations');
    expect(relationsHtml).toContain('$.purchaseCost[0].resourceId');
    expect(relationsHtml).toContain('$.revealTriggers[0].condition.conditions[0].key');
    expect(relationsHtml).toContain('data-codex-reference-confidence="declared"');
    expect(relationsHtml).toContain('data-codex-reference-confidence="inferred"');
    expect((relationsHtml.match(/base:resource:pyroxene/g) ?? []).length).toBeGreaterThan(0);
  });

  it('does not mutate a frozen view or source definition while collecting summaries', () => {
    const definition = Object.freeze({ value: Object.freeze({ type: 'const', value: 3 }) });
    const view = Object.freeze({
      definitionKind: 'Value',
      fullId: 'mod:value:constant',
      definition,
    }) as DefinitionInspectorViewModel;

    expect(() => collectSemanticSummaries(view.definition)).not.toThrow();
    const rawHtml = renderDefinitionInspector(view, 'raw');
    expect(rawHtml).toContain('data-codex-copy-raw');
    expect(rawHtml).toContain('data-codex-raw-json');
    expect(rawHtml).toContain('aria-label="复制当前 Def 的原始 JSON"');
    expect(() => renderDefinitionInspector(view, 'raw')).not.toThrow();
    expect(definition).toEqual({ value: { type: 'const', value: 3 } });
  });

  it('语义摘要按实际效果字段生成，并移除已废弃的 Manager 节点', () => {
    const summaries = collectSemanticSummaries({
      effects: [
        { op: 'triggerStory', target: 'base:activestory:opening', value: 0 },
        { op: 'addAffectionExp', target: 'Arona', value: 5 },
        { op: 'setEntityPresentation', target: 'variant:Arona', value: { optionId: 'alternate' } },
        { op: 'setTheme', target: '', value: { colorGroupId: 'base:colorgroup:coral' } },
        { op: 'setManager', target: 'base:spot:legacy', value: 'Arona' },
      ],
      condition: { target: 'manager', key: 'base:spot:legacy', comparator: '==', value: 1 },
      amount: { type: 'mul', left: { type: 'add', left: { type: 'const', value: 1 }, right: { type: 'const', value: 2 } }, right: { type: 'const', value: 3 } },
    });
    const text = summaries.map(summary => summary.text).join('；');
    expect(text).toContain('触发剧情 base:activestory:opening');
    expect(text).toContain('Arona 好感 +5');
    expect(text).toContain('切换实体表现：variant:Arona → alternate');
    expect(text).toContain('临时主题：色彩组 base:colorgroup:coral');
    expect(text).toContain('(1+2)×3');
    expect(text).not.toContain('Manager');
  });
});
