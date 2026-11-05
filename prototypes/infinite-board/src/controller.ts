import { screenToWorld, snap, worldToScreen, zoomAt } from './geometry';
import { addEdge, copyNode, createNode, deleteEdge, deleteNode, loadBoard, parseBoard, saveBoard, transferEdgeEndpoint } from './model';
import { BoardView } from './view';
import { defaultPort, ELEMENT_TYPES, isConnectionAllowed } from './element-types';
import { GRID_SIZE, MIN_NODE_HEIGHT, MIN_NODE_WIDTH, type Board, type Edge, type EdgeKind, type ElementTypeId, type Node as BoardNode, type NodeKind, type Point } from './types';

type Gesture =
  | { kind: 'select'; pointerId: number; start: Point; previousSelection: { nodeIds: string[]; edgeId: string | null }; moved: boolean }
  | { kind: 'move'; pointerId: number; start: Point; origins: Map<string, Point>; moved: boolean }
  | { kind: 'resize'; pointerId: number; start: Point; nodeId: string; side: ResizeSide; origin: { x: number; y: number; w: number; h: number } }
  | { kind: 'connect'; pointerId: number; start: Point; sourceId: string; sourcePortId: string }
  | { kind: 'edge-transfer'; pointerId: number; start: Point; edgeId: string; side: 'source' | 'target'; moved: boolean };

type ResizeSide = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export class BoardController {
  readonly board: Board;
  readonly view: BoardView;
  private readonly viewport = document.querySelector<HTMLElement>('#viewport')!;
  private readonly world = document.querySelector<HTMLElement>('#world')!;
  private readonly nodesHost = document.querySelector<HTMLElement>('#nodes')!;
  private readonly svg = document.querySelector<SVGSVGElement>('#edges')!;
  private readonly popup = document.querySelector<HTMLElement>('#popup')!;
  private readonly status = document.querySelector<HTMLElement>('#status')!;
  private readonly zoomButton = document.querySelector<HTMLButtonElement>('#zoom button')!;
  private selectedNodeId: string | null = null;
  private readonly selectedNodeIds = new Set<string>();
  private selectedEdgeId: string | null = null;
  private quickEditor: HTMLInputElement | HTMLTextAreaElement | null = null;
  private middleMouseDown = false;
  private mousePan: { start: Point; view: Board['view'] } | null = null;
  private readonly selectionBox = document.createElement('div');
  private quickEditCommit: ((value: string) => void) | null = null;
  private gesture: Gesture | null = null;
  private connectingFrom: string | null = null;
  private connectingFromPortId: string | null = null;
  private suppressClick = false;
  private clipboard: BoardNode | null = null;
  private contextPoint: Point = { x: 0, y: 0 };
  private pendingRenderFrame: number | null = null;
  private cameraRenderPending = false;
  private readonly dirtyNodeIds = new Set<string>();
  private persistTimer: number | null = null;
  private hoveredResizeNode: HTMLElement | null = null;

  constructor() {
    const loaded = loadBoard();
    this.board = loaded.board;
    this.view = new BoardView(this.viewport, this.world, this.nodesHost, this.svg);
    this.selectionBox.className = 'selection-box';
    this.selectionBox.hidden = true;
    this.viewport.append(this.selectionBox);
    this.bindEvents();
    this.render();
    if (loaded.warning) this.say(loaded.warning);
  }

  private bindEvents(): void {
    this.viewport.addEventListener('contextmenu', event => this.onContextMenu(event));
    this.viewport.addEventListener('pointerdown', event => this.onPointerDown(event));
    this.viewport.addEventListener('pointermove', event => this.onPointerMove(event));
    this.viewport.addEventListener('pointerup', event => this.onPointerUp(event));
    this.viewport.addEventListener('pointercancel', () => { this.cancelGesture(); if (this.mousePan) this.endMousePan(); });
    this.viewport.addEventListener('lostpointercapture', () => { if (this.gesture) this.cancelGesture(); });
    this.viewport.addEventListener('click', event => this.onClick(event));
    this.viewport.addEventListener('dblclick', event => {
      const target = event.target as Element;
      const node = target.closest<HTMLElement>('.node');
      const edge = target.closest<SVGGElement>('[data-edge-id]');
      if (node?.dataset.nodeId && target.closest('.node__title')) this.editNodeText(node.dataset.nodeId, 'title', node.querySelector<HTMLElement>('.node__title')!);
      else if (node?.dataset.nodeId && target.closest('.node__description')) this.editNodeText(node.dataset.nodeId, 'description', node.querySelector<HTMLElement>('.node__description')!);
      else if (edge?.dataset.edgeId) this.editEdgeLabel(edge.dataset.edgeId);
    });
    this.viewport.addEventListener('wheel', event => {
      if ((event.target as Element).closest('.floating, .quick-edit')) return;
      event.preventDefault();
      this.board.view = zoomAt(this.board.view, this.local({ x: event.clientX, y: event.clientY }), event.deltaY);
      this.scheduleCameraRender();
      this.updateZoomLabel();
      this.schedulePersist();
    }, { passive: false });
    this.nodesHost.addEventListener('keydown', event => this.onKeyDown(event));
    this.svg.addEventListener('keydown', event => this.onKeyDown(event));
    document.addEventListener('keydown', event => this.onDocumentKeyDown(event));
    document.addEventListener('mousedown', event => {
      const target = event.target as Element;
      const onCanvas = this.viewport.contains(target) && !target.closest('.toolbar, .zoom-control, .type-guide, .popup-root');
      if (event.button === 1) {
        this.middleMouseDown = true;
        if (onCanvas) {
          this.closePopup();
          this.mousePan = { start: this.local({ x: event.clientX, y: event.clientY }), view: { ...this.board.view } };
          event.preventDefault();
        }
        return;
      }
      if (event.button !== 0 || !this.middleMouseDown || !onCanvas || this.mousePan) return;
      this.closePopup();
      this.mousePan = { start: this.local({ x: event.clientX, y: event.clientY }), view: { ...this.board.view } };
      event.preventDefault();
    });
    document.addEventListener('mousemove', event => {
      if (!this.mousePan) return;
      if (!(event.buttons & 4)) { this.endMousePan(); return; }
      const local = this.local({ x: event.clientX, y: event.clientY });
      this.board.view.x = this.mousePan.view.x + local.x - this.mousePan.start.x;
      this.board.view.y = this.mousePan.view.y + local.y - this.mousePan.start.y;
      this.scheduleCameraRender();
    });
    document.addEventListener('mouseup', event => {
      if (event.button === 1) this.middleMouseDown = false;
      if (this.mousePan && event.button === 1) this.endMousePan();
    });
    document.addEventListener('pointerdown', event => {
      if (!this.popup.contains(event.target as Node)) {
        if (this.quickEditor) this.finishQuickEdit(true);
        else this.closePopup();
      }
    });
    this.popup.addEventListener('submit', event => event.preventDefault());
    this.popup.addEventListener('click', event => this.onPopupClick(event));
    document.querySelector<HTMLElement>('.toolbar')!.addEventListener('click', event => this.onToolbar(event));
    document.querySelector<HTMLElement>('#zoom')!.addEventListener('click', () => this.resetZoom());
    document.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change', event => void this.importFile(event));
    window.addEventListener('resize', () => this.renderCamera());
    window.addEventListener('blur', () => { this.middleMouseDown = false; if (this.mousePan) this.endMousePan(); });
    window.addEventListener('pagehide', () => this.persistNow());
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.gesture || this.popup.contains(event.target as Node)) return;
    if (event.buttons & 4) return;
    const target = event.target as Element;
    const nodeElement = target.closest<HTMLElement>('.node');
    const local = this.local({ x: event.clientX, y: event.clientY });
    if (nodeElement) {
      const nodeId = nodeElement.dataset.nodeId!;
      const node = this.node(nodeId);
      if (!node) return;
      if (!this.selectedNodeIds.has(nodeId)) this.selectNode(nodeId);
      const port = target.closest<HTMLElement>('[data-port]');
      if (port) nodeElement.removeAttribute('data-resize-edge');
      if (this.connectingFrom) {
        // The pending source is completed by the click handler on the target body or Input.
      } else if (port?.dataset.port === 'output') {
        const sourcePortId = port.dataset.portId;
        if (!sourcePortId) return;
        this.gesture = { kind: 'connect', pointerId: event.pointerId, start: local, sourceId: nodeId, sourcePortId };
        this.connectingFrom = nodeId;
        this.connectingFromPortId = sourcePortId;
        const targets = this.connectionTargets(nodeId, sourcePortId);
        this.view.setCompatibleTargets(targets);
        this.say(targets.size ? '绿色标记为可连接目标，拖到目标后松开。Escape 取消。' : '当前画布没有可连接目标；Escape 取消。');
      } else if (port) {
        // Input is a destination and must not start resize or move.
      } else if (this.resizeSideAt(nodeElement, event.clientX, event.clientY)) {
        const side = this.resizeSideAt(nodeElement, event.clientX, event.clientY)!;
        const world = screenToWorld(local, this.board.view);
        nodeElement.dataset.resizeEdge = side;
        this.gesture = { kind: 'resize', pointerId: event.pointerId, start: world, nodeId, side, origin: { x: node.x, y: node.y, w: node.w, h: node.h } };
        this.say('拖动非连接点边缘调整元素尺寸。Escape 取消。');
      } else {
        const origins = new Map<string, Point>();
        for (const id of this.selectedNodeIds) {
          const selected = this.node(id);
          if (selected) origins.set(id, { x: selected.x, y: selected.y });
        }
        this.gesture = { kind: 'move', pointerId: event.pointerId, start: local, origins, moved: false };
      }
    } else if (target.closest('.edge-hit') || target.closest('.edge-path')) {
      const group = target.closest<SVGGElement>('[data-edge-id]');
      if (group) {
        const edgeId = group.dataset.edgeId!;
        this.selectEdge(edgeId);
        const side = this.view.endpointSideAt(edgeId, local, this.board.view);
        this.gesture = { kind: 'edge-transfer', pointerId: event.pointerId, start: local, edgeId, side, moved: false };
        this.view.setCompatibleTargets(this.transferTargets(edgeId, side));
        this.say(side === 'source' ? '拖动 Edge 起始端以转移来源；松到空白处可请求删除。' : '拖动 Edge 末端以转移目标；松到空白处可请求删除。');
      }
    } else if (target === this.viewport) {
      const previousSelection = { nodeIds: [...this.selectedNodeIds], edgeId: this.selectedEdgeId };
      this.closePopup();
      this.selectNothing();
      this.connectingFrom = null;
      this.connectingFromPortId = null;
      this.view.setCompatibleTargets(new Map());
      this.view.hideTemporaryEdge();
      this.gesture = { kind: 'select', pointerId: event.pointerId, start: local, previousSelection, moved: false };
    }
    if (this.gesture?.pointerId === event.pointerId && ['resize', 'connect'].includes(this.gesture.kind)) this.capturePointer(event);
  }

  private onPointerMove(event: PointerEvent): void {
    if (this.mousePan) return;
    const gesture = this.gesture;
    const local = this.local({ x: event.clientX, y: event.clientY });
    if (!gesture) {
      this.updateResizeCursor(event);
      if (this.connectingFrom && this.connectingFromPortId) this.previewConnection(this.connectingFrom, this.connectingFromPortId, event.clientX, event.clientY);
      return;
    }
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.kind === 'select') {
      if (!gesture.moved) {
        if (Math.hypot(local.x - gesture.start.x, local.y - gesture.start.y) < 4) return;
        gesture.moved = true;
        this.capturePointer(event);
      }
      this.updateSelectionBox(gesture.start, local);
    } else if (gesture.kind === 'move') {
      if (!gesture.moved) {
        if (Math.hypot(local.x - gesture.start.x, local.y - gesture.start.y) < 4) return;
        gesture.moved = true;
        this.capturePointer(event);
      }
      const dx = (local.x - gesture.start.x) / this.board.view.zoom / GRID_SIZE;
      const dy = (local.y - gesture.start.y) / this.board.view.zoom / GRID_SIZE;
      for (const [id, origin] of gesture.origins) {
        const node = this.node(id);
        if (!node) continue;
        node.x = snap((origin.x + dx) * GRID_SIZE);
        node.y = snap((origin.y + dy) * GRID_SIZE);
        this.scheduleNodeRender(node.id);
      }
    } else if (gesture.kind === 'resize') {
      const node = this.node(gesture.nodeId);
      if (!node) return;
      const world = screenToWorld(local, this.board.view);
      const dx = Math.round((world.x - gesture.start.x) / GRID_SIZE);
      const dy = Math.round((world.y - gesture.start.y) / GRID_SIZE);
      if (gesture.side.includes('w')) {
        node.w = Math.max(MIN_NODE_WIDTH, gesture.origin.w - dx);
        node.x = gesture.origin.x + gesture.origin.w - node.w;
      } else if (gesture.side.includes('e')) node.w = Math.max(MIN_NODE_WIDTH, gesture.origin.w + dx);
      if (gesture.side.includes('n')) {
        node.h = Math.max(MIN_NODE_HEIGHT, gesture.origin.h - dy);
        node.y = gesture.origin.y + gesture.origin.h - node.h;
      } else if (gesture.side.includes('s')) node.h = Math.max(MIN_NODE_HEIGHT, gesture.origin.h + dy);
      this.scheduleNodeRender(node.id);
    } else if (gesture.kind === 'connect') {
      this.previewConnection(gesture.sourceId, gesture.sourcePortId, event.clientX, event.clientY);
    } else if (gesture.kind === 'edge-transfer') {
      if (!gesture.moved && Math.hypot(local.x - gesture.start.x, local.y - gesture.start.y) >= 4) {
        gesture.moved = true;
        this.capturePointer(event);
      }
      if (!gesture.moved) return;
        const target = this.connectionTargetAt(event.clientX, event.clientY, gesture.side);
      if (!target) {
        this.view.updateTemporaryFreeTransfer(gesture.edgeId, gesture.side, local, this.board.view);
        this.say('松到空白处将询问是否删除这条 Edge。');
        return;
      }
        const targetNode = this.node(target.nodeId);
        const direction = gesture.side === 'source' ? 'output' : 'input';
        const portId = target.portId || (targetNode && defaultPort(targetNode.elementTypeId, direction)?.id);
        const valid = !!portId && this.canTransferEdge(gesture.edgeId, gesture.side, target.nodeId, portId);
        this.view.updateTemporaryTransfer(gesture.edgeId, gesture.side, target.nodeId, portId, valid);
      this.say(valid
        ? `松开以转移${gesture.side === 'source' ? '来源端' : '目标端'}到：${this.node(target.nodeId)?.title || '未命名'}`
        : target.nodeId === this.edge(gesture.edgeId)?.[gesture.side === 'source' ? 'targetNodeId' : 'sourceNodeId']
          ? '不能让 Edge 的两端指向同一元素。'
          : this.view.hasDirectedEdge(
            gesture.side === 'source' ? target.nodeId : this.edge(gesture.edgeId)?.sourceNodeId || '',
            gesture.side === 'target' ? target.nodeId : this.edge(gesture.edgeId)?.targetNodeId || '',
            gesture.edgeId,
          ) ? '转移后会与已有有向关系重复。' : '该元素类型或交互点不兼容。');
    }
  }

  private onPointerUp(event: PointerEvent): void {
    const gesture = this.gesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.kind === 'connect') {
      const target = this.connectionTargetAt(event.clientX, event.clientY);
      if (target) {
        this.finishConnection(gesture.sourceId, gesture.sourcePortId, target.nodeId, target.portId);
      }
      else this.cancelConnection();
    } else if (gesture.kind === 'edge-transfer') {
      if (gesture.moved) {
        const target = this.connectionTargetAt(event.clientX, event.clientY, gesture.side);
        this.view.hideTemporaryEdge();
        if (target) {
          const targetNode = this.node(target.nodeId);
          const direction = gesture.side === 'source' ? 'output' : 'input';
          const portId = target.portId || (targetNode && defaultPort(targetNode.elementTypeId, direction)?.id);
          if (portId && transferEdgeEndpoint(this.board, gesture.edgeId, gesture.side, target.nodeId, portId)) {
            this.render(); this.persist(); this.say(`已转移 Edge 的${gesture.side === 'source' ? '来源端' : '目标端'}。`);
          } else this.say('不能转移：会形成自连接或重复的有向关系。');
        } else if (confirm('没有放到任何元素上。要删除这条 Edge 吗？')) {
          deleteEdge(this.board, gesture.edgeId); this.selectedEdgeId = null; this.render(); this.persist(); this.say('Edge 已删除。');
        } else this.say('已取消删除，Edge 保留原位。');
      }
    } else if (gesture.kind === 'move' && gesture.moved || gesture.kind === 'resize') {
      this.flushScheduledRender();
      this.persist();
    }
    if (gesture.kind === 'select') this.selectionBox.hidden = true;
    if (gesture.kind === 'edge-transfer') { this.view.setCompatibleTargets(new Map()); this.view.hideTemporaryEdge(); }
    const moved = gesture.kind === 'select' || gesture.kind === 'move' || gesture.kind === 'edge-transfer'
      ? gesture.moved : true;
    if (moved) {
      this.suppressClick = true;
      setTimeout(() => { this.suppressClick = false; }, 0);
    }
    this.gesture = null;
  }

  private onClick(event: MouseEvent): void {
    if (this.suppressClick) { this.suppressClick = false; return; }
    const target = event.target as Element;
    const node = target.closest<HTMLElement>('.node');
    if (node && this.connectingFrom) {
      const port = target.closest<HTMLElement>('.node__port[data-port="input"]');
      this.finishConnection(this.connectingFrom, this.connectingFromPortId || '', node.dataset.nodeId!, port?.dataset.portId);
      return;
    }
    if (node && !this.selectedNodeIds.has(node.dataset.nodeId!)) this.selectNode(node.dataset.nodeId!);
    const edge = target.closest<SVGGElement>('[data-edge-id]');
    if (edge) this.selectEdge(edge.dataset.edgeId!);
    if (target === this.viewport) {
      this.selectNothing();
      this.connectingFrom = null;
      this.connectingFromPortId = null;
      this.view.hideTemporaryEdge();
    }
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const target = event.target as Element;
    const local = this.local({ x: event.clientX, y: event.clientY });
    this.contextPoint = screenToWorld(local, this.board.view);
    const node = target.closest<HTMLElement>('.node');
    const edge = target.closest<SVGGElement>('[data-edge-id]');
    if (node) this.openNodeMenu(node.dataset.nodeId!, { x: event.clientX, y: event.clientY });
    else if (edge) this.openEdgeMenu(edge.dataset.edgeId!, { x: event.clientX, y: event.clientY });
    else this.openBoardMenu({ x: event.clientX, y: event.clientY });
  }

  private onPopupClick(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === 'add-source') this.addAt(this.contextPoint, 'source');
    else if (action === 'add-transform') this.addAt(this.contextPoint, 'transform');
    else if (action === 'add-result') this.addAt(this.contextPoint, 'result');
    else if (action === 'paste') this.pasteAt(this.contextPoint);
    else if (action === 'edit-node' && id) this.openNodeForm(id, this.popupPosition());
    else if (action === 'duplicate-node' && id) this.duplicate(id);
    else if (action === 'copy-node' && id) { const node = this.node(id); if (node) { this.clipboard = structuredClone(node); this.say('元素已复制。'); } this.closePopup(); }
    else if (action === 'connect-node' && id) {
      const node = this.node(id);
      const output = node && defaultPort(node.elementTypeId, 'output');
      if (output) {
        this.connectingFrom = id; this.connectingFromPortId = output.id;
        const targets = this.connectionTargets(id, output.id);
        this.view.setCompatibleTargets(targets);
        this.say(targets.size ? '绿色标记为可连接目标，移动到目标并点击。' : '当前画布没有可连接目标；仍可 Escape 取消。');
      } else this.say('这个元素没有可发起连接的 Output。');
      this.closePopup();
    }
    else if (action === 'delete-node' && id) { deleteNode(this.board, id); this.selectNothing(); this.render(); this.persist(); this.closePopup(); }
    else if (action === 'edit-edge' && id) this.openEdgeForm(id, this.popupPosition());
    else if (action === 'delete-edge' && id) { deleteEdge(this.board, id); this.selectNothing(); this.render(); this.persist(); this.closePopup(); }
    else if (action === 'save-node' && id) this.saveNodeForm(id);
    else if (action === 'save-edge' && id) this.saveEdgeForm(id);
    else if (action === 'cancel') this.closePopup();
  }

  private onToolbar(event: MouseEvent): void {
    const action = (event.target as Element).closest<HTMLButtonElement>('button[data-action]')?.dataset.action;
    if (action === 'export') this.exportBoard();
    if (action === 'import') document.querySelector<HTMLInputElement>('#import-file')!.click();
    if (action === 'clear' && confirm('清空当前图板？此操作会清除已保存的节点和连线。')) {
      this.board.nodes = []; this.board.edges = []; this.board.view = { x: 0, y: 0, zoom: 1 };
      this.selectNothing(); this.connectingFrom = null; this.connectingFromPortId = null; this.render(); this.persist(); this.say('图板已清空。');
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      const node = (event.target as Element).closest<HTMLElement>('.node');
      if (node && event.target === node) { event.preventDefault(); this.selectNode(node.dataset.nodeId!); }
      const edge = (event.target as Element).closest<SVGGElement>('[data-edge-id]');
      if (edge) this.selectEdge(edge.dataset.edgeId!);
    }
  }

  private onDocumentKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const typing = target.matches('input, textarea, select, [contenteditable="true"]');
    if (event.key === 'Escape') {
      if (this.mousePan) this.endMousePan();
      else if (this.gesture) this.cancelGesture();
      else if (this.connectingFrom) this.cancelConnection();
      else this.closePopup();
      return;
    }
    if (typing || event.altKey || event.metaKey || event.ctrlKey) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && (this.selectedNodeIds.size || this.selectedEdgeId)) {
      event.preventDefault();
      if (this.selectedNodeIds.size) for (const id of this.selectedNodeIds) deleteNode(this.board, id);
      else if (this.selectedEdgeId) deleteEdge(this.board, this.selectedEdgeId);
      this.selectNothing(); this.render(); this.persist();
    }
  }

  private openBoardMenu(point: Point): void {
    this.openMenu(point, [
      ['添加数据源', 'add-source'], ['添加处理节点', 'add-transform'], ['添加结果节点', 'add-result'], ['粘贴元素', 'paste', !!this.clipboard],
    ]);
  }

  private openNodeMenu(id: string, point: Point): void {
    this.selectNode(id);
    const node = this.node(id);
    const canConnect = !!node && !!defaultPort(node.elementTypeId, 'output');
    this.openMenu(point, [['编辑', 'edit-node'], ['复制', 'copy-node'], [canConnect ? '开始连接' : '没有可用 Output', 'connect-node', canConnect], ['删除', 'delete-node']], id);
  }

  private openEdgeMenu(id: string, point: Point): void {
    this.selectEdge(id);
    this.openMenu(point, [['编辑', 'edit-edge'], ['删除', 'delete-edge']], id);
  }

  private openMenu(point: Point, entries: [string, string, boolean?][], id?: string): void {
    this.popup.replaceChildren();
    const menu = document.createElement('div');
    menu.className = 'floating context-menu';
    menu.setAttribute('role', 'menu');
    for (const [label, action, enabled = true] of entries) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.action = action; button.dataset.id = id || '';
      button.textContent = label; button.disabled = !enabled; button.setAttribute('role', 'menuitem');
      menu.append(button);
    }
    this.placePopup(menu, point);
    this.popup.append(menu);
  }

  private openNodeForm(id: string, point: Point): void {
    const node = this.node(id); if (!node) return;
    const form = this.makeForm('编辑元素', id);
    const title = this.field('标题', 'input', 'title');
    (title.control as HTMLInputElement).value = node.title;
    const description = this.field('描述', 'textarea', 'description');
    (description.control as HTMLTextAreaElement).value = node.description || '';
    const kind = this.field('视觉类型', 'select', 'kind');
    this.addOptions(kind.control as HTMLSelectElement, [['plain','普通'],['event','事件'],['condition','条件'],['reference','引用']], node.kind);
    const elementType = this.field('元素类型', 'select', 'elementTypeId');
    this.addOptions(elementType.control as HTMLSelectElement, Object.values(ELEMENT_TYPES).map(definition => [definition.id, definition.label]), node.elementTypeId);
    form.querySelector('.form-fields')!.append(title.wrapper, description.wrapper, kind.wrapper, elementType.wrapper);
    this.placePopup(form, point);
    this.popup.replaceChildren(form);
    (title.control as HTMLInputElement).focus();
  }

  private editNodeText(id: string, field: 'title' | 'description', anchor: HTMLElement): void {
    const node = this.node(id);
    if (!node) return;
    this.openQuickEditor(field, field === 'title' ? node.title : node.description || '', anchor, value => {
      const current = this.node(id);
      if (!current) return;
      if (field === 'title') current.title = value.trim() || ELEMENT_TYPES[current.elementTypeId].label;
      else current.description = value;
      this.render();
      this.persist();
    });
  }

  private editEdgeLabel(id: string): void {
    const edge = this.edge(id);
    const label = this.view.edgeElements.get(id)?.label;
    if (!edge || !label) return;
    this.openQuickEditor('label', edge.label || '', label, value => {
      const current = this.edge(id);
      if (!current) return;
      current.label = value.trim();
      this.render();
      this.persist();
    });
  }

  private openQuickEditor(field: 'title' | 'description' | 'label', value: string, anchor: HTMLElement | SVGTextElement, commit: (value: string) => void): void {
    if (this.quickEditor) this.finishQuickEdit(true);
    this.closePopup();
    const multiline = field === 'description';
    const editor = document.createElement(multiline ? 'textarea' : 'input');
    if (editor instanceof HTMLInputElement) editor.type = 'text';
    editor.className = `quick-edit quick-edit--${field}${multiline ? ' quick-edit--multiline' : ''}`;
    editor.setAttribute('aria-label', field === 'title' ? '快速编辑标题' : field === 'description' ? '快速编辑描述' : '快速编辑连线名称');
    editor.value = value;

    const rect = anchor.getBoundingClientRect();
    const viewportRect = this.viewport.getBoundingClientRect();
    const width = Math.min(multiline ? Math.max(140, rect.width + 8) : Math.max(120, rect.width + 12), Math.max(80, this.viewport.clientWidth - 16));
    const height = multiline ? Math.min(Math.max(58, rect.height + 10), Math.max(48, this.viewport.clientHeight - 16)) : Math.max(26, rect.height + 6);
    const centered = field === 'label';
    const desiredLeft = centered ? rect.left + rect.width / 2 - width / 2 : rect.left - 4;
    const desiredTop = centered ? rect.top + rect.height / 2 - height / 2 : rect.top - 4;
    editor.style.left = `${Math.max(8, Math.min(this.viewport.clientWidth - width - 8, desiredLeft - viewportRect.left))}px`;
    editor.style.top = `${Math.max(8, Math.min(this.viewport.clientHeight - height - 8, desiredTop - viewportRect.top))}px`;
    editor.style.width = `${width}px`;
    editor.style.height = `${height}px`;
    editor.style.fontSize = `${field === 'title' ? Math.max(14 * this.board.view.zoom, 11) : field === 'description' ? Math.max(11 * this.board.view.zoom, 9) : 11 * this.board.view.zoom}px`;
    this.quickEditor = editor;
    this.quickEditCommit = commit;
    editor.addEventListener('keydown', event => {
      const keyboardEvent = event as KeyboardEvent;
      keyboardEvent.stopPropagation();
      if (keyboardEvent.key === 'Escape') { keyboardEvent.preventDefault(); this.finishQuickEdit(false); }
      else if (keyboardEvent.key === 'Enter' && (editor instanceof HTMLInputElement || keyboardEvent.ctrlKey || keyboardEvent.metaKey)) {
        keyboardEvent.preventDefault(); this.finishQuickEdit(true);
      }
    });
    editor.addEventListener('blur', () => { if (this.quickEditor === editor) this.finishQuickEdit(true); });
    this.popup.append(editor);
    editor.focus();
    if (editor instanceof HTMLInputElement) editor.select();
    else editor.setSelectionRange(editor.value.length, editor.value.length);
  }

  private finishQuickEdit(save: boolean): void {
    const editor = this.quickEditor;
    if (!editor) return;
    const value = editor.value;
    const commit = this.quickEditCommit;
    this.quickEditor = null;
    this.quickEditCommit = null;
    editor.remove();
    if (save) commit?.(value);
  }

  private openEdgeForm(id: string, point: Point): void {
    const edge = this.edge(id); if (!edge) return;
    const form = this.makeForm('编辑连线', id);
    const label = this.field('名称', 'input', 'label');
    (label.control as HTMLInputElement).value = edge.label || '';
    const kind = this.field('视觉类型', 'select', 'kind');
    this.addOptions(kind.control as HTMLSelectElement, [['plain','普通'],['sequence','顺序'],['relation','关系']], edge.kind);
    form.querySelector('.form-fields')!.append(label.wrapper, kind.wrapper);
    this.placePopup(form, point);
    this.popup.replaceChildren(form);
    (label.control as HTMLInputElement).focus();
  }

  private makeForm(title: string, id: string): HTMLFormElement {
    const form = document.createElement('form');
    form.className = 'floating editor-form'; form.dataset.id = id;
    const heading = document.createElement('h2'); heading.textContent = title;
    const fields = document.createElement('div'); fields.className = 'form-fields';
    const actions = document.createElement('div'); actions.className = 'form-actions';
    const save = document.createElement('button'); save.type = 'button'; save.dataset.action = title === '编辑元素' ? 'save-node' : 'save-edge'; save.dataset.id = id; save.textContent = '保存'; save.className = 'primary';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.dataset.action = 'cancel'; cancel.textContent = '取消';
    actions.append(save, cancel); form.append(heading, fields, actions);
    return form;
  }

  private field(labelText: string, tag: 'input' | 'textarea' | 'select', name: string): { wrapper: HTMLLabelElement; control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement } {
    const wrapper = document.createElement('label'); wrapper.className = 'field'; wrapper.append(document.createTextNode(labelText));
    const control = document.createElement(tag); control.name = name;
    if (tag === 'input') (control as HTMLInputElement).type = 'text';
    wrapper.append(control);
    return { wrapper, control };
  }

  private addOptions(select: HTMLSelectElement, options: [string, string][], selected: string): void {
    for (const [value, label] of options) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = value === selected; select.append(option);
    }
  }

  private saveNodeForm(id: string): void {
    const node = this.node(id); if (!node) return;
    const form = this.popup.querySelector('form')!;
    const elementTypeId = (form.elements.namedItem('elementTypeId') as HTMLSelectElement).value as ElementTypeId;
    const invalidEdges = this.board.edges.filter(edge => {
      if (edge.sourceNodeId !== id && edge.targetNodeId !== id) return false;
      const source = this.node(edge.sourceNodeId), target = this.node(edge.targetNodeId);
      if (!source || !target) return true;
      return !isConnectionAllowed(
        edge.sourceNodeId === id ? elementTypeId : source.elementTypeId, edge.sourcePortId,
        edge.targetNodeId === id ? elementTypeId : target.elementTypeId, edge.targetPortId,
      );
    });
    if (invalidEdges.length) {
      this.say(`该类型会使 ${invalidEdges.length} 条现有连接不兼容，请先删除或转移这些连接。`);
      return;
    }
    node.elementTypeId = elementTypeId;
    node.title = (form.elements.namedItem('title') as HTMLInputElement).value.trim() || ELEMENT_TYPES[elementTypeId].label;
    node.description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
    node.kind = (form.elements.namedItem('kind') as HTMLSelectElement).value as NodeKind;
    this.render(); this.persist(); this.closePopup();
  }

  private saveEdgeForm(id: string): void {
    const edge = this.edge(id); if (!edge) return;
    const form = this.popup.querySelector('form')!;
    edge.label = (form.elements.namedItem('label') as HTMLInputElement).value.trim();
    edge.kind = (form.elements.namedItem('kind') as HTMLSelectElement).value as EdgeKind;
    this.render(); this.persist(); this.closePopup();
  }

  private addAt(point: Point, elementTypeId: ElementTypeId): void {
    const node = createNode(point, elementTypeId); this.board.nodes.push(node); this.selectNode(node.id); this.render(); this.persist(); this.closePopup();
    this.openNodeForm(node.id, this.localToClient(worldToScreen({ x: node.x * GRID_SIZE, y: node.y * GRID_SIZE }, this.board.view)));
  }

  private pasteAt(point: Point): void {
    if (!this.clipboard) return;
    const node = copyNode(this.clipboard, { x: point.x, y: point.y });
    this.board.nodes.push(node); this.selectNode(node.id); this.render(); this.persist(); this.closePopup();
  }

  private duplicate(id: string): void {
    const source = this.node(id); if (!source) return;
    const node = copyNode(source, { x: (source.x + 2) * GRID_SIZE, y: (source.y + 2) * GRID_SIZE });
    this.board.nodes.push(node); this.selectNode(node.id); this.render(); this.persist(); this.closePopup();
  }

  private finishConnection(sourceId: string, sourcePortId: string, targetId: string, targetPortId?: string): void {
    const target = this.node(targetId);
    const portId = targetPortId || (target && defaultPort(target.elementTypeId, 'input')?.id);
    this.connectingFrom = null;
    this.connectingFromPortId = null;
    this.view.setCompatibleTargets(new Map());
    this.view.hideTemporaryEdge();
    if (!portId) { this.say('目标元素没有唯一 Input；请拖到具体交互点。'); return; }
    const edge = addEdge(this.board, sourceId, sourcePortId, targetId, portId);
    if (edge) { this.selectEdge(edge.id); this.render(); this.persist(); this.say('已创建兼容连接。'); }
    else if (sourceId === targetId) this.say('不能连接元素自身。');
    else if (this.view.hasDirectedEdge(sourceId, targetId)) this.say('这两个元素之间已有相同方向的连接。');
    else this.say('这两个交互点不兼容，连接已拒绝。');
  }

  private connectionTargetAt(clientX: number, clientY: number, side: 'source' | 'target' = 'target'): { nodeId: string; portId?: string } | undefined {
    const element = document.elementFromPoint(clientX, clientY);
    const node = element?.closest<HTMLElement>('.node');
    if (!node) return;
    const direction = side === 'source' ? 'output' : 'input';
    const port = element?.closest<HTMLElement>(`.node__port[data-port="${direction}"]`);
    return { nodeId: node.dataset.nodeId!, portId: port?.dataset.portId };
  }

  private canTransferEdge(edgeId: string, side: 'source' | 'target', nodeId: string, portId: string): boolean {
    const edge = this.edge(edgeId);
    const candidate = this.node(nodeId);
    const oldSource = this.node(edge?.sourceNodeId || '');
    const oldTarget = this.node(edge?.targetNodeId || '');
    if (!edge || !candidate || !oldSource || !oldTarget) return false;
    const sourceNodeId = side === 'source' ? nodeId : edge.sourceNodeId;
    const targetNodeId = side === 'target' ? nodeId : edge.targetNodeId;
    const sourceType = side === 'source' ? candidate.elementTypeId : oldSource.elementTypeId;
    const targetType = side === 'target' ? candidate.elementTypeId : oldTarget.elementTypeId;
    const sourcePortId = side === 'source' ? portId : edge.sourcePortId;
    const targetPortId = side === 'target' ? portId : edge.targetPortId;
    return sourceNodeId !== targetNodeId && isConnectionAllowed(sourceType, sourcePortId, targetType, targetPortId) &&
      !this.view.hasDirectedEdge(sourceNodeId, targetNodeId, edgeId);
  }

  private connectionTargets(sourceId: string, sourcePortId: string): Map<string, string[]> {
    const source = this.node(sourceId);
    const targets = new Map<string, string[]>();
    if (!source) return targets;
    for (const node of this.board.nodes) {
      if (node.id === sourceId || this.view.hasDirectedEdge(sourceId, node.id)) continue;
      const inputs = ELEMENT_TYPES[node.elementTypeId].ports.filter(port => port.direction === 'input' &&
        isConnectionAllowed(source.elementTypeId, sourcePortId, node.elementTypeId, port.id));
      if (inputs.length) targets.set(node.id, inputs.map(port => port.id));
    }
    return targets;
  }

  private transferTargets(edgeId: string, side: 'source' | 'target'): Map<string, string[]> {
    const edge = this.edge(edgeId);
    const targets = new Map<string, string[]>();
    if (!edge) return targets;
    for (const node of this.board.nodes) {
      const ports = ELEMENT_TYPES[node.elementTypeId].ports.filter(port => port.direction === (side === 'source' ? 'output' : 'input') &&
        this.canTransferEdge(edgeId, side, node.id, port.id));
      if (ports.length) targets.set(node.id, ports.map(port => port.id));
    }
    return targets;
  }

  private updateSelectionBox(start: Point, current: Point): void {
    const left = Math.min(start.x, current.x), top = Math.min(start.y, current.y);
    const right = Math.max(start.x, current.x), bottom = Math.max(start.y, current.y);
    this.selectionBox.hidden = false;
    this.selectionBox.style.left = `${left}px`;
    this.selectionBox.style.top = `${top}px`;
    this.selectionBox.style.width = `${right - left}px`;
    this.selectionBox.style.height = `${bottom - top}px`;
    const bounds = this.viewport.getBoundingClientRect();
    const selected = this.board.nodes.filter(node => {
      const rect = this.view.nodeElements.get(node.id)?.getBoundingClientRect();
      if (!rect) return false;
      const x = rect.left - bounds.left, y = rect.top - bounds.top;
      return rect.right - bounds.left >= left && x <= right && rect.bottom - bounds.top >= top && y <= bottom;
    }).map(node => node.id);
    this.selectNodes(selected);
  }

  private endMousePan(): void {
    this.mousePan = null;
    this.flushScheduledRender();
    this.persist();
    this.suppressClick = true;
    setTimeout(() => { this.suppressClick = false; }, 0);
  }

  private resizeSideAt(nodeElement: HTMLElement, clientX: number, clientY: number): ResizeSide | undefined {
    const rect = nodeElement.getBoundingClientRect();
    const border = Math.min(8, rect.width / 4, rect.height / 4);
    const x = clientX - rect.left, y = clientY - rect.top;
    const west = x <= border, east = x >= rect.width - border;
    const north = y <= border, south = y >= rect.height - border;
    if (north) return west ? 'nw' : east ? 'ne' : 'n';
    if (south) return west ? 'sw' : east ? 'se' : 's';
    if (west) return 'w';
    if (east) return 'e';
    return;
  }

  private updateResizeCursor(event: PointerEvent): void {
    const target = event.target as Element;
    const node = target.closest<HTMLElement>('.node');
    if (this.hoveredResizeNode && this.hoveredResizeNode !== node) this.hoveredResizeNode.removeAttribute('data-resize-edge');
    this.hoveredResizeNode = node;
    if (!node || target.closest('[data-port]') || this.connectingFrom) {
      node?.removeAttribute('data-resize-edge');
      return;
    }
    const side = this.resizeSideAt(node, event.clientX, event.clientY);
    if (side) node.dataset.resizeEdge = side;
    else node.removeAttribute('data-resize-edge');
  }

  private previewConnection(sourceId: string, sourcePortId: string, clientX: number, clientY: number): void {
    const target = this.connectionTargetAt(clientX, clientY);
    if (!target) {
      this.view.updateTemporaryFreeEdge(sourceId, sourcePortId, this.local({ x: clientX, y: clientY }), this.board.view);
      this.say('拖到高亮的兼容目标或其 Input。Escape 取消。');
      return;
    }
    const source = this.node(sourceId), targetNode = this.node(target.nodeId);
    const targetPortId = target.portId || (targetNode && defaultPort(targetNode.elementTypeId, 'input')?.id);
    const valid = !!source && !!targetNode && !!targetPortId && sourceId !== target.nodeId &&
      isConnectionAllowed(source.elementTypeId, sourcePortId, targetNode.elementTypeId, targetPortId) &&
      !this.view.hasDirectedEdge(sourceId, target.nodeId);
    this.view.updateTemporaryEdge(sourceId, sourcePortId, target.nodeId, targetPortId, valid);
    if (sourceId === target.nodeId) this.say('不能连接元素自身。');
    else if (!targetPortId) this.say('该元素没有唯一 Input，请拖到具体交互点。');
    else if (this.view.hasDirectedEdge(sourceId, target.nodeId)) this.say('这两个元素之间已有相同方向的连接。');
    else if (!valid) this.say('该元素类型与交互点不兼容，目标不会高亮。');
    else this.say(`松开以连接：${this.node(sourceId)?.title || '未命名'} → ${this.node(target.nodeId)?.title || '未命名'}`);
  }

  private cancelConnection(): void { this.connectingFrom = null; this.connectingFromPortId = null; this.view.setCompatibleTargets(new Map()); this.view.hideTemporaryEdge(); this.say('已取消连接。'); }

  private cancelGesture(): void {
    const gesture = this.gesture;
    if (!gesture) return;
    if (gesture.kind === 'move') {
      for (const [id, origin] of gesture.origins) {
        const node = this.node(id);
        if (node) { node.x = origin.x; node.y = origin.y; }
      }
    }
    if (gesture.kind === 'resize') {
      const node = this.node(gesture.nodeId);
      if (node) {
        node.x = gesture.origin.x; node.y = gesture.origin.y;
        node.w = gesture.origin.w; node.h = gesture.origin.h;
      }
    }
    if (gesture.kind === 'select') {
      this.selectionBox.hidden = true;
      if (gesture.previousSelection.edgeId) this.selectEdge(gesture.previousSelection.edgeId);
      else this.selectNodes(gesture.previousSelection.nodeIds);
    }
    if (gesture.kind === 'connect') this.cancelConnection();
    if (gesture.kind === 'edge-transfer') { this.view.setCompatibleTargets(new Map()); this.view.hideTemporaryEdge(); }
    const pointerId = gesture.pointerId;
    this.gesture = null;
    try { if (this.viewport.hasPointerCapture(pointerId)) this.viewport.releasePointerCapture(pointerId); } catch { /* Capture may already be released. */ }
    this.render();
  }

  private capturePointer(event: PointerEvent): void {
    event.preventDefault();
    try { this.viewport.setPointerCapture(event.pointerId); } catch { /* Browser may cancel capture during teardown. */ }
  }

  private selectNode(id: string): void { this.selectedNodeIds.clear(); this.selectedNodeIds.add(id); this.selectedNodeId = id; this.selectedEdgeId = null; this.view.setSelection(this.selectedNodeIds, null); }
  private selectNodes(ids: string[]): void {
    this.selectedNodeIds.clear();
    for (const id of ids) this.selectedNodeIds.add(id);
    this.selectedNodeId = ids.length ? ids[ids.length - 1] : null;
    this.selectedEdgeId = null;
    this.view.setSelection(this.selectedNodeIds, null);
  }
  private selectEdge(id: string): void { this.selectedNodeIds.clear(); this.selectedNodeId = null; this.selectedEdgeId = id; this.view.setSelection(this.selectedNodeIds, id); }
  private selectNothing(): void { this.selectedNodeIds.clear(); this.selectedNodeId = null; this.selectedEdgeId = null; this.view.setSelection(this.selectedNodeIds, null); }

  private render(): void {
    this.cancelScheduledRender();
    this.view.sync(this.board, this.selectedNodeIds, this.selectedEdgeId);
    this.updateZoomLabel();
  }
  private renderCamera(): void {
    this.flushScheduledRender();
    this.view.updateCamera(this.board.view);
    this.view.updateViewportSize();
  }
  private scheduleCameraRender(): void {
    this.cameraRenderPending = true;
    this.scheduleRenderFrame();
  }
  private scheduleNodeRender(nodeId: string): void {
    this.dirtyNodeIds.add(nodeId);
    this.scheduleRenderFrame();
  }
  private scheduleRenderFrame(): void {
    if (this.pendingRenderFrame !== null) return;
    this.pendingRenderFrame = requestAnimationFrame(() => {
      this.pendingRenderFrame = null;
      if (this.cameraRenderPending) {
        this.cameraRenderPending = false;
        this.view.updateCamera(this.board.view);
        for (const nodeId of this.dirtyNodeIds) this.view.updateNodeAndIncidentEdges(nodeId);
        this.dirtyNodeIds.clear();
      } else {
        for (const nodeId of this.dirtyNodeIds) this.view.updateNodeAndIncidentEdges(nodeId);
        this.dirtyNodeIds.clear();
      }
    });
  }
  private flushScheduledRender(): void {
    if (this.pendingRenderFrame === null) return;
    cancelAnimationFrame(this.pendingRenderFrame);
    this.pendingRenderFrame = null;
    if (this.cameraRenderPending) {
      this.cameraRenderPending = false;
      this.view.updateCamera(this.board.view);
      for (const nodeId of this.dirtyNodeIds) this.view.updateNodeAndIncidentEdges(nodeId);
      this.dirtyNodeIds.clear();
    } else {
      for (const nodeId of this.dirtyNodeIds) this.view.updateNodeAndIncidentEdges(nodeId);
      this.dirtyNodeIds.clear();
    }
  }
  private cancelScheduledRender(): void {
    if (this.pendingRenderFrame !== null) cancelAnimationFrame(this.pendingRenderFrame);
    this.pendingRenderFrame = null;
    this.cameraRenderPending = false;
    this.dirtyNodeIds.clear();
  }
  private updateZoomLabel(): void { this.zoomButton.textContent = `${Math.round(this.board.view.zoom * 100)}%`; }
  private persist(): void {
    this.schedulePersist();
  }
  private persistNow(): void {
    if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
    this.persistTimer = null;
    if (!saveBoard(this.board)) this.say('浏览器无法保存图板；可导出 JSON 备份。');
  }
  private schedulePersist(): void {
    if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => this.persistNow(), 250);
  }
  private say(message: string): void { if (this.status.textContent !== message) this.status.textContent = message; }
  private node(id: string): BoardNode | undefined { return this.view.getNode(id); }
  private edge(id: string): Edge | undefined { return this.view.getEdge(id); }
  private local(point: Point): Point { const rect = this.viewport.getBoundingClientRect(); return { x: point.x - rect.left, y: point.y - rect.top }; }
  private localToClient(point: Point): Point { const rect = this.viewport.getBoundingClientRect(); return { x: point.x + rect.left, y: point.y + rect.top }; }
  private closePopup(): void { this.popup.replaceChildren(); }
  private popupPosition(): Point { const rect = this.popup.firstElementChild?.getBoundingClientRect(); return rect ? { x: rect.left, y: rect.top } : { x: 20, y: 20 }; }

  private placePopup(element: HTMLElement, point: Point): void {
    const rect = this.viewport.getBoundingClientRect();
    const width = element.classList.contains('editor-form') ? 284 : 204;
    element.style.left = `${Math.max(8, Math.min(point.x - rect.left, rect.width - width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(point.y - rect.top, rect.height - (element.classList.contains('editor-form') ? 310 : 190) - 8))}px`;
  }

  private resetZoom(): void {
    const center = { x: this.viewport.clientWidth / 2, y: this.viewport.clientHeight / 2 };
    const world = screenToWorld(center, this.board.view);
    this.board.view.zoom = 1; this.board.view.x = center.x - world.x; this.board.view.y = center.y - world.y;
    this.renderCamera(); this.updateZoomLabel(); this.persist();
  }

  private exportBoard(): void {
    const blob = new Blob([JSON.stringify(this.board, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'infinite-board.json'; link.click();
    URL.revokeObjectURL(url); this.say('图板已导出为 JSON。');
  }

  private async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    try {
      const imported = parseBoard(await file.text());
      this.board.schemaVersion = imported.schemaVersion; this.board.nodes = imported.nodes; this.board.edges = imported.edges; this.board.view = imported.view;
      this.selectNothing(); this.connectingFrom = null; this.render(); this.persist(); this.say(`已导入 ${this.board.nodes.length} 个元素和 ${this.board.edges.length} 条连线。`);
    } catch (error) {
      this.say(error instanceof Error ? `导入失败：${error.message}` : '导入失败：JSON 无效。');
    }
  }
}
