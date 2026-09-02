// ============================================================
// arona-clicker/services/story-flow.ts — 剧情启动 / 推进 / 发送主流程
// 从 story-service.ts 拆出：start / advance / clickSend / getSendState /
// triggerPassive / getView / beginStory / trackFlagsAndApply / applyStoryTravel
// ============================================================

import type { StoryEntryDef, PassiveStoryEntry } from '../../data-services/contracts/story-entry';
import type { StoryChoice, StoryDef, Talklet } from '../../data-services/contracts/story';
import type { Effect } from '../../engine/types/expression';
import type { SendResult, SendState, StoryAdvanceResult, StoryStartResult, StoryView } from '../contracts/results';
import type { StoryCursorState } from './story-cursor-state';
import { performJump, resolveStoryEnd } from './story-jump';
import type { StoryRuntime } from './story-context';

/** 由 Talklet.clickWork 滚随机点击总次数：base + 随机偏移（0..rand-1），rand 缺省/<=0 则恒 base。 */
function rollClickWorkTotal(base: number, rand?: number): number {
  if (!rand || rand <= 0) return base;
  return base + Math.floor(Math.random() * rand);
}

/** 页/选项是否为回显页面（把 sentText 以「老师」气泡回显到聊天流）。 */
function shouldEchoReply(page: Talklet): boolean {
  return page.kind !== 'click' && !page.muteReply && !!page.sendText;
}

/** 初始化剧情游标（startStory / replayStory 共用）。 */
export function beginStory(rt: StoryRuntime, cur: StoryCursorState, entry: StoryEntryDef, story: StoryDef, replay: boolean): void {
  cur.currentStoryEntryId = entry.id;
  cur.currentStoryDefId = entry.storyId;
  cur.currentStoryPageIndex = 0;
  cur.currentStoryChoiceIndex = -1;
  cur.talkletClickWork = null;
  cur.choiceTextConfirmed = false;
  rt.flagsSetThisStory.clear();
  cur.insertStack = [];
  cur.visitedStoryIds = [entry.storyId];
  cur.jumpDepth = 0;
  cur.isReplay = replay;
  // 阅读日志：首条 Talklet 已显示（按 Story.id 记）
  rt.mutations.recordStoryRead(entry.storyId, 0);
  rt.eventBus.emit({ type: 'storyTriggered', storyId: entry.id });
  // 开幕标题：首页 Talklet 声明 showOpeningTitle 时随剧情开始（含重读）立即呼出，
  // 不要求先推进一页；推进离开首页时跳过该 op 防重复（见 advanceStory）。
  // 非首页声明仍在离开该页时呼出（幕间标题）。
  const leadOpening = story.talklets[0]?.effects?.find(effect => effect.op === 'showOpeningTitle');
  if (leadOpening) {
    rt.eventBus.emit(typeof leadOpening.value === 'string' && leadOpening.value
      ? { type: 'openingTitleShown', title: leadOpening.value }
      : { type: 'openingTitleShown' });
  }
}

/**
 * 启动一个剧情（active 或 passive）。ActiveStory 可打断正在播放的 PassiveStory。
 * 返回 StoryStartResult；GameInstance 在进入 Init 自动展开 startStoryId 时复用。
 *
 * 启动语义由 opts 控制：
 *   - 缺省：完整入口判定（availableInits / triggerCondition / AlreadyCompleted）
 *   - skipConditions: 跳过入口判定（用于聊天卡片——卡片出现本身即 gate），但仍尊重单次完成态
 *   - force: 跳过全部判定（Trigger 驱动的系统事件剧情），可打断被动闲聊
 *
 * @param owner 指定目标沙盒：非空 → 聊天沙盒；省略/null → 全局游标。
 */
export function startStory(
  rt: StoryRuntime,
  storyId: string,
  expectedType: 'active' | 'passive',
  owner?: string | null,
  opts?: { force?: boolean; skipConditions?: boolean },
): StoryStartResult {
  const force = opts?.force === true;
  // skipConditions 仅显式声明（聊天卡片——卡片出现本身即入口判定）；force 只影响
  // 可打断性与 AlreadyCompleted，不跳过入口判定（与旧 triggerStory 语义一致）。
  const skipConditions = opts?.skipConditions === true;
  const cur = rt.cursorFor(owner);
  if (!cur.empty) {
    const currentEntry = cur.currentStoryEntryId ? rt.entryById(cur.currentStoryEntryId) : undefined;
    if (expectedType === 'active') {
      // active（含羁绊剧情）：可打断被动闲聊，但不可打断 active 主线
      if (currentEntry?.type === 'passive') {
        cur.clear();
        // 继续启动 ActiveStory
      } else {
        return { success: false, storyId, error: 'AlreadyActive' };
      }
    } else if (force && currentEntry?.type === 'passive') {
      // 强制模式（Trigger 驱动的系统事件剧情）：打断已有被动闲聊再启动新剧情
      cur.clear();
    } else {
      return { success: false, storyId, error: 'AlreadyActive' };
    }
  }
  const entry = rt.entryById(storyId);
  if (!entry) return { success: false, storyId, error: 'NotFound' };
  if (entry.type !== expectedType) return { success: false, storyId, error: 'WrongStoryType' };
  const story = rt.storyOf(entry);
  if (!story || story.talklets.length === 0) return { success: false, storyId, error: 'NotFound' };
  if (!skipConditions) {
    if (entry.availableInits.length > 0 && !entry.availableInits.includes(rt.getState().activeInit)) {
      return { success: false, storyId, error: 'ConditionNotMet' };
    }
    if (entry.triggerCondition && !rt.conditionSystem.evaluateGroup(entry.triggerCondition, rt.getState())) {
      return { success: false, storyId, error: 'ConditionNotMet' };
    }
  }
  const repeatable = entry.type === 'passive' ? entry.repeatable : false;
  // 单次剧情（active / 不可重复 passive）：已完成则拒绝（force 模式除外，系统级剧情允许重放）
  if (!force && !repeatable && rt.hasCompletedStory(story.id)) {
    return { success: false, storyId, error: 'AlreadyCompleted' };
  }

  beginStory(rt, cur, entry, story, false);
  return { success: true, story: rt.getView(owner)! };
}

/**
 * Pick one eligible passive story via the pool system (tree draw + reactor gates).
 * @param initId 当前世界线
 * @param owner 壁垒：仅抽取归属该 VariantId 的闲聊（对话空间）；省略/null/'' = 全局闲聊。
 */
export function triggerPassiveStory(rt: StoryRuntime, initId: string = rt.getState().activeInit, owner?: string | null): StoryStartResult {
  const cur = rt.cursorFor(owner);
  // 并行双游标：本沙盒已有进行中故事 → 拒绝（不打断他人，也不重抽）。
  // owner 为空时全局游标进行中（如 active 主线）同样拒绝，避免覆盖。
  if (!cur.empty) return { success: false, error: 'AlreadyActive' };

  const selectedId = rt.passivePools.pick(rt.getState(), (entry) => {
    if (entry.weight <= 0) return false;
    // 好感台阶 / 羁绊尾巴（affectionRequired / pushAfterStory 声明者）退出随机抽取，只走就绪队列
    if (entry.affectionRequired != null || entry.pushAfterStory != null) return false;
    if (entry.availableInits.length > 0 && !entry.availableInits.includes(initId)) return false;
    if (entry.triggerCondition && !rt.conditionSystem.evaluateGroup(entry.triggerCondition, rt.getState())) return false;
    if (!entry.repeatable && rt.hasCompletedStory(entry.storyId)) return false;
    return true;
  }, {
    owner: owner ?? null,
    cooldowns: rt.getState().passiveCooldowns ?? {},
    blocks: rt.getState().studentBlocks ?? {},
  });

  if (!selectedId) return { success: false, error: 'NoAvailableStory' };
  return startStory(rt, selectedId, 'passive', owner);
}

/**
 * 就绪队列条目资格（§2 轴 B / §3）：
 * - 尾巴：pushAfterStory 达成（关联剧情已完结）∧ 本条未播过；
 * - 台阶：affectionRequired 达标 ∧ 本条未播过；
 * 公共：owner 壁垒 ∧ 未被阻断 ∧ 冷却外 ∧ availableInits ∧ triggerCondition。
 * repeatable 条目不入队列（可反复性由普通闲聊轴承担）；
 * 播出中的条目不计（内容已送达即不再未读）。
 */
function isReadyStep(rt: StoryRuntime, entry: PassiveStoryEntry, owner: string, level: number, blocked: boolean, activeEntryId: string | null): boolean {
  if (entry.repeatable) return false;
  if (entry.owner !== owner) return false;
  if (blocked) return false;
  if (entry.id === activeEntryId) return false;
  if (entry.pushAfterStory != null) {
    if (!rt.hasCompletedStory(entry.pushAfterStory)) return false;
  } else if (entry.affectionRequired != null) {
    if (entry.affectionRequired > level) return false;
  } else {
    return false; // 普通闲聊：走随机抽取，不入队列
  }
  if (rt.hasCompletedStory(entry.storyId)) return false; // 未经历过：播过即出队
  const state = rt.getState();
  if (entry.availableInits.length > 0 && !entry.availableInits.includes(state.activeInit)) return false;
  if (entry.triggerCondition && !rt.conditionSystem.evaluateGroup(entry.triggerCondition, state)) return false;
  const cooldowns = state.passiveCooldowns ?? {};
  const last = cooldowns[entry.id];
  if (last !== undefined && entry.cooldownFrames && state.totalFrames - last < entry.cooldownFrames) return false;
  return true;
}

/**
 * 就绪队列全量（按推送优先级排序）：尾巴（声明序）在前，好感台阶按需求值升序（并列按声明序）。
 */
export function readyStepIds(rt: StoryRuntime, owner: string): string[] {
  const state = rt.getState();
  const level = rt.conditionSystem.affectionLevelReader(owner, state);
  const blocked = !!state.studentBlocks?.[owner];
  const activeEntryId = rt.cursorFor(owner).currentStoryEntryId;
  const tails: string[] = [];
  const steps: { id: string; required: number }[] = [];
  for (const entry of rt.registry.passiveStories.values()) {
    if (!isReadyStep(rt, entry, owner, level, blocked, activeEntryId)) continue;
    if (entry.pushAfterStory != null) tails.push(entry.id);
    else steps.push({ id: entry.id, required: entry.affectionRequired! });
  }
  steps.sort((a, b) => a.required - b.required);
  return [...tails, ...steps.map(s => s.id)];
}

/**
 * 就绪队列查询（§2 轴 B）：取队列顶——尾巴强制优先，其后按需求值升序。
 * 顺序完全由数据决定（pushAfterStory 挂靠 / affectionRequired 数值），改数据即改顺序。
 */
export function pickAffectionStep(rt: StoryRuntime, owner: string): string | null {
  return readyStepIds(rt, owner)[0] ?? null;
}

/**
 * 台阶推送（§2 轴 B「进入即推 / 点击必中」）：就绪队列非空时自动开始队列顶。
 * 只在对应聊天空间内发生（owner 壁垒），绝不影响外部。
 */
export function triggerAffectionPush(rt: StoryRuntime, owner: string): StoryStartResult {
  const cur = rt.cursorFor(owner);
  if (!cur.empty) return { success: false, error: 'AlreadyActive' };
  const selectedId = pickAffectionStep(rt, owner);
  if (!selectedId) return { success: false, error: 'NoAvailableStory' };
  return startStory(rt, selectedId, 'passive', owner);
}

/**
 * 尾巴定向推送（§3）：关联剧情完结后立即开始该条尾巴（skipConditions——完结本身即入口判定）。
 * owner 不匹配 / 已播过 / 游标占用均不触发；未触发时尾巴留在就绪队列顶，由常规推送点送达。
 */
export function triggerTailPush(rt: StoryRuntime, owner: string, storyId: string): StoryStartResult {
  const cur = rt.cursorFor(owner);
  if (!cur.empty) return { success: false, error: 'AlreadyActive' };
  const level = rt.conditionSystem.affectionLevelReader(owner, rt.getState());
  const blocked = !!rt.getState().studentBlocks?.[owner];
  const tail = [...rt.registry.passiveStories.values()].find(entry =>
    entry.pushAfterStory === storyId && isReadyStep(rt, entry, owner, level, blocked, null));
  if (!tail) return { success: false, error: 'NoAvailableStory' };
  return startStory(rt, tail.id, 'passive', owner, { skipConditions: true });
}

export function advanceStory(rt: StoryRuntime, choiceIndex?: number, owner?: string | null): StoryAdvanceResult {
  const cur = rt.cursorFor(owner);
  if (cur.currentStoryEntryId === null) return { success: false, error: 'NoActiveStory' };
  const entry = rt.entryById(cur.currentStoryEntryId);
  if (!entry) {
    cur.clear();
    return { success: false, error: 'NotFound' };
  }
  const story = rt.storyOf(entry);
  const defId = cur.currentStoryDefId ?? entry.storyId;
  const def = rt.registry.stories.get(defId);
  if (!story || !def) {
    cur.clear();
    return { success: false, error: 'NotFound' };
  }

  const page = def.talklets[cur.currentStoryPageIndex];
  if (!page) {
    cur.clear();
    return { success: false, storyId: def.id, error: 'NotFound' };
  }

  const choices = page.choices ?? [];
  let selectedChoice: StoryChoice | undefined;
  if (choices.length > 0) {
    if (choiceIndex === undefined) {
      return { success: false, storyId: def.id, error: 'ChoiceRequired' };
    }
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= choices.length) {
      return { success: false, storyId: def.id, error: 'InvalidChoice' };
    }
    selectedChoice = choices[choiceIndex];
    if (selectedChoice.condition && !rt.conditionSystem.evaluateGroup(selectedChoice.condition, rt.getState())) {
      return { success: false, storyId: def.id, error: 'ChoiceConditionNotMet' };
    }
    cur.currentStoryChoiceIndex = choiceIndex;
  } else if (choiceIndex !== undefined) {
    return { success: false, storyId: def.id, error: 'InvalidChoice' };
  }

  // 解析跳转目标：选项级优先于 Talklet 级（提前到点击防护之前，供防护判断）。
  const jumpTarget = selectedChoice?.jumpToStory ?? page.jumpToStory;
  const jumpMode = (selectedChoice?.jumpMode ?? page.jumpMode) ?? 'goto';

  // 点击需求防护：click / clickWork 页若带 jumpToStory，或推进后会离开本 Story
  // （Story 末尾：insert 弹栈返回调用方 / goto 链完结），必须先经 clickSend 完成点击确认。
  const clickWorkDef = page.clickWork ?? (page.kind === 'click' ? { base: 1 } : undefined);
  const willLeaveStory = !!jumpTarget || cur.currentStoryPageIndex + 1 >= def.talklets.length;
  if (willLeaveStory && choices.length === 0 && clickWorkDef
      && (!cur.talkletClickWork || cur.talkletClickWork.done <= cur.talkletClickWork.total)) {
    return { success: false, storyId: def.id, error: 'ClickRequired' };
  }

  // 重阅读模式：分歧点准入守卫检查（在效果应用之前，拒绝时不产生任何副作用）。
  if (jumpTarget && cur.isReplay) {
    const guard = entry.branchGuards?.find(g => g.storyId === jumpTarget);
    if (guard && !rt.guardPrereqsMet(guard)) {
      return { success: false, storyId: def.id, error: 'BranchGuardDenied', denialMessage: guard.denialMessage };
    }
  }

  if (page.effects) {
    // 首页的 showOpeningTitle 已随 beginStory 开局呼出，推进离开首页时跳过防重复
    const pageEffects = cur.currentStoryPageIndex === 0
      ? page.effects.filter(effect => effect.op !== 'showOpeningTitle')
      : page.effects;
    if (pageEffects.length > 0) trackFlagsAndApply(rt, pageEffects);
  }
  if (selectedChoice?.effects) {
    trackFlagsAndApply(rt, selectedChoice.effects);
  }
  // 阅读日志：记录离开页 + 所选选项（按 Story.id 记）
  rt.mutations.recordStoryRead(def.id, cur.currentStoryPageIndex, selectedChoice ? choiceIndex : undefined);

  // 跳转：goto / insert
  if (jumpTarget) {
    return performJump(rt, cur, jumpTarget, jumpMode, def, owner);
  }

  // 正常推进
  cur.currentStoryPageIndex += 1;
  // 已离开上一页 → 重置点击工作进度与选项文本确认（下一页若需要会在 getSendState 中重新 roll）
  cur.talkletClickWork = null;
  cur.choiceTextConfirmed = false;
  if (cur.currentStoryPageIndex < def.talklets.length) {
    // 阅读日志：新页已显示
    rt.mutations.recordStoryRead(def.id, cur.currentStoryPageIndex);
    return { success: true, finished: false, story: rt.getView(owner)! };
  }

  // 本 Story 播完：insert 返回 or Entry 完结
  return resolveStoryEnd(rt, cur, def, owner);
}

/**
 * 查询底部"回复按钮"的当前状态。
 * 该按钮本质是聊天流中的一条 Talklet；玩家点击它推进剧情。
 */
export function getSendState(rt: StoryRuntime, owner?: string | null): SendState {
  const cur = rt.cursorFor(owner);
  // 无进行中剧情 → idle（点击可触发 PassiveTalk）
  if (cur.currentStoryEntryId === null) return { mode: 'idle', reason: 'noStory' };
  const entry = rt.entryById(cur.currentStoryEntryId);
  const defId = cur.currentStoryDefId ?? entry?.storyId;
  const story = defId ? rt.registry.stories.get(defId) : undefined;
  const page = story?.talklets[cur.currentStoryPageIndex];
  if (!entry || !story || !page) return { mode: 'idle', reason: 'noStory' };
  // click 页：纯底部按钮交互（text/sendText 作按钮文案），不提供选项
  const isClick = page.kind === 'click';
  // 当前 Talklet 有选项 → 回复按钮让位给选项
  if (!isClick && (page.choices ?? []).length > 0) {
    cur.talkletClickWork = null;
    return { mode: 'choice', confirmed: cur.choiceTextConfirmed };
  }
// 当前 Talklet 有羁绊剧情 → 渲染羁绊卡片（点击后启动目标 ActiveStoryEntry）
  if (!isClick && page.kizuna) {
    cur.talkletClickWork = null;
    return {
      mode: 'kizuna',
      storyId: entry.id,
      pageIndex: cur.currentStoryPageIndex,
      targetStoryId: page.kizuna.storyId,
      title: page.kizuna.title,
      buttonText: page.kizuna.buttonText,
      align: page.kizuna.align ?? 'left',
    };
  }

  // 点击工作：当前页无需求 → 清理残留；有需求且未初始化 → roll 随机总次数。
  const clickWork = page.clickWork ?? (isClick ? { base: 1 } : undefined);
  if (!clickWork) {
    cur.talkletClickWork = null;
  } else if (!cur.talkletClickWork) {
    cur.talkletClickWork = { total: rollClickWorkTotal(clickWork.base, clickWork.rand), done: 0 };
  }

  return {
    mode: 'advance',
    storyId: entry.id,
    pageIndex: cur.currentStoryPageIndex,
    text: isClick ? (page.sendText ?? page.text ?? '') : (page.sendText ?? ''),
    // 进度显示 clamp 到 total：已确认态（done = total + 1）在 UI 上显示为填满。
    clickWork: cur.talkletClickWork
      ? { total: cur.talkletClickWork.total, done: Math.min(cur.talkletClickWork.done, cur.talkletClickWork.total) }
      : undefined,
  };
}

/**
 * 玩家点击一次回复按钮。
 * - 剧情演出中：直接推进（advanceStory），并执行当前页效果
 * - 无剧情：尝试按当前场景随机抽取并开始一条 PassiveTalk
 *
 * 推进后若到达的页无交互需求（非 click、无选项、无 sendText、无 clickWork），
 * 会自动继续推进（向后吸收）直到下一个需要交互的页或剧情结束。
 */
export function clickSend(rt: StoryRuntime, owner?: string | null): SendResult {
  const state = getSendState(rt, owner);
  const cur = rt.cursorFor(owner);

  if (state.mode === 'choice') {
    // choice 页 text 阻塞：首次点击仅确认文本（不推进剧情），UI 随后渲染选项。
    if (!state.confirmed) cur.choiceTextConfirmed = true;
    return { type: 'choice' };
  }

  if (state.mode === 'kizuna') {
    // 羁绊卡片点击：清空当前游标（丢弃原 Story 剩余页，goto 语义），
    // 启动目标 ActiveStoryEntry 的演出 Story。skipConditions：卡片出现本身即入口判定；
    // 但仍尊重单次完成态（AlreadyCompleted 拒绝），见 startStory。
    cur.clear();
    const result = startStory(rt, state.targetStoryId, 'active', owner, { skipConditions: true });
    if (result.success) {
      return {
        type: 'completed',
        storyId: state.targetStoryId,
        finished: false,
        sentText: '',
        echoReply: false,
        advance: { success: true, finished: false, story: result.story },
        absorbed: [],
      };
    }
    return { type: 'idle', started: false, error: result.error };
  }

  if (state.mode === 'idle') {
    // 台阶优先（§2 轴 B）：就绪队列非空时点击必中队列顶；队列空回落加权随机闲聊
    if (owner) {
      const pushed = triggerAffectionPush(rt, owner);
      if (pushed.success) return { type: 'idle', started: true };
    }
    const result = triggerPassiveStory(rt, rt.getState().activeInit, owner);
    if (result.success) return { type: 'idle', started: true };
    return { type: 'idle', started: false, error: result.error };
  }

  const sentText = state.text;

  // 回显决策（引擎侧、数据驱动）：由被点击页的 kind/muteReply/sendText 决定
  const echoedPage = rt.currentPage(cur);
  const echoReply = !!echoedPage && shouldEchoReply(echoedPage);

  // 多击任务：前 total 次点击从左往右填充进度条（最后一次填满 100%），
  if (state.clickWork) {
    const total = state.clickWork.total;
    const done = state.clickWork.done + 1;
    if (total > 1 && done <= total) {
      cur.talkletClickWork = { total, done };
      return { type: 'working', storyId: state.storyId, pageIndex: state.pageIndex, clicksDone: done, clicksTotal: total };
    }
    cur.talkletClickWork = { total, done: total + 1 };
  }

  const advance = advanceStory(rt, undefined, owner);

  const absorbed: StoryView[] = [];
  const finished = advance.success && 'finished' in advance ? advance.finished : false;

  return {
    type: 'completed',
    storyId: state.storyId,
    finished,
    sentText,
    echoReply,
    advance,
    absorbed,
  };
}

export function getCurrentStoryView(rt: StoryRuntime, owner?: string | null): StoryView | null {
  const cur = rt.cursorFor(owner);
  if (cur.currentStoryEntryId === null) return null;
  const entry = rt.entryById(cur.currentStoryEntryId);
  const defId = cur.currentStoryDefId ?? entry?.storyId;
  const story = defId ? rt.registry.stories.get(defId) : undefined;
  const page = story?.talklets[cur.currentStoryPageIndex];
  if (!entry || !story || !page) return null;

  return {
    storyId: entry.id,
    storyDefId: story.id,
    type: entry.type,
    pageIndex: cur.currentStoryPageIndex,
    totalPages: story.talklets.length,
    page: {
      ...page,
      effects: page.effects ? [...page.effects] : undefined,
      choices: page.choices?.map(choice => ({
        ...choice,
        effects: [...choice.effects],
      })),
    },
    availableChoiceIndexes: (page.choices ?? []).reduce<number[]>((indexes, choice, index) => {
      if (!choice.condition || rt.conditionSystem.evaluateGroup(choice.condition, rt.getState())) {
        indexes.push(index);
      }
      return indexes;
    }, []),
  };
}

/** 应用剧情页/选项效果：记录 setFlag（供完成通知），跳过 travelToArea（单独处理）。 */
export function trackFlagsAndApply(rt: StoryRuntime, effects: Effect[]): void {
  for (const effect of effects) {
    if (effect.op === 'setFlag') rt.flagsSetThisStory.add(effect.target);
  }
  rt.effectEngine.applyEffects(effects.filter(effect => effect.op !== 'travelToArea'));
  applyStoryTravel(rt, effects);
}

/**
 * 执行剧情页/选项中的 travelToArea effect（Story 自身要求移动，不受玩家限制）。
 * 不判断拓扑（checkAdjacency=false），但 area 不属于当前 Init 时跳过移动（静默，不中断剧情）。
 * effect.notice=true 且移动成功 → 发出 storyAreaTraveled 事件，供 UI 显示「移动到了 XX」迷你条目。
 */
export function applyStoryTravel(rt: StoryRuntime, effects: Effect[] | undefined): void {
  if (!effects) return;
  for (const effect of effects) {
    if (effect.op !== 'travelToArea') continue;
    const result = rt.travelToArea(effect.target, true, false);
    if (result.success && effect.notice) {
      rt.eventBus.emit({ type: 'storyAreaTraveled', areaId: effect.target });
    }
  }
}
