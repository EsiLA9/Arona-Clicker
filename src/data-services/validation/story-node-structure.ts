import type { StoryClickNode, StoryNode, StoryNodeDocument, StoryTalkletNode } from '../contracts/story-node';
import type { StoryAction } from '../contracts/story-node-actions';
import { isStoryLocalFlagAction, validStoryFlagName } from './story-run-flags';

export type StoryNodeStructureIssueCode =
  | 'invalid-id'
  | 'invalid-context'
  | 'duplicate-id'
  | 'missing-stage'
  | 'interaction-shape'
  | 'pacing-scope'
  | 'flag-shape'
  | 'range';

export interface StoryNodeStructureIssue {
  readonly path: string;
  readonly code: StoryNodeStructureIssueCode;
  readonly message: string;
}

export interface StoryNodeStructureResult {
  readonly ok: boolean;
  readonly issues: readonly StoryNodeStructureIssue[];
}

const LOCAL_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const hasOwn = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);

/**
 * Check compatibility stage references and basic author relationships for an already typed StoryNodeDocument.
 * Stages no longer group or constrain playback; the ordered nodes array is the only flow definition.
 * This deliberately does not parse arbitrary JSON, resolve Registry references, or inspect action payloads.
 */
export function validateStoryNodeStructure(document: StoryNodeDocument): StoryNodeStructureResult {
  const issues: StoryNodeStructureIssue[] = [];
  const issue = (path: string, code: StoryNodeStructureIssueCode, message: string) => {
    issues.push({ path, code, message });
  };
  const declaredStageIds = Object.keys(document.stages);
  const nodeIds = new Set<string>();

  if (document.startContext?.type === 'area' ? !document.startContext.areaId : document.startContext?.type === 'chara' ? !document.startContext.characterId : true) {
    issue('startContext', 'invalid-context', 'Story must declare a valid Area or Chara start context');
  }

  for (const stageId of declaredStageIds) {
    if (!LOCAL_NAME.test(stageId)) issue(`stages.${stageId}`, 'invalid-id', 'Stage ID must be a local name of 1–64 letters, digits, underscores, or hyphens, beginning with a letter');
  }

  for (let index = 0; index < document.nodes.length; index += 1) {
    const node = document.nodes[index];
    const nodePath = `nodes[${index}]`;
    if (!LOCAL_NAME.test(node.id)) {
      issue(`${nodePath}.id`, 'invalid-id', 'Node ID must be a local name of 1–64 letters, digits, underscores, or hyphens, beginning with a letter');
    }
    if (nodeIds.has(node.id)) issue(`${nodePath}.id`, 'duplicate-id', `Duplicate node ID "${node.id}"`);
    nodeIds.add(node.id);
    if (node.requiresFlag !== undefined && !validStoryFlagName(node.requiresFlag)) {
      issue(`${nodePath}.requiresFlag`, 'flag-shape', 'requiresFlag must be one non-empty local flag name');
    }
    if (node.type === 'moveToArea' && !node.areaId) issue(`${nodePath}.areaId`, 'invalid-context', 'moveToArea requires an Area ID');
    if (node.type === 'moveToCharaspace' && !node.characterId) issue(`${nodePath}.characterId`, 'invalid-context', 'moveToCharaspace requires a character ID');
    const checkAction = (action: StoryAction | undefined, path: string) => {
      if (action?.kind === 'localFlag' && !isStoryLocalFlagAction(action)) issue(path, 'flag-shape', 'Invalid local flag set/remove action');
    };
    if (node.type === 'operation') checkAction(node.action, `${nodePath}.action`);
    if (node.type === 'click') {
      const interaction = node.interaction;
      if (interaction.kind === 'button') interaction.result?.actions?.forEach((action, i) => checkAction(action, `${nodePath}.interaction.result.actions[${i}]`));
      if (interaction.kind === 'choice') {
        interaction.sharedActions?.forEach((action, i) => checkAction(action, `${nodePath}.interaction.sharedActions[${i}]`));
        interaction.options.forEach((option, i) => option.result?.actions?.forEach((action, j) => checkAction(action, `${nodePath}.interaction.options[${i}].result.actions[${j}]`)));
      }
    }

    if (node.type === 'talklet' || node.type === 'click') {
      if (!LOCAL_NAME.test(node.stageId)) {
        issue(`${nodePath}.stageId`, 'invalid-id', 'Stage ID must be a local name of 1–64 letters, digits, underscores, or hyphens, beginning with a letter');
      }
      if (!hasOwn(document.stages, node.stageId)) {
        issue(`${nodePath}.stageId`, 'missing-stage', `Stage "${node.stageId}" is not declared by this document`);
      }
      if (node.type === 'talklet') validatePacing(node, index, issue);
      else validateClick(node, index, issue);
    }
  }

  return { ok: issues.length === 0, issues };
}

function validatePacing(
  node: StoryTalkletNode,
  index: number,
  issue: (path: string, code: StoryNodeStructureIssueCode, message: string) => void,
): void {
  const hasExplicitPacing = node.pacing?.typing !== undefined || node.pacing?.thinking !== undefined;
  if (hasExplicitPacing && (node.content.kind !== 'talk' || node.presentation?.side === 'right')) {
    issue(`nodes[${index}].pacing`, 'pacing-scope', 'Explicit typing or thinking pacing is only valid for non-right Talk content');
  }
  for (const key of ['typing', 'thinking'] as const) {
    const value = node.pacing?.[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      issue(`nodes[${index}].pacing.${key}`, 'range', 'Pacing values must be finite non-negative numbers');
    }
  }
}

function validateClick(
  node: StoryClickNode,
  index: number,
  issue: (path: string, code: StoryNodeStructureIssueCode, message: string) => void,
): void {
  const interaction = node.interaction;
  if (interaction.kind === 'button' && interaction.press) {
    const { base, rand } = interaction.press;
    const baseValid = Number.isSafeInteger(base) && base >= 1;
    const randValid = rand === undefined || (Number.isSafeInteger(rand) && rand >= 0);
    if (!baseValid) issue(`nodes[${index}].interaction.press.base`, 'range', 'Press base must be a positive safe integer');
    if (!randValid) issue(`nodes[${index}].interaction.press.rand`, 'range', 'Press rand must be a non-negative safe integer');
    if (baseValid && randValid && !Number.isSafeInteger(base + Math.max((rand ?? 0) - 1, 0))) {
      issue(`nodes[${index}].interaction.press`, 'range', 'Total press work must remain a safe integer');
    }
  }

  if (interaction.kind === 'choice') {
    const optionsPath = `nodes[${index}].interaction.options`;
    if (interaction.options.length === 0) issue(optionsPath, 'interaction-shape', 'A choice must contain at least one option');
    const optionIds = new Set<string>();
    for (let optionIndex = 0; optionIndex < interaction.options.length; optionIndex += 1) {
      const option = interaction.options[optionIndex];
      const optionPath = `${optionsPath}[${optionIndex}].id`;
      if (!LOCAL_NAME.test(option.id)) {
        issue(optionPath, 'invalid-id', 'Option ID must be a local name of 1–64 letters, digits, underscores, or hyphens, beginning with a letter');
      }
      if (optionIds.has(option.id)) issue(optionPath, 'duplicate-id', `Duplicate option ID "${option.id}" in this choice`);
      optionIds.add(option.id);
    }
  }
}
