import { describe, expect, it } from 'vitest';
import {
  buildFieldTree,
  collectSemanticSummaries,
  DEFINITION_PROFILE_KINDS,
  hasDefinitionProfile,
  labelInspectorReference,
  profileSummaryFields,
  renderDefinitionInspector,
  renderFieldTree,
  type DefinitionInspectorViewModel,
} from '../../src/ui/runtime-editor/codex-details';
import type {
  RuntimeContentDefinitionDetail,
  RuntimeContentRawValue,
} from '../../src/data-services/contracts/runtime-content-browser';

function detailForProfile(definitionKind: string, raw: RuntimeContentRawValue): RuntimeContentDefinitionDetail {
  return {
    summary: {
      ref: { definitionKind, fullId: 'profile-test' },
      kind: { kind: definitionKind, label: definitionKind, group: 'rules', shape: 'map', derived: false, present: true, entryCount: 1 },
      label: definitionKind,
      diagnosticCount: 0,
      searchableText: '',
    },
    raw,
    fields: [],
    outgoingReferences: [],
    incomingReferences: [],
  };
}

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

  it('renders overview text through HTML escaping without repeating the shell identity title', () => {
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
    expect(html).not.toContain('Unsafe title');
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

  it('技术详情展示 resolved、missing、ambiguous 出向诊断且不提供写入入口', () => {
    const view: DefinitionInspectorViewModel = {
      definitionKind: 'Story',
      fullId: 'mod:story:root',
      definition: { next: 'mod:story:missing' },
      references: [
        {
          path: '$.next',
          target: { definitionKind: 'Story', fullId: 'mod:story:ok', entryKey: 'Story:mod%3Astory%3Aok' },
          status: 'resolved',
          candidates: [{ definitionKind: 'Story', fullId: 'ignored:story:ok' }],
        },
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

    const html = renderDefinitionInspector(view, 'raw');
    expect(html).toContain('已解析');
    expect(html).toContain('缺失');
    expect(html).toContain('歧义');
    expect(html).toContain('a:story:choice');
    expect((html.match(/data-codex-reference-target=/g) ?? [])).toHaveLength(3);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('data-codex-inspector-tab="raw"');
    expect(html).toContain('data-codex-inspector-panel="raw"');
    expect(html).toContain('aria-controls="runtime-editor-codex-inspector-panel-raw"');
    expect(html).toContain('aria-labelledby="runtime-editor-codex-inspector-tab-raw"');
    expect(html).toContain('data-codex-reference-target="Story:mod%3Astory%3Aok"');
    expect(html).not.toContain('ignored:story:ok');
    expect((html.match(/<span>候选：<\/span>/g) ?? [])).toHaveLength(1);
    expect(html).not.toContain('<button type="submit"');
    expect(html).not.toContain('data-codex-write');
  });

  it('资料引用字段可直接定位，出向诊断不混入资料页', () => {
    const areaTarget = { definitionKind: 'areas', fullId: 'mod:area:main', label: '主区域', entryKey: 'areas:mod%3Aarea%3Amain' };
    const view: DefinitionInspectorViewModel = {
      definitionKind: 'Spot',
      fullId: 'mod:spot:source',
      summaryFields: [{ label: '所属 Area', value: areaTarget.fullId, path: '$.areaId' }],
      definition: { areaId: areaTarget.fullId },
      references: [
        { relation: '所属 Area', path: '$.areaId', target: areaTarget, status: 'resolved' },
        { relation: '目标 Story', path: '$.storyId', target: { definitionKind: 'stories', fullId: 'mod:story:missing' }, status: 'missing' },
      ],
    };
    const html = renderDefinitionInspector(view, 'overview');
    expect(html).toContain('data-codex-inspector-panel="overview"');
    expect(html).toContain('所属 Area');
    expect(html).toContain('data-codex-reference-target="areas:mod%3Aarea%3Amain"');
    expect(html).toContain('主区域');
    expect(html).not.toContain('相关组分');
    expect(html).not.toContain('data-codex-reference-status=');
    expect(html).not.toContain('mod:story:missing');
    expect(html).not.toContain('data-codex-write');
  });

  it('出向诊断在技术详情逐条保留，反向路径留在被引用页', () => {
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

    expect(overviewHtml).not.toContain('相关组分');
    expect(overviewHtml).not.toContain('向外引用');
    expect(overviewHtml).not.toContain('入向引用');
    expect(overviewHtml).not.toContain('$.purchaseCost[0].resourceId');
    expect(overviewHtml).not.toContain('$.revealTriggers[0].condition.conditions[0].key');

    const technicalHtml = renderDefinitionInspector(view, 'raw');
    expect(technicalHtml).toContain('向外引用');
    expect(technicalHtml).toContain('$.purchaseCost[0].resourceId');
    expect(technicalHtml).toContain('$.revealTriggers[0].condition.conditions[0].key');
    expect(technicalHtml).toContain('data-codex-reference-confidence="declared"');
    expect(technicalHtml).toContain('data-codex-reference-confidence="inferred"');

    const relationsHtml = renderDefinitionInspector(view, 'relations');
    expect(relationsHtml).toContain('被引用');
    expect(relationsHtml).toContain('$.initId');
    expect(relationsHtml).toContain('data-codex-reference-direction="inbound"');
    expect(relationsHtml).not.toContain('data-codex-reference-direction="outbound"');
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

  it('六类 Operation Profile 使用真实静态字段与集合', () => {
    const cases: readonly [string, RuntimeContentRawValue, readonly string[]][] = [
      ['operationEvents', {
        initId: 'init-a', initialLocationId: 'opening', maxLocationVisits: 4, locationIds: ['opening'],
        tracks: [{ id: 'alarm', initial: 0, min: 0, max: 5 }], actors: [{ id: 'arona' }],
        playerRouteState: { playerCost: 3 }, rewards: { success: { kind: 'resource', resourceId: 'credit', amount: 2 } },
      }, ['所属 Init', '初始位置', '位置访问总上限', '关卡位置', '行动轨道', '参与角色', '路线资源设置', '结果奖励']],
      ['operationLocations', {
        stage: 'scene', interactionSceneId: 'market', activityId: 'festival', costGain: 2, maxVisits: 1,
        enabledActionIds: ['talk'], routeEdges: [{ id: 'exit', targetLocationId: 'end' }], scenes: [{ id: 'market' }],
      }, ['阶段', '互动场景', '活动', '行动力变化', '访问上限', '可用行动', '路线出口', '场景']],
      ['operationActions', {
        allowedParticipantKinds: ['student'], requiredCapabilityIds: ['observe'], reasonIds: ['clue'], tagIds: ['support'],
        cardCondition: { requiredFactIds: ['door-open'] }, cost: { scope: 'actor', resourceId: 'stamina', amount: 1 },
        target: { kind: 'actor', relation: 'otherTeam' }, effects: [{ kind: 'eventTrackDelta', trackId: 'alarm', amount: -1 }],
      }, ['适用参与者', '要求能力', '使用理由', '行动标签', '卡牌条件', '行动费用', '作用目标', '效果']],
      ['studentOperationProfiles', {
        characterId: 'Arona', strategyProfileId: 'cautious', randomSkillRuleId: 'focus',
        candidateActionIds: ['observe'], actionPriorityIds: ['protect'], capabilityIds: ['scout'],
        reasonIds: ['clue'], cardPoolIds: ['starter'],
      }, ['角色', '策略偏好', '随机技能规则', '候选行动', '行动优先级', '能力', '使用理由', '卡池']],
      ['operationStrategyProfiles', {
        biases: [{ tagId: 'support', biasBps: 12000 }],
      }, ['偏好权重']],
      ['operationCardPools', {
        selector: { sceneIds: ['market'], requiredFactIds: ['open'] },
        entries: [{ actionId: 'buy', weight: 100 }],
      }, ['适用条件', '行动权重']],
    ];

    for (const [kind, raw, expectedLabels] of cases) {
      const labels = profileSummaryFields(detailForProfile(kind, raw)).map(field => field.label);
      for (const label of expectedLabels) expect(labels, kind).toContain(label);
    }
    expect(profileSummaryFields(detailForProfile('spots', { areaId: 'area-a', maxLevel: 5 })).map(field => field.label))
      .toContain('所属 Area');
  });

  it('资料保留说明与领域字段，身份去重，未包装字段可折叠完整查看', () => {
    const view: DefinitionInspectorViewModel = {
      definitionKind: 'spots',
      fullId: 'spot-a',
      title: '观测站',
      description: '位于高处的观察地点。',
      summaryFields: [{ label: '所属 Area', value: 'area-a', path: '$.areaId' }],
      definition: { id: 'spot-a', name: '观测站', description: '位于高处的观察地点。', areaId: 'area-a', unwrapped: { note: '完整保留' } },
    };
    const html = renderDefinitionInspector(view, 'overview');

    expect(html).toContain('data-codex-inspector-tab="overview"');
    expect(html).toContain('data-codex-inspector-panel="overview"');
    expect(html).toContain('>资料</button>');
    expect(html).toContain('位于高处的观察地点。');
    expect(html).toContain('所属 Area');
    expect(html).not.toContain('<strong>观测站</strong>');
    expect(html).not.toContain('codex-inspector-id');
    expect(html).toContain('<details class="codex-inspector-unwrapped-fields">');
    expect(html).not.toContain('<details class="codex-inspector-unwrapped-fields" open');
    expect(html).toContain('完整保留');
    expect(html).not.toContain('data-codex-field-path="$[&quot;id&quot;]"');
  });

  it('被引用按引用者分组并区分直接、自引用、派生、规则与候选路径', () => {
    const source = (definitionKind: string, fullId: string, label: string) => ({
      definitionKind, fullId, label, entryKey: definitionKind + ':' + fullId,
    });
    const directA = {
      relation: 'A 的真实语义用途', path: '$.areaId', scope: 'global' as const, sourceCategory: 'definition' as const,
      edgeSource: { definitionKind: 'areas', fullId: 'area-a' }, edgeTarget: { definitionKind: 'spots', fullId: 'spot-a' },
      target: source('areas', 'area-a', '观测区'), status: 'resolved' as const,
    };
    const localA = {
      relation: '局部选项使用', path: '$.options[0].areaId', scope: 'local' as const, sourceCategory: 'definition' as const,
      context: { definitionKind: 'areas', fullId: 'area-a' },
      targetLocations: [{ ref: { definitionKind: 'areas', fullId: 'area-a' }, path: '$.options[0].areaId' }],
      edgeSource: { definitionKind: 'areas', fullId: 'area-a' }, edgeTarget: { definitionKind: 'spots', fullId: 'spot-a' },
      target: source('areas', 'area-a', '观测区'), status: 'resolved' as const,
    };
    const view: DefinitionInspectorViewModel = {
      definitionKind: 'spots', fullId: 'spot-a', definition: {},
      references: [{
        path: '$.nextSpotId', relation: '出向关联',
        target: source('spots', 'next-spot', '下一处'), status: 'resolved',
      }],
      reverseReferences: [
        directA,
        { ...directA, relation: '另一个用途', path: '$.defaultSpots[0]' },
        localA,
        {
          relation: '派生故事入口', path: '$.storyId', sourceCategory: 'derived',
          edgeSource: { definitionKind: 'storyEntries', fullId: 'entry-a' },
          target: source('storyEntries', 'entry-a', '派生入口'), status: 'resolved',
        },
        {
          relation: '运行时激活规则', path: '$.rules[0]', sourceCategory: 'runtime-rule',
          edgeSource: { definitionKind: 'affectorPacks', fullId: 'pack-a' },
          target: source('affectorPacks', 'pack-a', '持续效果规则'), status: 'resolved',
        },
        {
          relation: '自引用', path: '$.relatedSpotId',
          edgeSource: { definitionKind: 'spots', fullId: 'spot-a' },
          target: source('spots', 'spot-a', '当前地点'), status: 'resolved',
        },
        {
          relation: '可能匹配', path: '$.candidateAreaId', scope: 'candidate', status: 'ambiguous',
          edgeSource: { definitionKind: 'operationEvents', fullId: 'event-a' },
          target: source('operationEvents', 'event-a', '事件规则'),
          candidates: [source('areas', 'area-a', '观测区'), source('areas', 'area-b', '备用区')],
        },
      ],
    };
    const html = renderDefinitionInspector(view, 'relations');

    expect(html).toContain('data-codex-inspector-tab="relations"');
    expect(html).toContain('data-codex-inspector-panel="relations"');
    expect(html).toContain('>被引用</button>');
    expect(html).toContain('确定的直接引用');
    expect(html).toContain('自引用');
    expect(html).toContain('派生引用');
    expect(html).toContain('运行时规则');
    expect(html).toContain('可能使用');
    expect(html).toContain('1 个引用者');
    expect(html).toContain('3 条引用路径');
    expect(html).toContain('data-codex-reference-source-count="1" data-codex-reference-path-count="3"');
    expect(html).toContain('A 的真实语义用途');
    expect(html).toContain('局部上下文');
    expect(html).toContain('$.options[0].areaId');
    expect(html).toContain('data-codex-reference-location="$.options[0].areaId"');
    expect(html).toContain('area-b');
    expect(html).not.toContain('向外引用');
    expect(html).not.toContain('next-spot');

    expect(labelInspectorReference({ ...directA, path: '$.areaId' }).relation).toBe('A 的真实语义用途');
  });

  it('部分覆盖且只有候选引用时仍说明直接引用者未确认', () => {
    const html = renderDefinitionInspector({
      definitionKind: 'items',
      fullId: 'item-a',
      definition: {},
      referenceCoverage: { status: 'partial', declaredCount: 0, candidateCount: 2 },
      reverseReferences: [{
        relation: '可能匹配区域', path: '$.areaId', scope: 'candidate', status: 'ambiguous',
        edgeSource: { definitionKind: 'spots', fullId: 'spot-a' },
        target: { definitionKind: 'spots', fullId: 'spot-a', label: '观测站' },
        candidates: [{ definitionKind: 'areas', fullId: 'area-a', label: '候选区域' }],
      }],
    }, 'relations');

    expect(html).toContain('未找到确定的直接引用者');
    expect(html).toContain('data-codex-reference-coverage="partial"');
    expect(html).toContain('部分自定义规则尚未识别');
    expect(html).toContain('不表示没有内容使用它');
    expect(html).toContain('可能使用（候选）');
    expect(html).toContain('可能匹配区域');
    expect(html).toContain('候选区域');
    expect(html).not.toContain('向外引用');
    expect(html).not.toContain('已声明出向关系');
  });

  it('出向关系只在技术详情显示，技术页仍保留字段树与 JSON', () => {
    const view: DefinitionInspectorViewModel = {
      definitionKind: 'items',
      fullId: 'item-a',
      title: '测试物品',
      definition: { id: 'item-a', hiddenField: { value: 1 } },
      references: [{
        path: '$.useEffects[0].target', relation: '使用效果',
        target: { definitionKind: 'spots', fullId: 'spot-b', label: '观测站', entryKey: 'spots:spot-b' },
        status: 'resolved',
      }],
    };
    const overview = renderDefinitionInspector(view, 'overview');
    const technical = renderDefinitionInspector(view, 'raw');

    expect(overview).not.toContain('向外引用');
    expect(overview).not.toContain('data-codex-reference-direction="outbound"');
    expect(technical).toContain('data-codex-inspector-tab="raw"');
    expect(technical).toContain('data-codex-inspector-panel="raw"');
    expect(technical).toContain('>技术详情</button>');
    expect(technical).toContain('向外引用');
    expect(technical).toContain('data-codex-reference-direction="outbound"');
    expect(technical).toContain('data-codex-field-tree');
    expect(technical).toContain('data-codex-raw-json');
    expect(technical).toContain('hiddenField');
  });
});
