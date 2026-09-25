import { describe, expect, test } from 'vitest';
import type { RuntimeEditorProblemInput } from '../../src/ui/runtime-editor/form';
import {
  dedupeDefinitionProblems,
  mergeDefinitionProblems,
  normalizeRuntimeEditorProblemInput,
  sortDefinitionProblems,
  summarizeDefinitionDiff,
  type DefinitionProblem,
} from '../../src/ui/runtime-editor/definition-diagnostics';

function problem(overrides: Partial<DefinitionProblem> = {}): DefinitionProblem {
  return {
    severity: 'warning',
    problemCode: 'field.invalid',
    objectRef: 'runtime:spot:archive',
    table: 'spots',
    defId: 'runtime:spot:archive',
    sectionId: 'basics',
    path: 'spot.name',
    message: '名称无效',
    nextAction: '修正名称。',
    location: { sectionId: 'basics' },
    ...overrides,
  };
}

describe('definition diagnostics contract', () => {
  test('覆盖 task-0120 的五类问题，并保留统一定位字段', () => {
    const problems = [
      problem({ severity: 'error', problemCode: 'field.required', path: 'spot.name', message: '缺少名称' }),
      problem({ severity: 'error', problemCode: 'reference.missing', path: 'spot.areaId', message: 'Area 不存在', sectionId: 'ownership' }),
      problem({ severity: 'warning', problemCode: 'capability.opaque-field', path: 'spot.extra', message: '包含未开放字段', sectionId: 'diagnostics' }),
      problem({ severity: 'error', problemCode: 'materialization.consumer-missing', path: 'spot.functionalities[0]', message: '没有已闭合的消费者', sectionId: 'functionalities', location: { sectionId: 'functionalities', collectionId: 'functionalities', itemIndex: 0 } }),
      problem({ severity: 'warning', problemCode: 'runtime-impact.progress', path: 'spot.idName', message: '会影响当前运行进度', sectionId: 'diagnostics' }),
    ];

    expect(problems.map(item => item.problemCode.split('.')[0])).toEqual([
      'field', 'reference', 'capability', 'materialization', 'runtime-impact',
    ]);
    expect(problems.every(item => item.objectRef && item.table && item.defId && item.sectionId && item.path && item.message && item.nextAction && item.location)).toBe(true);
    expect(problems[3].location).toEqual({ sectionId: 'functionalities', collectionId: 'functionalities', itemIndex: 0 });
  });

  test('同路径按严重级别、问题码稳定排序，并保持完全相同项的输入顺序', () => {
    const first = problem({ severity: 'info', problemCode: 'field.z', message: '后' });
    const second = problem({ severity: 'error', problemCode: 'reference.a', message: '先' });
    const third = problem({ severity: 'warning', problemCode: 'field.a', message: '中' });
    const duplicate = { ...first };

    expect(sortDefinitionProblems([first, second, third, duplicate])).toEqual([second, third, first, duplicate]);
  });

  test('按完整问题身份去重，合并后统一排序且不丢失 location', () => {
    const located = problem({ location: { sectionId: 'payments', collectionId: 'purchaseOptions', itemIndex: 2 } });
    const same = { ...located, location: { ...located.location } };
    const distinct = problem({ path: 'spot.purchaseOptions[3]', location: { sectionId: 'payments', collectionId: 'purchaseOptions', itemIndex: 3 } });

    expect(dedupeDefinitionProblems([located, same, distinct])).toEqual([located, distinct]);
    expect(mergeDefinitionProblems([distinct], [located, same])).toEqual([located, distinct]);
    expect(mergeDefinitionProblems([located], [same])[0].location).toEqual({ sectionId: 'payments', collectionId: 'purchaseOptions', itemIndex: 2 });
  });

  test('从 RuntimeEditorProblemInput 归一化旧问题，不改变旧类型', () => {
    const legacy: RuntimeEditorProblemInput = {
      path: 'spot.levelUpgrades[1].paymentOptions[0].costs[2]',
      message: '费用项无效',
      sectionId: 'upgrades',
      collectionId: 'levelUpgrades',
      itemIndex: 1,
      childCollectionId: 'paymentOptions',
      childIndex: 0,
    };

    expect(normalizeRuntimeEditorProblemInput(legacy, {
      problemCode: 'field.invalid-cost',
      table: 'spots',
      defId: 'runtime:spot:archive',
      objectRef: 'runtime:spot:archive',
      nextAction: '打开升级子编辑器修正费用。',
    })).toEqual({
      severity: 'error',
      problemCode: 'field.invalid-cost',
      objectRef: 'runtime:spot:archive',
      table: 'spots',
      defId: 'runtime:spot:archive',
      sectionId: 'upgrades',
      path: 'spot.levelUpgrades[1].paymentOptions[0].costs[2]',
      message: '费用项无效',
      nextAction: '打开升级子编辑器修正费用。',
      location: {
        sectionId: 'upgrades',
        collectionId: 'levelUpgrades',
        itemIndex: 1,
        childCollectionId: 'paymentOptions',
        childIndex: 0,
      },
    });

    expect(normalizeRuntimeEditorProblemInput({ message: '旧问题' })).toMatchObject({
      objectRef: 'runtime-editor:legacy',
      table: 'unknown',
      defId: 'unknown',
      sectionId: 'diagnostics',
      path: '',
      location: { sectionId: 'diagnostics' },
    });
  });

  test('生成 Source / Draft / Applied 三方差异摘要并标出变化方向', () => {
    const summary = summarizeDefinitionDiff(
      { name: '旧名称', areaId: 'base:area:old', tags: ['a'], nested: { enabled: false } },
      { name: '新名称', areaId: 'base:area:new', tags: ['a', 'b'], nested: { enabled: false } },
      { name: '旧名称', areaId: 'base:area:old', tags: ['a'], nested: { enabled: true } },
    );

    expect(summary.map(item => item.path)).toEqual(['areaId', 'name', 'nested.enabled', 'tags[0]', 'tags[1]']);
    expect(summary.find(item => item.path === 'name')).toMatchObject({
      source: '旧名称', draft: '新名称', applied: '旧名称',
      sourceToDraftChanged: true, draftToAppliedChanged: true, sourceToAppliedChanged: false, changed: true,
    });
    expect(summary.find(item => item.path === 'nested.enabled')).toMatchObject({
      sourceToDraftChanged: false, draftToAppliedChanged: true, sourceToAppliedChanged: true,
    });
    expect(summary.find(item => item.path === 'tags[1]')).toMatchObject({
      source: undefined, draft: 'b', applied: undefined, sourceToDraftChanged: true, draftToAppliedChanged: true,
    });
  });
});
