import type { StoryChoiceOption, StoryClickNode, StoryNode, StoryNodeDocument, StoryTalkletNode } from '../contracts/story-node';
import type { StoryAction } from '../contracts/story-node-actions';
import { isStoryLocalFlagAction, validStoryFlagName } from './story-run-flags';
import { storyPerformanceIssues } from './story-performance';

export type StoryNodeStructureIssueCode =
  | 'invalid-id'
  | 'invalid-context'
  | 'duplicate-id'
  | 'missing-stage'
  | 'interaction-shape'
  | 'pacing-scope'
  | 'flag-shape'
  | 'duplicate-mark'
  | 'mark-owner'
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
  const markOwners = new Map<string, string>();

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
      if (interaction.kind === 'button' && hasOwn(interaction, 'result')) issue(`${nodePath}.interaction.result`, 'interaction-shape', 'Button no longer accepts result; use later nodes');
      if (interaction.kind === 'choice') {
        const interactionPath = `${nodePath}.interaction`;
        if (hasOwn(interaction, 'sharedActions')) issue(`${interactionPath}.sharedActions`, 'interaction-shape', 'Choice no longer accepts sharedActions');
        if (!Array.isArray(interaction.options)) {
          issue(`${interactionPath}.options`, 'interaction-shape', 'Choice options must be an array');
          continue;
        }
        interaction.options.forEach((option, i) => {
          const optionPath = `${interactionPath}.options[${i}]`;
          if (option === null || typeof option !== 'object' || Array.isArray(option)) {
            issue(optionPath, 'interaction-shape', 'Choice option must be an object');
            return;
          }
          if (hasOwn(option, 'condition')) issue(`${optionPath}.condition`, 'interaction-shape', 'Choice option no longer accepts condition; use showWhen');
          if (hasOwn(option, 'result')) issue(`${optionPath}.result`, 'interaction-shape', 'Choice option no longer accepts result; use marks and later nodes');
          if (option.requiresFlag !== undefined && !validStoryFlagName(option.requiresFlag)) {
            issue(`${optionPath}.requiresFlag`, 'flag-shape', 'requiresFlag must be one non-empty local flag name');
          }
          const optionMarks = new Set<string>();
          const marks: unknown = option.marks;
          if (marks !== undefined && !Array.isArray(marks)) {
            issue(`${optionPath}.marks`, 'flag-shape', 'Choice marks must be an array of local flag names');
            return;
          }
          const markValues = marks as unknown[] | undefined;
          for (let markIndex = 0; markValues && markIndex < markValues.length; markIndex += 1) {
            const markPath = `${optionPath}.marks[${markIndex}]`;
            if (!hasOwn(markValues, markIndex)) {
              issue(markPath, 'flag-shape', 'Choice marks cannot contain missing items');
              continue;
            }
            const mark = markValues[markIndex];
            if (!validStoryFlagName(mark)) issue(markPath, 'flag-shape', 'Choice marks must be non-empty local flag names');
            if (typeof mark === 'string') {
              if (optionMarks.has(mark)) issue(markPath, 'duplicate-mark', `Duplicate choice mark "${mark}" in one option`);
              optionMarks.add(mark);
              const owner = markOwners.get(mark);
              if (owner !== undefined && owner !== node.id) issue(markPath, 'mark-owner', `Choice mark "${mark}" is owned by multiple choice groups`);
              else markOwners.set(mark, node.id);
            }
          }
        });
      }
    }

    if (node.type === 'talklet' || node.type === 'click') {
      if (node.performance !== undefined) {
        let visual: unknown = node.performance;
        if (node.type === 'talklet' && node.performance?.pacing !== undefined) {
          const { pacing: _pacing, ...display } = node.performance;
          visual = display;
        }
        for (const error of storyPerformanceIssues(visual, node.type === 'click')) issue(`${nodePath}.performance${error.path}`, 'range', error.message);
      }
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

/** Find mark names owned by different Choice nodes in one explicit transfer graph. */
export function findStoryChoiceMarkOwnerConflict(
  rootStoryId: string,
  documents: ReadonlyMap<string, StoryNodeDocument>,
): string | undefined {
  const pending = [rootStoryId];
  const visited = new Set<string>();
  const owners = new Map<string, string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const document = documents.get(id);
    if (!document) continue;
    for (const node of document.nodes) {
      if (node.type === 'transfer') pending.push(node.transfer.storyId);
      if (node.type !== 'click') continue;
      const interaction = node.interaction;
      if (interaction.kind !== 'choice') continue;
      const owner = `${id}\u0000${node.id}`;
      const options = Array.isArray(interaction.options) ? interaction.options : [];
      for (const optionValue of options as unknown[]) {
        if (optionValue === null || typeof optionValue !== 'object' || Array.isArray(optionValue)) continue;
        const marks: unknown = (optionValue as StoryChoiceOption).marks;
        if (!Array.isArray(marks)) continue;
        for (const mark of marks) {
          if (typeof mark !== 'string') continue;
          const previous = owners.get(mark);
          if (previous !== undefined && previous !== owner) return mark;
          owners.set(mark, owner);
        }
      }
    }
  }
  return undefined;
}

function validatePacing(
  node: StoryTalkletNode,
  index: number,
  issue: (path: string, code: StoryNodeStructureIssueCode, message: string) => void,
): void {
  const pacing = node.performance?.pacing ?? node.pacing;
  const path = node.performance?.pacing === undefined ? 'pacing' : 'performance.pacing';
  const hasExplicitPacing = pacing?.typing !== undefined || pacing?.thinking !== undefined;
  if (hasExplicitPacing && (node.content.kind !== 'talk' || (node.appearance?.presentation ?? node.presentation)?.side === 'right')) {
    issue(`nodes[${index}].${path}`, 'pacing-scope', 'Explicit typing or thinking pacing is only valid for non-right Talk content');
  }
  for (const key of ['typing', 'thinking'] as const) {
    const value = pacing?.[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      issue(`nodes[${index}].${path}.${key}`, 'range', 'Pacing values must be finite non-negative numbers');
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
      const optionValue: unknown = interaction.options[optionIndex];
      if (optionValue === null || typeof optionValue !== 'object' || Array.isArray(optionValue)) {
        issue(`${optionsPath}[${optionIndex}]`, 'interaction-shape', 'A choice option must be an object');
        continue;
      }
      const option = optionValue as StoryChoiceOption;
      const optionPath = `${optionsPath}[${optionIndex}].id`;
      if (!LOCAL_NAME.test(option.id)) {
        issue(optionPath, 'invalid-id', 'Option ID must be a local name of 1–64 letters, digits, underscores, or hyphens, beginning with a letter');
      }
      if (optionIds.has(option.id)) issue(optionPath, 'duplicate-id', `Duplicate option ID "${option.id}" in this choice`);
      optionIds.add(option.id);
    }
  }
}
