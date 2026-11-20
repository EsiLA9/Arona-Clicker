import type { ConditionGroup, ConditionTarget } from '../../engine/types/expression';
import type { ModalManager } from '../interaction/modal';
import type { UIContext } from '../runtime/context';
import { conditionFieldLabels, STORY_CONDITION_REFERENCES, STORY_CONDITION_TARGETS } from './condition-fields';
import { createConditionReferencePicker } from '../components/shared/condition-reference-picker';
import { conditionReferenceChoices } from './condition-reference-navi';
import {
  conditionLeafEditor, describeConditionTreeLeaf, renderConditionLeafFields,
  type ConditionLeafView,
} from './condition-leaf-editors';
import {
  compileConditionTree, conditionTreeLocation, createConditionTree, moveConditionTreeNode,
  type ConditionRootMode, type ConditionTreeGroup, type ConditionTreeLeaf, type ConditionTreeNode,
} from './condition-tree-model';
import { patchEditorDOM } from './dom';
import { openStoryEditorDialog } from './editor-dialog';
import type { StoryEditorState } from './model';
import type { StoryReferenceKind } from './property-options';

const DRAG_TYPE = 'application/x-acprogram-story-condition';
const OPERATORS: [ConditionGroup['type'], string][] = [['AND', '全部满足 · AND'], ['OR', '任一满足 · OR']];

interface ConditionTreeOptions {
  original?: unknown;
  label: string;
  defaultTrue?: boolean;
  targets: typeof STORY_CONDITION_TARGETS;
  state: StoryEditorState;
  globalFlags: readonly string[];
  availableInits: readonly string[];
  pendingValue?: (path: readonly (number | string)[]) => string | undefined;
  beforeRemove: (root: HTMLElement) => void;
  onClose: () => void;
  commit: (value: ConditionGroup) => string | undefined;
}

export function openConditionTreeDialog(modal: ModalManager, ctx: UIContext, trigger: HTMLElement, options: ConditionTreeOptions): HTMLElement {
  const seed = options.original === undefined && options.defaultTrue ? { type: 'AND', conditions: [] } : options.original;
  const { root, mode: initialMode, newGroup, newLeaf } = createConditionTree(seed, options.pendingValue);
  const initial = compileConditionTree(root, initialMode);
  let mode: ConditionRootMode = initialMode;
  let selected: ConditionTreeNode = root;
  let subEditor: ReturnType<typeof createConditionReferencePicker> | undefined;
  let dragging: string | undefined;
  let highlighted: HTMLElement | undefined;
  const escape = ctx.escapeHtml;
  const refs = new Map<StoryReferenceKind, ReturnType<typeof conditionReferenceChoices>>();
  const choices = (kind: StoryReferenceKind) => {
    const existing = refs.get(kind);
    if (existing) return existing;
    const preferred = options.availableInits.length ? options.availableInits : [ctx.view.activeInit];
    const items = conditionReferenceChoices(ctx, options.state, kind, preferred);
    refs.set(kind, items);
    return items;
  };
  const labelOf = (kind: StoryReferenceKind, key: string) => choices(kind).find(item => item.value === key)?.label ?? key;
  const operatorLabel = (group: ConditionTreeGroup) => OPERATORS.find(([operator]) => operator === group.operator)?.[1];

  const renderNode = (node: ConditionTreeNode): string => {
    const isRoot = node === root;
    const isTrue = isRoot && mode === 'true';
    const group = node.kind === 'group' ? node : undefined;
    const text = isTrue ? '恒为 True' : node.kind === 'group' ? operatorLabel(node) ?? '子组 · 待填写' : describeConditionTreeLeaf(node, leafView);
    return `<li data-editor-key="condition-node:${node.id}">
      ${isRoot ? '' : `<div class="condition-tree-gap" data-condition-before="${node.id}" aria-hidden="true"></div>`}
      <div class="condition-tree-row"${group ? ` data-condition-into="${node.id}"` : ''}>
        ${group && (!isTrue || group.children.length) ? `<button type="button" class="condition-tree-disclosure" data-condition-toggle="${node.id}" aria-label="${group.expanded ? '收起' : '展开'}条件组" aria-expanded="${group.expanded}">${group.expanded ? '▾' : '▸'}</button>` : ''}
        <button type="button" class="condition-tree-node" data-condition-select="${node.id}" aria-pressed="${node === selected}"${!isRoot ? ' draggable="true"' : ''}>${escape(text)}</button>
      </div>
      ${group?.expanded && group.children.length ? `<ul>${group.children.map(renderNode).join('')}</ul>` : ''}
    </li>`;
  };

  const selectField = (name: string, caption: string, value: string, items: readonly [string, string][], placeholder?: string) =>
    `<label data-editor-key="condition-label:${name}">${escape(caption)}<select data-condition-field="${name}">
      ${placeholder ? `<option value=""${value ? '' : ' selected'}>${escape(placeholder)}</option>` : ''}
      ${value && !items.some(([id]) => id === value) ? `<option value="${escape(value)}" selected>${escape(value)}（未知）</option>` : ''}
      ${items.map(([id, label]) => `<option value="${escape(id)}"${value === id ? ' selected' : ''}>${escape(label)}</option>`).join('')}
    </select></label>`;

  const leafView: ConditionLeafView = { escape, select: selectField, choices, labelOf, globalFlags: options.globalFlags, targets: options.targets };

  const properties = (): string => {
    const isRoot = selected === root;
    const title = isRoot ? '根节点' : selected.kind === 'group' ? '条件组' : '单条条件';
    const fields = isRoot ? selectField('mode', '根节点模式', mode, [['OR', '任一满足 · OR'], ['true', '恒为 True']])
      : selected.kind === 'group' ? selectField('operator', '组内关系', selected.operator, OPERATORS, '选择组内关系')
      : renderConditionLeafFields(selected, leafView);
    const actions = selected.kind === 'group'
      ? '<button type="button" class="mini-action" data-condition-add="leaf">添加条件</button><button type="button" class="mini-action" data-condition-add="group">添加子组</button>'
      : '';
    const hint = isRoot && mode === 'true' ? '保存时保留子条件，切回 OR 后子条件参与判断。'
      : selected.kind === 'group' && !selected.children.length && selected.operator
        ? selected.operator === 'AND' ? '空 AND 恒成立。' : '空 OR 恒不成立。'
        : '';
    return `<div class="condition-tree-fields" data-editor-key="condition-properties:${selected.id}">
      <h3>${title}</h3>${fields}
      ${hint ? `<small class="story-editor-hint">${hint}</small>` : ''}
      <div class="story-editor-actions">${actions}${isRoot ? '' : '<button type="button" class="mini-action mini-action--danger" data-condition-remove>删除节点</button>'}</div>
    </div>`;
  };

  const panel = openStoryEditorDialog(modal, {
    title: `编辑${options.label}`,
    panelClass: 'story-condition-dialog',
    body: `<div class="condition-tree-layout">
      <section class="condition-tree-pane" aria-label="条件树" data-condition-tree><ul class="condition-tree-list">${renderNode(root)}</ul></section>
      <section class="condition-tree-pane" aria-label="节点属性" data-condition-properties>${properties()}</section>
    </div><div class="condition-reference-page" data-condition-reference-page hidden></div>`,
    footer: '<p class="story-editor-error condition-tree-error" data-condition-error role="alert" hidden></p><button type="button" class="modal-close">取消</button><button type="button" class="primary-button" data-modal-action="apply-condition-tree">确认</button>',
    onClose: options.onClose,
    onAction: action => {
      if (action !== 'apply-condition-tree') return;
      if (subEditor) {
        showError('请先确认或返回当前选择。');
        return;
      }
      const result = compileConditionTree(root, mode);
      if ('message' in result) {
        const problem = conditionTreeLocation(root, result.nodeId);
        if (problem) {
          selected = problem.node;
          for (let parent = problem.parent; parent !== root;) {
            parent.expanded = true;
            parent = conditionTreeLocation(root, parent.id)!.parent;
          }
          root.expanded = true;
          refresh();
          tree.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest' });
        }
        const message = problem?.node.kind === 'leaf' && conditionLeafEditor(problem.node.target)?.incomplete?.(problem.node);
        showError(message || result.message);
        return;
      }
      if (options.original !== undefined && 'condition' in initial
        && JSON.stringify(initial.condition) === JSON.stringify(result.condition)) {
        modal.close();
        return;
      }
      const error = options.commit(result.condition);
      if (error) showError(error);
      else modal.close();
    },
  }, trigger);
  const tree = panel.querySelector<HTMLElement>('[data-condition-tree]')!;
  const detail = panel.querySelector<HTMLElement>('[data-condition-properties]')!;
  const layout = panel.querySelector<HTMLElement>('.condition-tree-layout')!;
  const picker = panel.querySelector<HTMLElement>('[data-condition-reference-page]')!;
  const footer = panel.querySelector<HTMLElement>('.modal-foot')!;
  const errorMessage = panel.querySelector<HTMLElement>('[data-condition-error]')!;
  const showError = (message = '') => {
    errorMessage.textContent = message;
    errorMessage.hidden = !message;
  };
  const patch = (element: HTMLElement, html: string) => {
    const next = element.cloneNode(false) as HTMLElement;
    next.innerHTML = html;
    patchEditorDOM(element, next, options.beforeRemove);
  };
  const refreshTree = () => patch(tree, `<ul class="condition-tree-list">${renderNode(root)}</ul>`);
  const refreshDetail = () => patch(detail, properties());
  const refresh = () => {
    refreshTree();
    refreshDetail();
  };
  const nodeFor = (id: string) => id === root.id ? root : conditionTreeLocation(root, id)?.node;
  const updateSubEditor = (field: string, value: string) => {
    if (!subEditor) return;
    subEditor.update(field, value);
    patch(picker, subEditor.render());
  };
  panel.addEventListener('click', event => {
    const action = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : undefined;
    if (!action) return;
    const { conditionSubeditor, conditionPickerChoice, conditionPickerFilter } = action.dataset;
    if (subEditor && conditionPickerChoice !== undefined) {
      updateSubEditor('choice', conditionPickerChoice);
      return;
    }
    if (subEditor && conditionPickerFilter !== undefined) {
      updateSubEditor('filter', conditionPickerFilter);
      return;
    }
    if (action.hasAttribute('data-condition-open-editor') && selected.kind === 'leaf') {
      const node = selected;
      const kind = STORY_CONDITION_REFERENCES[node.target as ConditionTarget];
      if (!kind) return;
      subEditor = createConditionReferencePicker(ctx, conditionFieldLabels(node.target).key, choices(kind), node.key ?? '', key => { node.key = key; },
        kind === 'story' ? { otherLabel: '其他' } : undefined);
      showError();
      layout.hidden = footer.hidden = true;
      picker.hidden = false;
      patch(picker, subEditor.render());
      picker.querySelector<HTMLElement>('[data-condition-subfield]')?.focus({ preventScroll: true });
      return;
    }
    if (subEditor && (conditionSubeditor === 'back' || conditionSubeditor === 'confirm')) {
      if (conditionSubeditor === 'confirm' && !subEditor.confirm()) return;
      subEditor = undefined;
      picker.hidden = true;
      patch(picker, '');
      layout.hidden = footer.hidden = false;
      showError();
      if (conditionSubeditor === 'confirm') refresh();
      detail.querySelector<HTMLElement>('[data-condition-open-editor]')?.focus({ preventScroll: true });
      return;
    }
    if (subEditor) return;
    const { conditionSelect, conditionToggle, conditionAdd } = action.dataset;
    if (conditionSelect !== undefined) {
      const node = nodeFor(conditionSelect);
      if (node) selected = node;
    } else if (conditionToggle !== undefined) {
      const node = nodeFor(conditionToggle);
      if (node?.kind !== 'group') return;
      node.expanded = !node.expanded;
      if (!node.expanded && conditionTreeLocation(node, selected.id)) selected = node;
    } else if (conditionAdd && selected.kind === 'group') {
      selected.children.push(conditionAdd === 'group' ? newGroup() : newLeaf());
      selected.expanded = true;
    } else if (action.hasAttribute('data-condition-remove')) {
      const location = conditionTreeLocation(root, selected.id);
      if (!location) return;
      location.parent.children.splice(location.index, 1);
      selected = location.parent;
    } else return;
    showError();
    refresh();
  });

  panel.addEventListener('change', event => {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const { conditionField: field, conditionSubfield } = event.target.dataset;
    const value = event.target.value;
    if (subEditor && conditionSubfield) {
      updateSubEditor(conditionSubfield, value);
      return;
    }
    if (field === 'mode' && selected === root && (value === 'true' || value === 'OR')) mode = value;
    else if (field === 'operator' && selected.kind === 'group' && selected !== root && (value === '' || value === 'AND' || value === 'OR')) selected.operator = value;
    else if (field === 'target' && selected.kind === 'leaf') {
      if (value === selected.target) return;
      if (value && !options.targets.some(([target]) => target === value)) return;
      Object.assign(selected, { target: value, key: undefined, comparator: '', value: '' });
    } else if (field && selected.kind === 'leaf') {
      if (field === 'comparator') selected.comparator = value;
      else if (field === 'key') selected.key = value || undefined;
      else if (!conditionLeafEditor(selected.target)?.update?.(selected, field, value)) return;
      showError();
      refreshTree();
      return;
    } else return;
    showError();
    refresh();
  });
  panel.addEventListener('input', event => {
    if (!(event.target instanceof HTMLInputElement) || selected.kind !== 'leaf') return;
    if (subEditor && event.target.dataset.conditionSubfield) {
      updateSubEditor(event.target.dataset.conditionSubfield, event.target.value);
      return;
    }
    if (event.target.dataset.conditionField === 'value') selected.value = event.target.value;
    else if (event.target.dataset.conditionField === 'key') selected.key = event.target.value.trim() ? event.target.value : undefined;
    else return;
    showError();
    refreshTree();
    if (event.target.hasAttribute('data-condition-reference-input')) {
      const kind = STORY_CONDITION_REFERENCES[selected.target as ConditionTarget];
      const key = selected.key;
      const item = kind && choices(kind).find(row => row.value === key);
      const summary = detail.querySelector<HTMLElement>('[data-condition-reference-summary]');
      if (summary) {
        summary.hidden = !item;
        summary.textContent = item ? `${item.label} · ${item.scope}` : '';
      }
    }
  });

  const highlight = (element?: HTMLElement) => {
    if (highlighted === element) return;
    highlighted?.classList.remove('is-drop-target');
    highlighted = element;
    highlighted?.classList.add('is-drop-target');
  };
  const dropTarget = (target: EventTarget | null) => {
    if (!dragging || !(target instanceof Element)) return;
    const element = target.closest<HTMLElement>('[data-condition-before], [data-condition-into]');
    if (!element || !tree.contains(element)) return;
    const position = conditionTreeLocation(root, element.dataset.conditionBefore ?? '');
    const parent = position?.parent ?? nodeFor(element.dataset.conditionInto ?? '');
    const dragged = nodeFor(dragging);
    if (parent?.kind !== 'group' || !dragged || dragged === parent || dragged === position?.node
      || dragged.kind === 'group' && conditionTreeLocation(dragged, parent.id)) return;
    return { element, parent, before: position?.node };
  };
  tree.addEventListener('dragstart', event => {
    const row = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-condition-select][draggable]') : undefined;
    const id = row?.dataset.conditionSelect;
    if (!id || !event.dataTransfer) return;
    dragging = id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_TYPE, id);
  });
  tree.addEventListener('dragover', event => {
    const target = dropTarget(event.target);
    highlight(target?.element);
    if (!target) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });
  tree.addEventListener('dragleave', event => {
    if (!(event.relatedTarget instanceof Node) || !tree.contains(event.relatedTarget)) highlight();
  });
  tree.addEventListener('drop', event => {
    const target = dropTarget(event.target);
    const id = event.dataTransfer?.getData(DRAG_TYPE);
    highlight();
    if (target && id && id === dragging) {
      event.preventDefault();
      if (moveConditionTreeNode(root, id, target.parent, target.before)) {
        showError();
        refreshTree();
      }
    }
    dragging = undefined;
  });
  tree.addEventListener('dragend', () => {
    dragging = undefined;
    highlight();
  });

  return panel;
}
