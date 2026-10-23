import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const OLD_HELPERS = new Set(['line', 'narrate', 'click', 'talklet']);
const STATE_OPS = new Map([
  ['setResource', ['resourceId', 'target', 'amount', true]],
  ['addResource', ['resourceId', 'target', 'amount', true]],
  ['setSpotLevel', ['spotId', 'target', 'amount', true]],
  ['addSpotLevel', ['spotId', 'target', 'amount', true]],
  ['setManager', ['spotId', 'target', 'managerId', false]],
  ['addEnhancement', ['enhancementId', 'value', null, false]],
  ['addItem', ['itemId', 'target', 'amount', true]],
  ['unlockInit', ['initId', 'value', null, false]],
  ['setFlag', ['flagId', 'target', 'value', false]],
  ['setExtra', ['path', 'target', 'value', false]],
  ['addExtra', ['path', 'target', 'amount', true]],
  ['removeExtra', ['path', 'target', null, false]],
  ['grantCharacter', ['variantId', 'target', null, false]],
  ['addAffectionExp', ['variantId', 'target', 'amount', true]],
]);

/**
 * Convert legacy Story source text to literal nodes/stages. This is an offline migration
 * helper only; runtime code must never import this module or execute legacy Talklet data.
 */
export function convertSourceText(sourceText, fileName = 'story.ts', options = {}) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declarations = collectDeclarations(sourceFile);
  const replacements = [];
  const issues = [];
  let converted = 0;
  let skipped = 0;

  const addIssue = (node, storyId, code, message) => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    issues.push({ fileName, storyId, code, message, line: line + 1, column: character + 1 });
  };
  const visit = (node) => {
    if (ts.isCallExpression(node) && isPropertyCall(node, 'build')) {
      const parsed = parseStoryBuilder(node, sourceFile);
      if (parsed) {
        const before = issues.length;
        const storyId = literalString(parsed.storyCall.arguments[0]);
        const mapped = convertPages(parsed.sceneCall.arguments, sourceFile, declarations, options, storyId ?? fileName, issues, addIssue);
        if (issues.length === before) {
          const id = textOf(parsed.storyCall.arguments[0], sourceFile);
          const name = textOf(parsed.storyCall.arguments[1], sourceFile);
          const extra = parsed.extra ? `.extra(${textOf(parsed.extra, sourceFile)})` : '';
          const replacement = `story(${id}, ${name})${extra}.stages(${mapped.stages}).nodes(${mapped.nodes}).build()`;
          replacements.push({ start: node.getStart(sourceFile), end: node.end, replacement });
          converted += 1;
        } else {
          skipped += 1;
        }
        return;
      }
    }

    if (ts.isObjectLiteralExpression(node) && findStoryTalkletsProperty(node)) {
      const idProperty = findProperty(node, 'id');
      const nameProperty = findProperty(node, 'name');
      const talkletsProperty = findStoryTalkletsProperty(node);
      const storyId = literalString(idProperty?.initializer) ?? fileName;
      if (!idProperty || !nameProperty || !ts.isPropertyAssignment(idProperty) || !ts.isPropertyAssignment(nameProperty)) {
        addIssue(node, storyId, 'story-identity', 'Story object must declare literal id and name properties for migration');
        skipped += 1;
        return;
      }
      const before = issues.length;
      const talkletsExpression = talkletsProperty && ts.isPropertyAssignment(talkletsProperty) ? talkletsProperty.initializer : undefined;
      const talkletArray = resolveExpression(talkletsExpression, declarations);
      if (!talkletArray || !ts.isArrayLiteralExpression(talkletArray)) {
        addIssue(talkletsProperty ?? node, storyId, 'dynamic-talklets', 'talklets must be a statically declared array for migration');
        skipped += 1;
        return;
      }
      const mapped = convertPages(talkletArray.elements, sourceFile, declarations, options, storyId, issues, addIssue);
      if (issues.length === before) {
        const retained = node.properties.filter(property => {
          if (!ts.isPropertyAssignment(property)) return false;
          return !['talklets', 'nodes', 'stages'].includes(propertyName(property));
        });
        if (node.properties.some(property => !ts.isPropertyAssignment(property))) {
          addIssue(node, storyId, 'story-spread', 'Story object spreads or shorthand properties need manual migration');
          skipped += 1;
          return;
        }
        const metadata = retained.map(property => `${propertyName(property)}: ${textOf(property.initializer, sourceFile)}`);
        metadata.push(`stages: ${mapped.stages}`, `nodes: ${mapped.nodes}`);
        replacements.push({ start: node.getStart(sourceFile), end: node.end, replacement: `{ ${metadata.join(', ')} }` });
        converted += 1;
      } else {
        skipped += 1;
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  replacements.sort((a, b) => b.start - a.start);
  let output = sourceText;
  for (const replacement of replacements) {
    output = `${output.slice(0, replacement.start)}${replacement.replacement}${output.slice(replacement.end)}`;
  }
  if (converted > 0) output = removeUnusedLegacyFactoryImports(output, fileName);
  return { text: output, converted, skipped, issues };
}

function collectDeclarations(sourceFile) {
  const declarations = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations;
}

function resolveExpression(expression, declarations, seen = new Set()) {
  if (!expression) return undefined;
  if (!ts.isIdentifier(expression) || expression.text === 'undefined') return expression;
  if (seen.has(expression.text)) return undefined;
  const value = declarations.get(expression.text);
  if (!value) return expression;
  seen.add(expression.text);
  return resolveExpression(value, declarations, seen);
}

function parseStoryBuilder(buildCall, sourceFile) {
  const buildProperty = buildCall.expression;
  if (!ts.isPropertyAccessExpression(buildProperty)) return undefined;
  let current = buildProperty.expression;
  let sceneCall;
  let extra;
  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    const property = current.expression;
    if (property.name.text === 'scene') sceneCall = current;
    else if (property.name.text === 'extra') extra = current.arguments[0];
    else if (property.name.text !== 'nodes' && property.name.text !== 'stages') return undefined;
    current = property.expression;
  }
  if (!sceneCall || !ts.isCallExpression(current) || !ts.isIdentifier(current.expression) || current.expression.text !== 'story') return undefined;
  if (current.arguments.length < 2) return undefined;
  return { storyCall: current, sceneCall, extra, sourceFile };
}

function convertPages(elements, sourceFile, declarations, options, storyId, issues, addIssue) {
  const nodes = [];
  const stageFields = [];
  for (let index = 0; index < elements.length; index += 1) {
    const expression = elements[index];
    const page = parseTalklet(expression, sourceFile, declarations);
    if (!page) {
      addIssue(expression, storyId, 'unknown-talklet', 'Unsupported Talklet expression; source was left unchanged');
      continue;
    }
    if (page.issues.length) {
      for (const issue of page.issues) addIssue(issue.node, storyId, issue.code, issue.message);
      continue;
    }
    appendPage(nodes, stageFields, page, index + 1, sourceFile, declarations, options, storyId, issues, addIssue);
  }
  return {
    nodes: `[\n${nodes.map(node => `  ${node},`).join('\n')}\n]`,
    stages: `{ ${stageFields.join(', ')} }`,
  };
}

function parseTalklet(expression, sourceFile, declarations) {
  const resolved = resolveExpression(expression, declarations);
  if (!resolved) return undefined;
  if (ts.isObjectLiteralExpression(resolved)) return parseTalkletObject(resolved, sourceFile, declarations);
  let call = resolved;
  if (ts.isCallExpression(call) && isPropertyCall(call, 'build')) call = call.expression.expression;
  const chain = flattenCallChain(call);
  if (!chain?.base) return undefined;

  const issues = [];
  const page = { content: undefined, presentation: {}, pacing: {}, effects: [], choices: [], transfer: undefined, clickWork: undefined, reply: undefined, muteReply: false, kizuna: undefined, kind: 'talk' };
  const args = chain.base.arguments;
  if (chain.base.name === 'line' && args.length >= 2) {
    page.content = { kind: 'talk', text: args[1] };
    page.content.speaker = args[0];
    if (args[2] && !isUndefined(args[2]) && !isEmptyString(args[2], sourceFile)) page.reply = args[2];
    const opts = args[3] && objectProperties(args[3]);
    if (opts) applyTalkOptions(page, opts);
    else if (args[3]) issues.push({ node: args[3], code: 'dynamic-options', message: 'line options must be a literal object' });
  } else if (chain.base.name === 'narrate' && args.length >= 1) {
    page.kind = 'narration';
    page.content = { kind: 'narration', text: args[0] };
    page.presentation.align = args[1] ?? "'center'";
  } else if (chain.base.name === 'talklet' && args.length >= 1) {
    page.content = { kind: 'talk', text: args[0] };
  } else if (chain.base.name === 'click' && args.length >= 2) {
    page.kind = 'click';
    page.clickWork = { base: args[1], rand: args[2] };
    page.content = { kind: 'talk', text: args[0] };
  } else {
    return undefined;
  }

  for (const modifier of chain.modifiers) {
    const values = modifier.arguments;
    switch (modifier.name) {
      case 'speaker': page.content.speaker = values[0]; break;
      case 'avatar': page.presentation.avatar = values[0]; break;
      case 'image': page.content.image = values[0]; break;
      case 'narrate': page.kind = 'narration'; page.content.kind = 'narration'; page.presentation.align = values[0] ?? "'center'"; break;
      case 'click': page.kind = 'click'; page.clickWork = { base: values[0], rand: values[1] }; break;
      case 'effects': page.effects.push(...values); break;
      case 'reply': case 'sendText': page.reply = values[0]; break;
      case 'mute': case 'muteReply': page.muteReply = true; break;
      case 'side': page.presentation.side = values[0]; break;
      case 'noAvatar': page.presentation.avatarMode = "'hide'"; break;
      case 'showAvatar': page.presentation.avatarMode = "'show'"; break;
      case 'typing': page.pacing.typing = values[0]; break;
      case 'thinking': page.pacing.thinking = values[0]; break;
      case 'choice': page.choices.push({ text: values[0], effects: values.slice(1) }); break;
      case 'choiceJump': page.choices.push({ text: values[0], target: values[1], mode: values[2] ?? "'goto'", effects: values.slice(3) }); break;
      case 'jump': page.transfer = { target: values[0], mode: values[1] ?? "'goto'" }; break;
      case 'kizunaCard': page.kizuna = { target: values[0], options: values[1] }; break;
      case 'build': break;
      default: issues.push({ node: modifier.node, code: 'unknown-modifier', message: `Unsupported Talklet builder modifier .${modifier.name}()` });
    }
  }
  return { ...page, issues };
}

function parseTalkletObject(object, sourceFile, declarations) {
  const fields = objectProperties(object);
  if (!fields || !fields.has('text')) return undefined;
  const legacyReply = fields.get('sendText');
  const page = { content: undefined, presentation: {}, pacing: {}, effects: [], choices: [], transfer: undefined, clickWork: undefined, reply: legacyReply && !isEmptyString(legacyReply, sourceFile) ? legacyReply : undefined, muteReply: literalBoolean(fields.get('muteReply')) === true, kizuna: undefined, kind: literalString(fields.get('kind')) ?? 'talk', issues: [] };
  page.content = { kind: page.kind === 'narration' ? 'narration' : 'talk', text: fields.get('text') };
  for (const key of ['speaker', 'image']) if (fields.has(key)) page.content[key] = fields.get(key);
  for (const key of ['avatar', 'side', 'align']) if (fields.has(key)) page.presentation[key] = fields.get(key);
  if (literalBoolean(fields.get('noAvatar')) === true) page.presentation.avatarMode = "'hide'";
  else if (literalBoolean(fields.get('showAvatar')) === true) page.presentation.avatarMode = "'show'";
  for (const key of ['typing', 'thinking']) if (fields.has(key)) page.pacing[key] = fields.get(key);
  const effects = fields.get('effects');
  if (effects) {
    const resolvedEffects = resolveExpression(effects, declarations);
    if (ts.isArrayLiteralExpression(resolvedEffects)) page.effects.push(...resolvedEffects.elements);
    else page.issues.push({ node: effects, code: 'dynamic-effects', message: 'Talklet effects must be a literal array for migration' });
  }
  const choices = fields.get('choices');
  if (choices) {
    const resolved = resolveExpression(choices, declarations);
    if (ts.isArrayLiteralExpression(resolved)) {
      for (const choice of resolved.elements) {
        const values = objectProperties(choice);
        if (!values || !values.has('text')) page.issues.push({ node: choice, code: 'dynamic-choice', message: 'Choice must be a literal object' });
        else page.choices.push({ text: values.get('text'), effects: arrayElements(values.get('effects')), target: values.get('jumpToStory'), mode: values.get('jumpMode'), condition: values.get('condition') });
      }
    } else page.issues.push({ node: choices, code: 'dynamic-choices', message: 'Talklet choices must be a literal array for migration' });
  }
  if (fields.has('clickWork')) {
    const work = objectProperties(fields.get('clickWork'));
    if (!work?.has('base')) page.issues.push({ node: fields.get('clickWork'), code: 'dynamic-click-work', message: 'clickWork must be a literal object' });
    else page.clickWork = { base: work.get('base'), rand: work.get('rand') };
  }
  if (fields.has('jumpToStory')) page.transfer = { target: fields.get('jumpToStory'), mode: fields.get('jumpMode') ?? "'goto'" };
  if (fields.has('kizuna')) {
    const card = objectProperties(fields.get('kizuna'));
    if (!card?.has('storyId')) page.issues.push({ node: fields.get('kizuna'), code: 'dynamic-card', message: 'kizuna must be a literal object with storyId' });
    else page.kizuna = { target: card.get('storyId'), options: fields.get('kizuna') };
  }
  const known = new Set(['text', 'speaker', 'image', 'kind', 'align', 'avatar', 'side', 'noAvatar', 'showAvatar', 'typing', 'thinking', 'effects', 'choices', 'sendText', 'muteReply', 'clickWork', 'jumpToStory', 'jumpMode', 'kizuna']);
  for (const key of fields.keys()) if (!known.has(key)) page.issues.push({ node: object, code: 'unknown-talklet-field', message: `Unsupported Talklet field "${key}"` });
  return page;
}

function appendPage(nodes, stages, page, pageNumber, sourceFile, declarations, options, storyId, issues, addIssue) {
  const key = `p${pageNumber}`;
  const stage = key;
  const firstEffects = page.effects;
  const openingIndex = pageNumber === 1 ? firstEffects.findIndex(effect => effectOperation(effect, sourceFile) === 'showOpeningTitle') : -1;
  const opening = openingIndex >= 0 ? [firstEffects[openingIndex]] : [];
  const remainingEffects = pageNumber === 1
    ? firstEffects.filter(effect => effectOperation(effect, sourceFile) !== 'showOpeningTitle')
    : firstEffects;
  const openingActions = convertEffects(opening, sourceFile, options, storyId, issues, addIssue);
  for (const action of openingActions) nodes.push(operationNode(`${key}-opening-${nodes.length}`, action));
  const displayable = page.kind !== 'click';
  const body = displayable ? talkletNode(`${key}-body`, stage, page, sourceFile) : undefined;
  const work = page.clickWork;
  const hasChoices = page.kind !== 'click' && page.choices.length > 0;

  if (hasChoices) {
    stages.push(`'${stage}': { advance: 'input' }`);
    if (body) nodes.push(body);
    const sharedActions = convertEffects(remainingEffects, sourceFile, options, storyId, issues, addIssue);
    const optionsCode = page.choices.map((choice, index) => {
      const branchActions = convertEffects(choice.effects ?? [], sourceFile, options, storyId, issues, addIssue);
      const target = choice.target ?? page.transfer?.target;
      const mode = choice.mode ?? page.transfer?.mode ?? "'goto'";
      const transfer = target ? transferCode(target, mode, sourceFile) : undefined;
      const result = resultCode(branchActions, transfer);
      return `{ id: 'option${index + 1}', text: ${textOf(choice.text, sourceFile)}${choice.condition ? `, condition: ${textOf(choice.condition, sourceFile)}` : ''}${result ? `, result: ${result}` : ''} }`;
    });
    const shared = sharedActions.length ? `, sharedActions: [${sharedActions.join(', ')}]` : '';
    nodes.push(`{ id: '${key}-choice', type: 'click', stageId: '${stage}', interaction: { kind: 'choice'${shared}, options: [${optionsCode.join(', ')}] } }`);
    return;
  }

  if (page.kind !== 'click' && page.kizuna) {
    stages.push(`${stage}: { advance: 'input' }`);
    if (body) nodes.push(body);
    if (remainingEffects.length || page.transfer) {
      addIssue(page.kizuna.node ?? page.kizuna.target, storyId, 'card-result-unavailable', 'Legacy card activation ignores page effects/jump; remove only after checking they were not intended');
    }
    const card = entryCardCode(page.kizuna, sourceFile, options, storyId, addIssue);
    if (card) nodes.push(`{ id: '${key}-entry', type: 'click', stageId: '${stage}', interaction: { kind: 'entryCard', card: ${card} } }`);
    return;
  }

  const needsInput = page.kind === 'click' || !!work || !!page.reply;
  if (page.kind === 'click') {
    const clickText = page.reply ?? page.content.text;
    const total = work ?? { base: "1" };
    const clickMode = clickWorkMode(work, declarations);
    if (clickMode.kind === 'issue') {
      addIssue(work?.base ?? page.content.text, storyId, clickMode.code, clickMode.message);
      return;
    }
    stages.push(`'${stage}': { advance: 'input' }`);
    const actions = convertEffects(remainingEffects, sourceFile, options, storyId, issues, addIssue);
    const transfer = page.transfer ? transferCode(page.transfer.target, page.transfer.mode, sourceFile) : undefined;
    const result = resultCode(actions, transfer);
    if (clickMode.kind === 'single') {
      nodes.push(buttonNode(`${key}-button`, stage, textOf(clickText, sourceFile), undefined, undefined, result));
    } else {
      stages.push(`'${key}-confirm': { advance: 'input' }`);
      nodes.push(buttonNode(`${key}-work`, stage, textOf(clickText, sourceFile), clickMode.work ?? total, undefined, undefined));
      nodes.push(buttonNode(`${key}-confirm-click`, `${key}-confirm`, textOf(clickText, sourceFile), undefined, undefined, result));
    }
    return;
  }

  if (work) {
    const clickMode = clickWorkMode(work, declarations);
    if (clickMode.kind === 'issue') {
      addIssue(work.base, storyId, clickMode.code, clickMode.message);
      return;
    }
    stages.push(`'${stage}': { advance: 'input' }`);
    if (body) nodes.push(body);
    const text = page.reply ? textOf(page.reply, sourceFile) : "''";
    const actions = convertEffects(remainingEffects, sourceFile, options, storyId, issues, addIssue);
    const transfer = page.transfer ? transferCode(page.transfer.target, page.transfer.mode, sourceFile) : undefined;
    const reply = page.reply && !page.muteReply ? replyContentCode(page.reply, sourceFile) : undefined;
    const result = resultCode(actions, transfer);
    if (clickMode.kind === 'single') {
      nodes.push(buttonNode(`${key}-button`, stage, text, undefined, reply, result));
    } else {
      stages.push(`'${key}-confirm': { advance: 'input' }`);
      nodes.push(buttonNode(`${key}-work`, stage, text, clickMode.work ?? work, undefined, undefined));
      nodes.push(buttonNode(`${key}-confirm-click`, `${key}-confirm`, text, undefined, reply, result));
    }
    return;
  }

  if (needsInput) {
    stages.push(`'${stage}': { advance: 'input' }`);
    if (body) nodes.push(body);
    const text = textOf(page.reply, sourceFile);
    const actions = convertEffects(remainingEffects, sourceFile, options, storyId, issues, addIssue);
    const transfer = page.transfer ? transferCode(page.transfer.target, page.transfer.mode, sourceFile) : undefined;
    const reply = page.reply && !page.muteReply ? replyContentCode(page.reply, sourceFile) : undefined;
    const result = resultCode(actions, transfer);
    nodes.push(buttonNode(`${key}-button`, stage, text, undefined, reply, result));
    return;
  }

  stages.push(`'${stage}': { advance: 'auto' }`);
  if (body) nodes.push(body);
  const actions = convertEffects(remainingEffects, sourceFile, options, storyId, issues, addIssue);
  actions.forEach((action, index) => nodes.push(operationNode(`${key}-op${index + 1}`, action)));
  if (page.transfer) nodes.push(transferNode(`${key}-transfer`, transferCode(page.transfer.target, page.transfer.mode, sourceFile)));
}

function talkletNode(id, stageId, page, sourceFile) {
  const fields = [`id: '${id}'`, `type: 'talklet'`, `stageId: '${stageId}'`, `content: ${contentCode(page.content, page.presentation, sourceFile)}`];
  const presentation = presentationCode(page.presentation, sourceFile);
  const pacing = objectCode(page.pacing, sourceFile);
  if (presentation) fields.push(`presentation: ${presentation}`);
  if (pacing) fields.push(`pacing: ${pacing}`);
  return `{ ${fields.join(', ')} }`;
}

function contentCode(content, presentation, sourceFile) {
  if (!content) return `{ kind: 'talk', text: '' }`;
  const fields = [`kind: '${content.kind}'`, `text: ${textOf(content.text, sourceFile)}`];
  if (content.speaker) fields.push(`speaker: ${textOf(content.speaker, sourceFile)}`);
  if (content.image) fields.push(`image: ${textOf(content.image, sourceFile)}`);
  return `{ ${fields.join(', ')} }`;
}

function replyContentCode(reply, sourceFile) {
  return `{ kind: 'talk', text: ${textOf(reply, sourceFile)} }`;
}

function presentationCode(presentation, sourceFile) {
  const fields = Object.entries(presentation ?? {}).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${textOf(value, sourceFile)}`);
  return fields.length ? `{ ${fields.join(', ')} }` : undefined;
}

function objectCode(values, sourceFile) {
  const fields = Object.entries(values ?? {}).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${textOf(value, sourceFile)}`);
  return fields.length ? `{ ${fields.join(', ')} }` : undefined;
}

function buttonNode(id, stageId, text, press, reply, result) {
  const pressCode = press ? `, press: { base: ${textOf(press.base)},${press.rand ? ` rand: ${textOf(press.rand)}` : ''} }` : '';
  const replyCode = reply ? `, reply: ${reply}` : '';
  const resultCodeValue = result ? `, result: ${result}` : '';
  return `{ id: '${id}', type: 'click', stageId: '${stageId}', interaction: { kind: 'button', text: ${text}${pressCode}${replyCode}${resultCodeValue} } }`;
}

/**
 * Legacy only requires an extra confirmation when the rolled click-work total is >1.
 * A base of 1 with rand >1 can roll either 1 (no extra confirm) or >1 (extra confirm),
 * which the current primitive graph cannot branch on, so it must be rewritten manually.
 */
function clickWorkMode(work, declarations) {
  if (!work) return { kind: 'single' };
  const base = staticNumber(work.base, declarations);
  if (base === undefined || !Number.isSafeInteger(base) || base < 1) {
    return {
      kind: 'issue', code: 'unsupported-click-work',
      message: 'Click-work base must be a statically known positive safe integer for migration',
    };
  }
  const hasRand = work.rand !== undefined && !isUndefined(work.rand);
  const rand = hasRand ? staticNumber(work.rand, declarations) : 0;
  if (rand === undefined) {
    return {
      kind: 'issue', code: 'unsupported-click-work',
      message: 'Click-work rand must be a statically known finite number for migration',
    };
  }
  if (base === 1 && rand > 1) {
    return {
      kind: 'issue', code: 'ambiguous-click-confirm',
      message: 'Legacy random click-work can roll total 1 or greater than 1, which changes whether an extra confirmation is required; rewrite this page manually',
    };
  }
  if (base === 1) return { kind: 'single' };
  if (rand <= 1) return { kind: 'multi', work: { base: work.base } };
  if (!Number.isSafeInteger(rand)) {
    return {
      kind: 'issue', code: 'unsupported-click-work',
      message: 'Click-work rand above 1 must be a safe integer for migration',
    };
  }
  return { kind: 'multi', work };
}

function staticNumber(expression, declarations) {
  if (typeof expression === 'string') {
    const value = Number(expression);
    return expression.trim() !== '' && Number.isFinite(value) ? value : undefined;
  }
  const resolved = resolveExpression(expression, declarations);
  if (!resolved) return undefined;
  if (ts.isNumericLiteral(resolved)) return Number(resolved.text);
  if (ts.isPrefixUnaryExpression(resolved)
    && (resolved.operator === ts.SyntaxKind.MinusToken || resolved.operator === ts.SyntaxKind.PlusToken)) {
    const operand = staticNumber(resolved.operand, declarations);
    return operand === undefined ? undefined : resolved.operator === ts.SyntaxKind.MinusToken ? -operand : operand;
  }
  return undefined;
}

function resultCode(actions, transfer) {
  const fields = [];
  if (actions.length) fields.push(`actions: [${actions.join(', ')}]`);
  if (transfer) fields.push(`transfer: ${transfer}`);
  return fields.length ? `{ ${fields.join(', ')} }` : undefined;
}

function operationNode(id, action) {
  return `{ id: '${id}', type: 'operation', action: ${action} }`;
}

function transferNode(id, transfer) {
  return `{ id: '${id}', type: 'transfer', transfer: ${transfer} }`;
}

function transferCode(target, mode, sourceFile) {
  return `{ mode: ${textOf(mode, sourceFile)}, storyId: ${textOf(target, sourceFile)} }`;
}

function convertEffects(effectExpressions, sourceFile, options, storyId, issues, addIssue) {
  const actions = [];
  for (const expression of effectExpressions) {
    const action = convertEffect(expression, sourceFile, options);
    if (!action) {
      addIssue(expression, storyId, 'unsupported-effect', `Effect cannot be mapped to a StoryAction: ${textOf(expression, sourceFile)}`);
      continue;
    }
    const previous = actions.at(-1);
    if (action.kind === 'state' && previous?.kind === 'state') previous.effects.push(...action.effects);
    else actions.push(action);
  }
  return actions.map(action => action.kind === 'state'
    ? `{ kind: 'state', effects: [${action.effects.join(', ')}] }`
    : action.code);
}

function convertEffect(expression, sourceFile, options) {
  const object = resolveExpression(expression, collectDeclarations(sourceFile));
  const fields = objectProperties(object);
  if (!fields || !fields.has('op')) return undefined;
  const op = literalString(fields.get('op'));
  const target = fields.get('target');
  const value = fields.get('value');
  const source = value => textOf(value, sourceFile);
  const state = (fieldPairs) => ({ kind: 'state', effects: [objectFromPairs(fieldPairs)] });
  const definition = STATE_OPS.get(op);
  if (definition) {
    const [targetName, targetSource, valueName, numeric] = definition;
    if ((targetSource === 'target' && !target) || (targetSource === 'value' && !value) || (valueName && !value)) return undefined;
    const fieldsOut = [`op: '${op}'`];
    if (targetSource === 'target' && target) fieldsOut.push(`${targetName}: ${source(target)}`);
    else if (targetSource === 'value' && value) fieldsOut.push(`${targetName}: ${source(value)}`);
    if (valueName && value) fieldsOut.push(`${valueName}: ${numeric ? numericExpression(value, sourceFile) : source(value)}`);
    return state(fieldsOut);
  }
  if (op === 'travelToArea' && target) {
    return { kind: 'other', code: `{ kind: 'travel', areaId: ${source(target)}${literalBoolean(fields.get('notice')) === true ? ', notice: true' : ''} }` };
  }
  if (op === 'showChatText' && target && value) {
    const command = overlayShowCode(target, value, sourceFile, options);
    return command ? { kind: 'other', code: `{ kind: 'overlay', command: ${command} }` } : undefined;
  }
  if (op === 'clearIdChatFlow' && target) return { kind: 'other', code: `{ kind: 'overlay', command: { command: 'clearId', id: ${source(target)} } }` };
  if (op === 'clearAllChatText') return { kind: 'other', code: `{ kind: 'overlay', command: { command: 'clearAllTexts' } }` };
  if (op === 'clearAllChatFlow') return { kind: 'other', code: `{ kind: 'overlay', command: { command: 'clearFlow' } }` };
  if (op === 'setTheme' && value) return { kind: 'other', code: `{ kind: 'presentation', command: { command: 'theme', value: ${source(value)} } }` };
  if (op === 'setEntityPresentation' && target && value) {
    const settings = objectProperties(value);
    const optionId = settings?.get('optionId');
    const owner = settings?.get('owner') ?? fields.get('owner');
    const lifetime = settings?.get('lifetime');
    if (!optionId || !owner) return undefined;
    return { kind: 'other', code: `{ kind: 'presentation', command: { command: 'setEntityPresentation', target: ${source(target)}, optionId: ${source(optionId)}, owner: ${source(owner)}${lifetime ? `, lifetime: ${source(lifetime)}` : ''} } }` };
  }
  if (op === 'clearEntityPresentation' && target) {
    const settings = objectProperties(value);
    const owner = settings?.get('owner') ?? fields.get('owner');
    if (!owner) return undefined;
    return { kind: 'other', code: `{ kind: 'presentation', command: { command: 'clearEntityPresentation', target: ${source(target)}, owner: ${source(owner)} } }` };
  }
  if (op === 'showOpeningTitle') {
    const title = value && !isEmptyString(value, sourceFile) ? `, title: ${source(value)}` : '';
    return { kind: 'other', code: `{ kind: 'presentation', command: { command: 'openingTitle'${title} } }` };
  }
  if (op === 'triggerStory' && target) {
    const entryId = literalString(target);
    const entryType = entryId && options.entryTypes?.[entryId];
    if (!entryType || !entryId || (!fields.has('owner') && !Object.hasOwn(options.entryOwners ?? {}, entryId))) return undefined;
    const owner = fields.get('owner');
    const ownerText = owner ? source(owner) : JSON.stringify(Object.hasOwn(options.entryOwners ?? {}, entryId) ? options.entryOwners[entryId] : null);
    return { kind: 'other', code: `{ kind: 'entryRequest', request: { entryId: ${source(target)}, entryType: '${entryType}', owner: ${ownerText}, intent: 'system' } }` };
  }
  return undefined;
}

function overlayShowCode(target, value, sourceFile, options) {
  const fields = objectProperties(value);
  if (!fields) return undefined;
  const wrappers = [`command: 'show'`, `id: ${textOf(target, sourceFile)}`];
  for (const key of ['x', 'y', 'align']) if (fields.has(key)) wrappers.push(`${key}: ${textOf(fields.get(key), sourceFile)}`);
  let content;
  if (fields.has('talklet')) {
    const talklet = objectProperties(fields.get('talklet'));
    if (!talklet?.has('text')) return undefined;
    if (talklet.has('kizuna')) {
      const card = objectProperties(talklet.get('kizuna'));
      const targetId = card?.get('storyId');
      if (!targetId) return undefined;
      const owner = ownerForEntry(targetId, options);
      if (owner === undefined) return undefined;
      const entry = `{ entryId: ${textOf(targetId, sourceFile)}, entryType: 'active', owner: ${JSON.stringify(owner)}, intent: 'card' }`;
      const cardFields = [`request: ${entry}`];
      for (const key of ['title', 'buttonText', 'align']) if (card.has(key)) cardFields.push(`${key}: ${textOf(card.get(key), sourceFile)}`);
      content = `{ kind: 'entryCard', card: { ${cardFields.join(', ')} } }`;
    } else {
      const kind = literalString(talklet.get('kind')) ?? 'talk';
      if (kind !== 'talk' && kind !== 'narration') return undefined;
      const message = [`kind: '${kind}'`, `text: ${textOf(talklet.get('text'), sourceFile)}`];
      for (const key of ['speaker', 'image']) if (talklet.has(key)) message.push(`${key}: ${textOf(talklet.get(key), sourceFile)}`);
      const presentation = [];
      for (const key of ['side', 'align', 'avatar']) if (talklet.has(key)) presentation.push(`${key}: ${textOf(talklet.get(key), sourceFile)}`);
      if (literalBoolean(talklet.get('noAvatar')) === true) presentation.push(`avatarMode: 'hide'`);
      else if (literalBoolean(talklet.get('showAvatar')) === true) presentation.push(`avatarMode: 'show'`);
      content = `{ kind: 'message', content: { ${message.join(', ')} }${presentation.length ? `, presentation: { ${presentation.join(', ')} }` : ''}${fields.has('style') ? `, style: ${textOf(fields.get('style'), sourceFile)}` : ''} }`;
    }
  } else if (fields.has('text')) {
    const text = [`kind: 'text'`, `text: ${textOf(fields.get('text'), sourceFile)}`];
    if (fields.has('template')) text.push(`template: ${textOf(fields.get('template'), sourceFile)}`);
    if (fields.has('style')) text.push(`style: ${textOf(fields.get('style'), sourceFile)}`);
    content = `{ ${text.join(', ')} }`;
  }
  if (!content) return undefined;
  wrappers.push(`content: ${content}`);
  return `{ ${wrappers.join(', ')} }`;
}

function ownerForEntry(entryExpression, options) {
  const id = literalString(entryExpression);
  if (!id) return undefined;
  if (Object.hasOwn(options.entryOwners ?? {}, id)) return options.entryOwners[id];
  if (typeof options.ownerForEntry === 'function') return options.ownerForEntry(id);
  return undefined;
}

function entryCardCode(card, sourceFile, options, storyId, addIssue) {
  const target = card.target;
  const entryId = literalString(target);
  const owner = entryId ? ownerForEntry(target, options) : undefined;
  if (!entryId || owner === undefined) {
    addIssue(card.node ?? target, storyId, 'card-owner-unresolved', 'Entry card target needs an explicit target owner via options.entryOwners');
    return undefined;
  }
  const cardOptions = card.options ? objectProperties(card.options) : new Map();
  const fields = [`request: { entryId: ${textOf(target, sourceFile)}, entryType: 'active', owner: ${JSON.stringify(owner)}, intent: 'card' }`];
  for (const key of ['title', 'buttonText', 'align']) if (cardOptions?.has(key)) fields.push(`${key}: ${textOf(cardOptions.get(key), sourceFile)}`);
  return `{ ${fields.join(', ')} }`;
}

function applyTalkOptions(page, options) {
  for (const key of ['avatar', 'side', 'image']) if (options.has(key)) {
    if (key === 'image') page.content.image = options.get(key);
    else page.presentation[key] = options.get(key);
  }
  if (literalBoolean(options.get('mute')) === true) page.muteReply = true;
  if (literalBoolean(options.get('noAvatar')) === true) page.presentation.avatarMode = "'hide'";
}

function flattenCallChain(expression) {
  if (!ts.isCallExpression(expression)) return undefined;
  if (ts.isPropertyAccessExpression(expression.expression)) {
    const nested = flattenCallChain(expression.expression.expression);
    if (!nested) return undefined;
    if (expression.expression.name.text === 'build') return nested;
    nested.modifiers.push({ name: expression.expression.name.text, arguments: expression.arguments, node: expression });
    return nested;
  }
  if (ts.isIdentifier(expression.expression)) return { base: { name: expression.expression.text, arguments: expression.arguments }, modifiers: [] };
  return undefined;
}

function findProperty(object, name) {
  if (!ts.isObjectLiteralExpression(object)) return undefined;
  return object.properties.find(property => ts.isPropertyAssignment(property) && propertyName(property) === name);
}

function findStoryTalkletsProperty(object) {
  if (!ts.isObjectLiteralExpression(object)) return undefined;
  return object.properties.find(property =>
    (ts.isPropertyAssignment(property) && propertyName(property) === 'talklets')
    || (ts.isShorthandPropertyAssignment(property) && property.name.text === 'talklets'));
}

function objectProperties(expression) {
  if (!expression || !ts.isObjectLiteralExpression(expression)) return undefined;
  const properties = new Map();
  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property)) return undefined;
    properties.set(propertyName(property), property.initializer);
  }
  return properties;
}

function propertyName(property) {
  const name = property.name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return name.getText();
}

function arrayElements(expression) {
  return expression && ts.isArrayLiteralExpression(expression) ? [...expression.elements] : [];
}

function effectOperation(expression, sourceFile) {
  const fields = objectProperties(expression);
  return fields ? literalString(fields.get('op')) : undefined;
}

function literalString(expression) {
  return expression && ts.isStringLiteralLike(expression) ? expression.text : undefined;
}

function literalBoolean(expression) {
  if (!expression) return undefined;
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function isUndefined(expression) {
  return ts.isIdentifier(expression) && expression.text === 'undefined';
}

function isEmptyString(expression, sourceFile) {
  return literalString(expression) === '' || textOf(expression, sourceFile).trim() === "''" || textOf(expression, sourceFile).trim() === '""';
}

function numericExpression(expression, sourceFile) {
  const value = literalString(expression);
  return value !== undefined && /^-?(?:\d+\.?\d*|\.\d+)$/.test(value) ? value : textOf(expression, sourceFile);
}

function textOf(node, sourceFile) {
  if (typeof node === 'string') return node;
  return node?.getText(sourceFile) ?? 'undefined';
}

function objectFromPairs(pairs) {
  return `{ ${pairs.join(', ')} }`;
}

function isPropertyCall(call, name) {
  return ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === name;
}

function removeUnusedLegacyFactoryImports(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const replacements = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.includes('def-factory')) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        const removed = [];
        for (const specifier of bindings.elements) {
          const imported = specifier.propertyName?.text ?? specifier.name.text;
          if (!OLD_HELPERS.has(imported)) continue;
          const localName = specifier.name.text;
          let references = 0;
          const findReferences = (candidate) => {
            if (ts.isIdentifier(candidate) && candidate.text === localName && candidate !== specifier.name) references += 1;
            ts.forEachChild(candidate, findReferences);
          };
          findReferences(sourceFile);
          if (references === 0) removed.push(specifier);
        }
        if (removed.length) {
          const kept = bindings.elements.filter(specifier => !removed.includes(specifier));
          if (kept.length) {
            const names = kept.map(specifier => specifier.getText(sourceFile)).join(', ');
            replacements.push({ start: bindings.getStart(sourceFile), end: bindings.end, text: `{ ${names} }` });
          } else if (!clause.name) {
            let end = node.end;
            if (sourceText[end] === '\r' && sourceText[end + 1] === '\n') end += 2;
            else if (sourceText[end] === '\n') end += 1;
            replacements.push({ start: node.getStart(sourceFile), end, text: '' });
          } else {
            replacements.push({ start: bindings.getStart(sourceFile), end: bindings.end, text: '' });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  replacements.sort((a, b) => b.start - a.start);
  let result = sourceText;
  for (const replacement of replacements) result = `${result.slice(0, replacement.start)}${replacement.text}${result.slice(replacement.end)}`;
  return result;
}

async function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write('Usage: node scripts/migrate-story-content.mjs [--include <file-or-directory> ...] [--write]\nDefault mode is read-only preview. Import convertSourceText() for programmatic use.\n');
    return;
  }
  const write = args.includes('--write');
  const includeIndexes = args.flatMap((arg, index) => arg === '--include' && args[index + 1] ? [index + 1] : []);
  const inputs = includeIndexes.map(index => args[index]).filter(value => !value.startsWith('--'));
  if (!inputs.length) {
    process.stderr.write('Provide at least one --include path.\n');
    process.exitCode = 2;
    return;
  }
  let totalConverted = 0;
  let totalSkipped = 0;
  let totalIssues = 0;
  for (const input of inputs) {
    const absolute = path.resolve(input);
    const files = await expandInput(absolute);
    for (const file of files) {
      const before = await readFile(file, 'utf8');
      const result = convertSourceText(before, file, readOwnerMaps());
      totalConverted += result.converted;
      totalSkipped += result.skipped;
      totalIssues += result.issues.length;
      if (write && result.issues.length === 0 && result.converted > 0) await writeFile(file, result.text, 'utf8');
      process.stdout.write(`${write ? 'write' : 'preview'} ${path.relative(process.cwd(), file)}: converted=${result.converted}, skipped=${result.skipped}, issues=${result.issues.length}\n`);
      for (const issue of result.issues) process.stdout.write(`  ${issue.line}:${issue.column} ${issue.code}: ${issue.message}\n`);
    }
  }
  process.stdout.write(`Total: converted=${totalConverted}, skipped=${totalSkipped}, issues=${totalIssues}${write ? '' : ' (no files written)'}\n`);
  if (totalIssues > 0) process.exitCode = 1;
}

function readOwnerMaps() {
  return {
    entryTypes: {},
    entryOwners: {
      'base:activestory:bond_hoshino_evening': 'Hoshino',
      'base:activestory:run_chain_1': null,
    },
  };
}

async function expandInput(input) {
  const entries = await readdir(input, { withFileTypes: true }).catch(() => undefined);
  if (!entries) return [input];
  const files = [];
  for (const entry of entries) {
    const file = path.join(input, entry.name);
    if (entry.isDirectory()) files.push(...await expandInput(file));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(file);
  }
  return files;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) await main(process.argv.slice(2));
