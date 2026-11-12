import { describe, expect, it } from 'vitest';
import { convertSourceText } from '../../../scripts/migrate-story-content.mjs';

const convert = (source: string, options?: Parameters<typeof convertSourceText>[2]) =>
  convertSourceText(source, 'fixture.ts', options);

describe('offline Story content migrator', () => {
  it('moves choice actions and transfers to ordered, option-gated nodes', () => {
    const result = convert(`
      import { story } from '../def-factory/story';
      import { line } from '../def-factory/talklet';
      const definition = story('test:story:choice', 'Choice')
        .scene(line('Arona', 'Pick a route', 'legacy reply is ignored')
          .effects({ op: 'addResource', target: 'base:resource:credit', value: 3 })
          .choice('Stay', { op: 'setFlag', target: 'route', value: 'stay' })
          .choiceJump('Insert', 'base:story:detour', 'insert', { op: 'addItem', target: 'base:item:ticket', value: 2 }))
        .build();
    `);

    expect(result).toMatchObject({ converted: 1, skipped: 0, issues: [] });
    const firstMark = 'migration:choice:test:story:choice:p1:option1';
    const secondMark = 'migration:choice:test:story:choice:p1:option2';
    expect(result.text).toContain(`marks: ["${firstMark}"]`);
    expect(result.text).toContain(`marks: ["${secondMark}"]`);
    expect(result.text).toContain(`requiresFlag: "${firstMark}", action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'base:resource:credit', amount: 3 }] }`);
    expect(result.text).toContain(`requiresFlag: "${firstMark}", action: { kind: 'state', effects: [{ op: 'setFlag', flagId: 'route', value: 'stay' }] }`);
    expect(result.text).toContain(`requiresFlag: "${secondMark}", action: { kind: 'state', effects: [{ op: 'addItem', itemId: 'base:item:ticket', amount: 2 }] }`);
    expect(result.text).toContain(`requiresFlag: "${secondMark}", transfer: { mode: 'insert', storyId: 'base:story:detour' }`);
    expect(result.text.indexOf("id: 'p1-choice'")).toBeLessThan(result.text.indexOf("id: 'p1-option1-op1'"));
    expect(result.text.indexOf("id: 'p1-option1-op1'")).toBeLessThan(result.text.indexOf("id: 'p1-option1-op2'"));
    expect(result.text.indexOf("id: 'p1-option2-op2'")).toBeLessThan(result.text.indexOf("id: 'p1-option2-transfer'"));
    expect(result.text).not.toContain('sharedActions:');
    expect(result.text).not.toContain('result:');
    expect(result.text).not.toContain('legacy reply is ignored');
    expect(result.text).not.toContain('reply:');
  });

  it('reports old choice conditions because false now hides the option', () => {
    const result = convert(`
      const definition = {
        id: 'test:story:condition', name: 'Condition',
        talklets: [{ text: 'Pick', choices: [{ text: 'Route', condition: { type: 'AND', conditions: [] } }] }],
      };
    `);

    expect(result).toMatchObject({ converted: 0, skipped: 1 });
    expect(result.text).toContain("condition: { type: 'AND', conditions: [] }");
    expect(result.issues).toEqual([expect.objectContaining({ code: 'choice-visibility-changed' })]);
  });

  it('reports unsupported choice page effects instead of silently dropping them', () => {
    const result = convert(`
      import { story } from '../def-factory/story';
      import { line } from '../def-factory/talklet';
      const definition = story('test:story:unsupported-choice-effect', 'Unsupported').scene(
        line('Arona', 'Pick').effects({ op: 'unknownLegacyChoiceEffect' }).choice('Continue'),
      ).build();
    `);

    expect(result).toMatchObject({ converted: 0, skipped: 1 });
    expect(result.issues).toEqual([expect.objectContaining({ code: 'unsupported-effect', storyId: 'test:story:unsupported-choice-effect' })]);
    expect(result.text).toContain('unknownLegacyChoiceEffect');
  });

  it('writes legacy send text as a separate Talklet and preserves multi-click confirmation', () => {
    const result = convert(`
      import { story } from '../def-factory/story';
      import { line } from '../def-factory/talklet';
      const definition = story('test:story:buttons', 'Buttons').scene(
        line('Arona', 'A normal line', 'Yes, please'),
        line('Teacher', 'Working').click(3, 2).effects({ op: 'addResource', target: 'base:resource:credit', value: 4 }),
      ).build();
    `);

    expect(result).toMatchObject({ converted: 1, skipped: 0, issues: [] });
    expect(result.text).toContain("'p1': { advance: 'input' }");
    expect(result.text).toContain("interaction: { kind: 'button', text: 'Yes, please' }");
    expect(result.text).toContain("{ id: 'p1-response', type: 'talklet', stageId: 'p1-response', content: { kind: 'talk', text: 'Yes, please', speaker: '老师' }, presentation: { side: 'right' } }");
    expect(result.text).not.toContain('reply:');
    expect(result.text).toContain("'p2': { advance: 'input' }");
    expect(result.text).toContain("'p2-confirm': { advance: 'input' }");
    expect(result.text).toContain("text: 'Working', press: { base: 3, rand: 2 }");
    expect(result.text).toContain("id: 'p2-confirm-click'");
    expect(result.text).toContain("type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'base:resource:credit', amount: 4 }] }");
    expect(result.text).not.toContain('result:');
  });

  it('uses one Click when legacy click-work is statically one total press', () => {
    const result = convert(`
      import { story } from '../def-factory/story';
      import { line } from '../def-factory/talklet';
      const definition = story('test:story:single-click', 'Single click').scene(
        line('Arona', 'Single').click(1).effects({ op: 'addResource', target: 'base:resource:credit', value: 1 }),
        line('Arona', 'Also single').click(1, 1),
      ).build();
    `);

    expect(result).toMatchObject({ converted: 1, skipped: 0, issues: [] });
    expect(result.text).toContain("'p1': { advance: 'input' }");
    expect(result.text).not.toContain("'p1-confirm'");
    expect(result.text).toContain("id: 'p1-button'");
    expect(result.text).toContain("id: 'p2-button'");
    expect(result.text).not.toContain('press:');
    expect(result.text).toContain("type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'base:resource:credit', amount: 1 }] }");
  });

  it('reports click-work ranges that sometimes require confirmation and sometimes do not', () => {
    const source = `
      import { story } from '../def-factory/story';
      import { line } from '../def-factory/talklet';
      const definition = story('test:story:ambiguous-click', 'Ambiguous').scene(
        line('Arona', 'Variable work').click(1, 2),
      ).build();
    `;
    const result = convert(source);

    expect(result).toMatchObject({ converted: 0, skipped: 1, text: source });
    expect(result.issues[0]).toMatchObject({ code: 'ambiguous-click-confirm', storyId: 'test:story:ambiguous-click' });
    expect(result.issues[0].message).toContain('rewrite this page manually');
  });

  it('maps all fourteen state operations to named arguments and splits batches at presentation actions', () => {
    const stateEffects = [
      "{ op: 'setResource', target: 'base:resource:credit', value: 1 }",
      "{ op: 'addResource', target: 'base:resource:credit', value: 2 }",
      "{ op: 'setSpotLevel', target: 'base:spot:desk', value: 3 }",
      "{ op: 'addSpotLevel', target: 'base:spot:desk', value: 4 }",
      "{ op: 'setTheme', target: '', value: { colorGroupId: 'base:colorgroup:blue' } }",
      "{ op: 'setManager', target: 'base:spot:desk', value: 'base:character:arona' }",
      "{ op: 'addEnhancement', target: '', value: 'base:enhancement:focus' }",
      "{ op: 'addItem', target: 'base:item:ticket', value: 5 }",
      "{ op: 'unlockInit', target: '', value: 'base:init:schale' }",
      "{ op: 'setFlag', target: 'route', value: 'north' }",
      "{ op: 'setExtra', target: 'quest/step', value: { t: 'num', v: 1 } }",
      "{ op: 'addExtra', target: 'quest/count', value: 2 }",
      "{ op: 'removeExtra', target: 'quest/count' }",
      "{ op: 'grantCharacter', target: 'base:variant:arona', value: 1 }",
      "{ op: 'addAffectionExp', target: 'base:variant:arona', value: 6 }",
    ];
    const result = convert(`
      import { story } from '../def-factory/story';
      import { line } from '../def-factory/talklet';
      const definition = story('test:story:state', 'State').scene(
        line('Arona', 'State').effects(${stateEffects.join(', ')}),
      ).build();
    `);

    expect(result).toMatchObject({ converted: 1, skipped: 0, issues: [] });
    expect(result.text.match(/kind: 'state', effects:/g) ?? []).toHaveLength(2);
    expect(result.text.indexOf("kind: 'presentation', command: { command: 'theme'")).toBeGreaterThan(result.text.indexOf("op: 'addSpotLevel'"));
    expect(result.text.indexOf("kind: 'presentation', command: { command: 'theme'")).toBeLessThan(result.text.indexOf("op: 'setManager'"));
    for (const field of [
      'resourceId:', 'spotId:', 'managerId:', 'enhancementId:', 'itemId:', 'initId:',
      'flagId:', 'path:', 'variantId:', 'amount:',
    ]) expect(result.text).toContain(field);
    expect(result.text).not.toContain("op: 'addResource', target:");
  });

  it('keeps overlay and presentation actions explicit, and requires entry type and owner for story requests', () => {
    const source = `
      import { story } from '../def-factory/story';
      import { line } from '../def-factory/talklet';
      const definition = story('test:story:effects', 'Effects').scene(line('Arona', 'Look')
        .effects(
          { op: 'showChatText', target: 'banner', value: { text: 'Hello', x: 0.5, y: 0.2, align: 'center', style: { fontSize: '16px' } } },
          { op: 'setEntityPresentation', target: 'variant:base:variant:arona', value: { optionId: 'base:option:winter', owner: 'base:variant:arona', lifetime: 'story' } },
          { op: 'triggerStory', target: 'base:activestory:welcome', owner: null },
          { op: 'showOpeningTitle', value: 'Opening' },
        )).build();
    `;
    const unresolved = convert(source);
    expect(unresolved.converted).toBe(0);
    expect(unresolved.issues.some(issue => issue.code === 'unsupported-effect')).toBe(true);

    const resolved = convert(source, {
      entryTypes: { 'base:activestory:welcome': 'active' },
      entryOwners: { 'base:activestory:welcome': null },
    });
    expect(resolved).toMatchObject({ converted: 1, skipped: 0, issues: [] });
    expect(resolved.text).toContain("kind: 'overlay', command: { command: 'show', id: 'banner', x: 0.5, y: 0.2, align: 'center', content: { kind: 'text', text: 'Hello', style: { fontSize: '16px' } } }");
    expect(resolved.text).toContain("command: 'setEntityPresentation', target: 'variant:base:variant:arona', optionId: 'base:option:winter', owner: 'base:variant:arona', lifetime: 'story'");
    expect(resolved.text).toContain("request: { entryId: 'base:activestory:welcome', entryType: 'active', owner: null, intent: 'system' }");
    expect(resolved.text.indexOf("command: 'openingTitle', title: 'Opening'")).toBeLessThan(resolved.text.indexOf("id: 'p1-body'"));
  });

  it('converts static StoryDef talklets arrays and reports dynamic arrays without rewriting them', () => {
    const source = `
      const definition = {
        id: 'test:story:literal', name: 'Literal', extra: { marker: true },
        talklets: [{ text: 'Hello', speaker: 'Arona' }, { kind: 'narration', text: 'The end.' }],
      };
    `;
    const result = convert(source);

    expect(result).toMatchObject({ converted: 1, skipped: 0, issues: [] });
    expect(result.text).toContain("id: 'test:story:literal'");
    expect(result.text).toContain('extra: { marker: true }');
    expect(result.text).not.toContain('talklets');
    expect(result.text).toContain("content: { kind: 'narration', text: 'The end.' }");

    const dynamicSource = `
      const talklets = makeTalklets();
      const definition = { id: 'test:story:dynamic', name: 'Dynamic', talklets: talklets };
    `;
    const dynamic = convert(dynamicSource);
    expect(dynamic).toMatchObject({ converted: 0, skipped: 1, text: dynamicSource });
    expect(dynamic.issues[0]).toMatchObject({ code: 'dynamic-talklets', storyId: 'test:story:dynamic' });

    const shorthandSource = `const talklets = makeTalklets(); const definition = { id: 'test:story:shorthand', name: 'Shorthand', talklets };`;
    const shorthand = convert(shorthandSource);
    expect(shorthand).toMatchObject({ converted: 0, skipped: 1, text: shorthandSource });
    expect(shorthand.issues[0]).toMatchObject({ code: 'dynamic-talklets', storyId: 'test:story:shorthand' });
  });
});
