import type { StoryDraft, StoryDraftNode } from './model';
import type { GameReadModel } from '../../arona-clicker/contracts/runtime/runtime';
import { resolveStorySpeaker } from '../components/story/story';
import { editProperty, editStoryNodeBody, propertyKey, readProperty, readStoryNodeBody, removeProperty, type PropertyPath } from './property-model';

interface TextField { selector: string; path: PropertyPath; shared?: boolean; name?: boolean }
function fields(node: StoryDraftNode): TextField[] {
  if (node.type === 'talklet') return [{ selector: '.chat-bubble > p.presentation-host-content, .chat-narration-text, .chat-text-overlay-inner, .chat-text-title > span, .chat-text-badge > span, .chat-text-note > span', path: ['content', 'text'], shared: true },
    ...(node.content?.kind === 'talk' ? [{ selector: '.chat-name', path: ['content', 'displayName'], name: true }] : [])];
  if (node.type !== 'click' || !node.interaction) return [];
  const interaction = node.interaction;
  if (interaction.kind === 'button') return [{ selector: '.send-text', path: ['interaction', 'text'], shared: true }];
  if (interaction.kind === 'choice') return (interaction.options ?? []).map((_, index) => ({
    selector: `.choice-card-options > :nth-child(${index + 1}) .choice-option-text`, path: ['interaction', 'options', index, 'text'],
  }));
  const footer = '.yuzu-kizuna-footer > .text';
  if (interaction.kind === 'entryCard') return [
    { selector: '.yuzu-kizuna-header > .text', path: ['interaction', 'card', 'title'] },
    { selector: footer, path: ['interaction', 'card', 'buttonText'], shared: true },
  ];
  return [{ selector: footer, path: ['interaction', 'buttonText'], shared: interaction.kind === 'areaContinue' }];
}
const branch = (node: StoryDraftNode): string => node.type === 'talklet' ? `talklet:${node.content?.kind}` : node.type === 'click' ? `click:${node.interaction?.kind}` : node.type;

/** Owns one plain-text edit; the draft remains the only authoring data source. */
export class StoryInlineTextEditor {
  private active?: { draft: StoryDraft; nodeId: string; key: string; branch: string; element: HTMLElement; before: string | undefined; initialText: string; bodyBefore: string; composing: boolean; finishRequested?: boolean; linePlaceholder?: Text };
  constructor(private readonly root: HTMLElement, private readonly game: GameReadModel, private readonly draft: () => StoryDraft | undefined,
    private readonly blocked: () => boolean, private readonly select: (nodeId: string) => void, private readonly refresh: () => void) {
    for (const type of ['dblclick', 'click', 'contextmenu', 'input', 'compositionstart', 'compositionend', 'keydown', 'paste', 'dragstart', 'drop', 'focusout']) root.addEventListener(type, this.handle, true);
    document.addEventListener('pointerdown', this.outside, true);
  }

  /** Decorate the existing text nodes, including the detached next render before reconciliation. */
  prepare(root: ParentNode): void {
    if (this.active && (!this.active.element.isConnected || !this.liveField())) this.finish();
    const draft = this.draft();
    if (!draft || this.blocked()) return;
    const nodes = new Map(draft.document.nodes.map(node => [node.id, node]));
    for (const container of root.querySelectorAll<HTMLElement>('[data-editor-node]')) {
      const node = nodes.get(container.dataset.editorNode ?? '');
      if (!node) continue;
      for (const field of fields(node)) {
        const text = container.querySelector<HTMLElement>(field.selector);
        if (!text) continue;
        const key = propertyKey(draft, node.id, field.path);
        text.dataset.storyInlineKey = key;
        text.dataset.editorKey = `inline:${key}`;
        text.title = field.name ? '双击修改临时显示名，保留头像' : '双击编辑正文';
        if (this.active?.draft === draft && this.active.key === key) {
          text.dataset.storyInlineActive = '';
          text.setAttribute('contenteditable', 'plaintext-only');
          text.setAttribute('role', 'textbox');
          text.setAttribute('aria-label', field.name ? '原位编辑发出方显示名' : '原位编辑正文');
          text.setAttribute('aria-multiline', field.name ? 'false' : 'true');
          container.draggable = false;
          container.setAttribute('role', 'group');
          container.removeAttribute('aria-pressed');
        }
        const row = text.closest<HTMLElement>('.choice-option-row, .choice-option');
        if (row) (row.closest<HTMLElement>('.choice-option-row') ?? row).dataset.editorKey = `inline-option:${key}`;
      }
    }
  }

  private liveField(): TextField | undefined {
    const edit = this.active;
    if (!edit || this.blocked() || this.draft() !== edit.draft) return;
    const node = edit.draft.document.nodes.find(node => node.id === edit.nodeId);
    if (!node || branch(node) !== edit.branch) return;
    return fields(node).find(field => propertyKey(edit.draft, node.id, field.path) === edit.key);
  }
  private write(): void {
    const edit = this.active, field = this.liveField();
    if (!edit || !field) return;
    let value = (edit.element.childElementCount ? edit.element.innerText : edit.element.textContent ?? '').replace(/\r\n?/g, '\n');
    // Chromium adds a second newline only to paint the caret on the final empty line.
    if (edit.linePlaceholder === edit.element.lastChild && edit.linePlaceholder?.data === '\n') value = value.slice(0, -1);
    if (value === edit.initialText && readProperty(edit.draft, edit.nodeId, field.path) === edit.before) return;
    if (value === (readProperty(edit.draft, edit.nodeId, field.path) ?? '')) return;
    if (field.name && !value.trim()) removeProperty(edit.draft, edit.nodeId, field.path);
    else if (field.shared) editStoryNodeBody(edit.draft, edit.nodeId, value);
    else editProperty(edit.draft, edit.nodeId, field.path, value);
  }
  finish(cancel = false): void {
    const edit = this.active;
    if (!edit) return;
    const field = this.liveField();
    if (field) {
      if (cancel) {
        if (readProperty(edit.draft, edit.nodeId, field.path) !== edit.before
          || field.shared && readStoryNodeBody(edit.draft, edit.nodeId) !== edit.bodyBefore) {
          if (field.shared) editStoryNodeBody(edit.draft, edit.nodeId, edit.bodyBefore);
          if (edit.before === undefined) removeProperty(edit.draft, edit.nodeId, field.path);
          else editProperty(edit.draft, edit.nodeId, field.path, edit.before);
        }
      } else this.write();
    }
    this.active = undefined;
    for (const name of ['contenteditable', 'role', 'aria-label', 'aria-multiline', 'data-story-inline-active']) edit.element.removeAttribute(name);
    this.refresh();
  }
  private begin(element: HTMLElement): void {
    const draft = this.draft(), container = element.closest<HTMLElement>('[data-editor-node]');
    const node = draft?.document.nodes.find(node => node.id === container?.dataset.editorNode);
    if (!draft || !node || this.blocked()) return;
    const field = fields(node).find(field => propertyKey(draft, node.id, field.path) === element.dataset.storyInlineKey);
    if (!field) return;
    if (this.active?.element === element) return;
    this.finish();
    const value = readProperty(draft, node.id, field.path);
    if (value !== undefined && typeof value !== 'string') return;
    this.select(node.id);
    const initialText = field.name && node.type === 'talklet' && node.content.kind === 'talk'
      ? resolveStorySpeaker(this.game, { ...node.content, side: node.presentation?.side }).name : value ?? '';
    this.active = { draft, nodeId: node.id, key: element.dataset.storyInlineKey!, branch: branch(node), element, initialText,
      before: value, bodyBefore: readStoryNodeBody(draft, node.id), composing: false };
    if (element.textContent !== initialText) element.textContent = initialText;
    this.prepare(this.root);
    element.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (selection && !element.contains(selection.anchorNode)) {
      const range = document.createRange(); range.selectNodeContents(element); range.collapse(false);
      selection.removeAllRanges(); selection.addRange(range);
    }
    this.refresh();
  }
  private insert(text: string): void {
    const edit = this.active, selection = window.getSelection();
    if (!edit || !selection) return;
    const range = selection.rangeCount && edit.element.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0) : document.createRange();
    if (!edit.element.contains(range.commonAncestorContainer)) { range.selectNodeContents(edit.element); range.collapse(false); }
    range.deleteContents();
    const hasPlaceholder = edit.linePlaceholder === edit.element.lastChild && edit.linePlaceholder?.data === '\n';
    const plain = text.replace(/\r\n?/g, '\n');
    const node = document.createTextNode(this.liveField()?.name ? plain.replace(/\n/g, ' ') : plain);
    range.insertNode(node); range.setStartAfter(node); range.collapse(true);
    if (hasPlaceholder && edit.element.lastChild instanceof Text && edit.element.lastChild !== node
      && edit.element.lastChild.data === '\n') edit.linePlaceholder = edit.element.lastChild;
    selection.removeAllRanges(); selection.addRange(range);
    this.write(); this.refresh();
  }
  private readonly outside = (event: Event): void => {
    if (this.active && event.target instanceof Node && !this.active.element.contains(event.target)) {
      if (this.active.composing) this.active.finishRequested = true;
      else this.finish();
    }
  };
  private readonly handle = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.type === 'dblclick') {
      const text = target?.closest<HTMLElement>('[data-story-inline-key]');
      if (!text || !this.root.contains(text) || this.blocked()) return;
      event.preventDefault(); event.stopPropagation(); this.begin(text); return;
    }
    const edit = this.active;
    if (!edit || !target || !edit.element.contains(target)) return;
    if (event.type === 'click' || event.type === 'contextmenu') { event.stopPropagation(); return; }
    if (event.type === 'dragstart' || event.type === 'drop') { event.preventDefault(); event.stopPropagation(); return; }
    if (event.type === 'compositionstart') { edit.composing = true; return; }
    if (event.type === 'compositionend') {
      edit.composing = false; this.write();
      if (edit.finishRequested) this.finish();
      else this.refresh();
      return;
    }
    if (event.type === 'input') {
      if (['insertParagraph', 'insertLineBreak'].includes((event as InputEvent).inputType)) {
        const last = edit.element.lastChild, selection = window.getSelection();
        if (last instanceof Text && last.data === '\n' && last.previousSibling?.textContent?.endsWith('\n')
          && selection?.anchorNode === last && selection.anchorOffset === 0) edit.linePlaceholder = last;
      }
      event.stopPropagation(); this.write();
      if (!edit.composing && !(event as InputEvent).isComposing) this.refresh();
    } else if (event.type === 'paste') {
      event.preventDefault(); this.insert((event as ClipboardEvent).clipboardData?.getData('text/plain') ?? '');
    } else if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Enter' && this.liveField()?.name && !edit.composing && !(event as KeyboardEvent).isComposing) {
      event.preventDefault(); event.stopPropagation(); this.finish();
    } else if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Escape' && !edit.composing && !(event as KeyboardEvent).isComposing) {
      event.preventDefault(); event.stopPropagation(); this.finish(true);
    } else if (event.type === 'focusout' && !edit.element.contains((event as FocusEvent).relatedTarget as Node | null)) this.finish();
  };
  dispose(): void {
    this.finish();
    for (const type of ['dblclick', 'click', 'contextmenu', 'input', 'compositionstart', 'compositionend', 'keydown', 'paste', 'dragstart', 'drop', 'focusout']) this.root.removeEventListener(type, this.handle, true);
    document.removeEventListener('pointerdown', this.outside, true);
  }
}
