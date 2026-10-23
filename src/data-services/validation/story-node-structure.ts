import type { StoryClickNode, StoryNode, StoryNodeDocument, StoryTalkletNode } from '../contracts/story-node';

export type StoryNodeStructureIssueCode =
  | 'invalid-id'
  | 'duplicate-id'
  | 'missing-stage'
  | 'unused-stage'
  | 'non-contiguous-stage'
  | 'stage-shape'
  | 'interaction-shape'
  | 'pacing-scope'
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

interface StageRun {
  readonly id: string;
  readonly talkletIndexes: number[];
  readonly clickIndexes: number[];
  lastNodeIndex: number;
}

/**
 * Check stage membership and basic author relationships for an already typed StoryNodeDocument.
 * This deliberately does not parse arbitrary JSON, resolve Registry references, or inspect action payloads.
 */
export function validateStoryNodeStructure(document: StoryNodeDocument): StoryNodeStructureResult {
  const issues: StoryNodeStructureIssue[] = [];
  const issue = (path: string, code: StoryNodeStructureIssueCode, message: string) => {
    issues.push({ path, code, message });
  };
  const declaredStageIds = Object.keys(document.stages);
  const declaredStages = new Set(declaredStageIds);
  const usedStageIds = new Set<string>();
  const nodeIds = new Set<string>();
  const closedStageIds = new Set<string>();
  let stageRun: StageRun | undefined;

  for (const stageId of declaredStageIds) {
    if (!LOCAL_NAME.test(stageId)) issue(`stages.${stageId}`, 'invalid-id', 'Stage ID must be a local name of 1–64 letters, digits, underscores, or hyphens, beginning with a letter');
  }

  const validateStageRun = (run: StageRun) => {
    if (!hasOwn(document.stages, run.id)) return;
    const advance = document.stages[run.id].advance;
    if (advance === 'auto') {
      if (run.talkletIndexes.length === 0) {
        issue(`stages.${run.id}.advance`, 'stage-shape', 'An auto stage must contain at least one Talklet');
      }
      for (const index of run.clickIndexes) {
        issue(`nodes[${index}].stageId`, 'stage-shape', 'An auto stage cannot contain a Click');
      }
      return;
    }

    if (run.clickIndexes.length === 0) {
      issue(`stages.${run.id}.advance`, 'stage-shape', 'An input stage must contain exactly one Click');
    } else if (run.clickIndexes.length > 1) {
      issue(`nodes[${run.clickIndexes[1]}].stageId`, 'stage-shape', 'An input stage must contain exactly one Click');
    }
    const clickIndex = run.clickIndexes[0];
    if (clickIndex !== undefined && clickIndex !== run.lastNodeIndex) {
      issue(`nodes[${clickIndex}].stageId`, 'stage-shape', 'The Click must be the last member of its input stage');
    }
  };

  const closeStageRun = () => {
    if (!stageRun) return;
    validateStageRun(stageRun);
    closedStageIds.add(stageRun.id);
    stageRun = undefined;
  };

  for (let index = 0; index < document.nodes.length; index += 1) {
    const node = document.nodes[index];
    const nodePath = `nodes[${index}]`;
    if (!LOCAL_NAME.test(node.id)) {
      issue(`${nodePath}.id`, 'invalid-id', 'Node ID must be a local name of 1–64 letters, digits, underscores, or hyphens, beginning with a letter');
    }
    if (nodeIds.has(node.id)) issue(`${nodePath}.id`, 'duplicate-id', `Duplicate node ID "${node.id}"`);
    nodeIds.add(node.id);

    if (node.type === 'talklet' || node.type === 'click') {
      usedStageIds.add(node.stageId);
      if (!LOCAL_NAME.test(node.stageId)) {
        issue(`${nodePath}.stageId`, 'invalid-id', 'Stage ID must be a local name of 1–64 letters, digits, underscores, or hyphens, beginning with a letter');
      }
      if (!hasOwn(document.stages, node.stageId)) {
        issue(`${nodePath}.stageId`, 'missing-stage', `Stage "${node.stageId}" is not declared by this document`);
      }
      if (!stageRun || stageRun.id !== node.stageId) {
        closeStageRun();
        if (closedStageIds.has(node.stageId)) {
          issue(`${nodePath}.stageId`, 'non-contiguous-stage', `Stage "${node.stageId}" must occupy one continuous node range`);
        }
        stageRun = { id: node.stageId, talkletIndexes: [], clickIndexes: [], lastNodeIndex: index };
      }
      stageRun.lastNodeIndex = index;
      if (node.type === 'talklet') {
        stageRun.talkletIndexes.push(index);
        validatePacing(node, index, issue);
      } else {
        stageRun.clickIndexes.push(index);
        validateClick(node, index, issue);
      }
    } else {
      // Operation and Transfer nodes end a stage run; they never belong to a stage.
      closeStageRun();
    }
  }
  closeStageRun();

  for (const stageId of declaredStages) {
    if (!usedStageIds.has(stageId)) issue(`stages.${stageId}`, 'unused-stage', `Stage "${stageId}" has no Talklet or Click members`);
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
