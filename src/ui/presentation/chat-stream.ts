import type { GameReadModel } from '../../arona-clicker/contracts/index';
import type { StoryPresentationView } from '../../arona-clicker/contracts/runtime/story-presentation';
import type { ActiveBanner, PanelState, SendGatePhase } from '../components/shared/app-shell';
import type { ChatEntry, ChatTextEntry } from '../components/story/story';
import { BANNER_ANIMATION_MS } from '../components/story/story-gate';
import { FLOW_STREAM_MAX, applyFlowEntryInPlace } from '../flow/flow-entry';

interface LegacyBanner {
  readonly title: string;
  readonly startedAt: number;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** Projects Runtime Story output into the existing chat surface. It never advances a Story. */
export class ChatStream {
  private chatId = 1;
  private readonly playback = new Map<string, StoryPresentationView>();
  private readonly outputIds = new Map<string, Map<string, number>>();
  private readonly typingIds = new Map<string, { readonly token?: string; readonly id: number }>();
  /** Only non-Story effects use the legacy banner animation timer. */
  private readonly legacyBanners = new Map<string, LegacyBanner>();
  onChange: (() => void) | null = null;

  reset(): void {
    this.playback.clear();
    this.outputIds.clear();
    this.typingIds.clear();
    for (const key of this.legacyBanners.keys()) this.clearBanner(key);
  }

  /** Local histories contain ordinary UI notices; Runtime restores its own Story output. */
  restoreHistoryState(panelState: PanelState, game: Pick<GameReadModel, 'story'>): void {
    this.reset();
    const streams: [string | null, ChatEntry[]][] = [[null, panelState.chatEntries], ...Object.entries(panelState.studentChats)];
    for (const [owner, entries] of streams) {
      for (const entry of entries) this.chatId = Math.max(this.chatId, entry.id + 1);
      this.syncCurrentStory({ ...panelState, conversationVariantId: owner }, game);
    }
  }

  /** Legacy effects outside a Story run keep their existing banner surface. */
  showBanner(streamKey: string, title: string): void {
    this.clearBanner(streamKey);
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      this.legacyBanners.delete(streamKey);
      this.onChange?.();
    }, BANNER_ANIMATION_MS);
    this.legacyBanners.set(streamKey, { title, startedAt, timer });
  }

  activeBanner(panelState: PanelState, replayId?: string): ActiveBanner | null {
    const key = replayId ? `replay:${replayId}` : panelState.conversationVariantId ?? '#global';
    const current = this.playback.get(key)?.banner;
    if (current) return {
      title: current.title,
      startedAt: Date.now() - Math.max(0, BANNER_ANIMATION_MS - current.remainingMs),
    };
    const legacy = this.legacyBanners.get(key);
    return legacy ? { title: legacy.title, startedAt: legacy.startedAt } : null;
  }

  bannerBlocking(panelState: PanelState, replayId?: string): boolean {
    const key = replayId ? `replay:${replayId}` : panelState.conversationVariantId ?? '#global';
    return this.playback.get(key)?.phase === 'banner' || this.legacyBanners.has(key);
  }

  private clearBanner(key: string): void {
    const banner = this.legacyBanners.get(key);
    if (!banner) return;
    clearTimeout(banner.timer);
    this.legacyBanners.delete(key);
  }

  activeStream(panelState: PanelState): ChatEntry[] {
    const owner = panelState.conversationVariantId;
    if (panelState.storyReplay?.owner === owner) return panelState.storyReplay.entries;
    return owner ? (panelState.studentChats[owner] ??= []) : panelState.chatEntries;
  }

  activeGate(panelState: PanelState, replayId?: string): SendGatePhase | null {
    const phase = this.playback.get(replayId ? `replay:${replayId}` : panelState.conversationVariantId ?? '#global')?.phase;
    if (phase === 'typing' || phase === 'thinking') return phase;
    return phase === 'operation' || phase === 'finishing' || phase === 'banner' || phase === 'failed' ? 'pause' : null;
  }

  /** Repeated reads, multiple displays and restored histories project the same stable records. */
  syncCurrentStory(panelState: PanelState, game: Pick<GameReadModel, 'story'>, replayId?: string): void {
    const owner = panelState.conversationVariantId;
    const key = replayId ? `replay:${replayId}` : owner ?? '#global';
    const replay = replayId && panelState.storyReplay?.replayId === replayId ? panelState.storyReplay : undefined;
    const current = replay
      ? game.story.getReplayPlaybackView(replayId!) ?? game.story.getPlaybackView(owner)
      : game.story.getPlaybackView(owner);
    const previous = this.playback.get(key);
    const stream = replay ? replay.entries : owner ? (panelState.studentChats[owner] ??= []) : panelState.chatEntries;
    for (const entry of stream) this.chatId = Math.max(this.chatId, entry.id + 1);
    if (previous && previous.epoch !== current.epoch) stream.length = 0;
    this.playback.set(key, current);

    const ids = this.outputIds.get(key) ?? new Map<string, number>();
    for (const entry of stream) if (entry.storyOutputId) ids.set(entry.storyOutputId, entry.id);
    const outputs = current.entries;
    const retained = new Set(outputs.map(entry => entry.id));
    for (const id of ids.keys()) if (!retained.has(id)) ids.delete(id);
    this.outputIds.set(key, ids);

    const local = replay ? [] : stream.filter(entry => !entry.storyOutputId && entry.kind !== 'typing');
    const projected: ChatEntry[] = outputs.map(entry => {
      let id = ids.get(entry.id);
      if (id === undefined) { id = this.chatId++; ids.set(entry.id, id); }
      const { id: storyOutputId, sequence: _sequence, historyId: _historyId, kind, ...content } = entry;
      return { ...content, id, storyOutputId, kind: kind === 'travel' ? 'reward' : kind };
    });
    // Local travel notices capture their position before the synchronous travel command.
    // Runtime records retain their own sequence even when both clocks report the same millisecond.
    const slots: ChatEntry[][] = Array.from({ length: projected.length + 1 }, () => []);
    for (const entry of replay ? [] : local) {
      const position = entry.afterStoryOutput;
      const index = current.entries.findIndex(output => position?.epoch === current.epoch
        ? position.sequence < output.sequence : entry.timestamp <= output.timestamp);
      slots[index < 0 ? projected.length : index]!.push(entry);
    }
    const merged: ChatEntry[] = [];
    for (let index = 0; index < projected.length; index++) merged.push(...slots[index]!, projected[index]!);
    merged.push(...slots[projected.length]!);
    if (current.phase === 'typing' && current.typing) {
      let typing = this.typingIds.get(key);
      if (!typing || typing.token !== current.token) {
        typing = { token: current.token, id: this.chatId++ };
        this.typingIds.set(key, typing);
      }
      merged.push({ ...current.typing, id: typing.id, timestamp: Date.now(), kind: 'typing', text: '' });
    } else this.typingIds.delete(key);
    stream.splice(0, stream.length, ...merged.slice(-FLOW_STREAM_MAX));
  }

  push(panelState: PanelState, entry: Omit<ChatEntry, 'id' | 'timestamp'>): void {
    this.append(this.activeStream(panelState), entry);
  }

  pushToVariant(panelState: PanelState, owner: string, entry: Omit<ChatEntry, 'id' | 'timestamp'>): void {
    this.append((panelState.studentChats[owner] ??= []), entry);
  }

  /** Undefined is retained only for legacy notices outside a Story run. */
  pushToOwner(panelState: PanelState, owner: string | null | undefined, entry: Omit<ChatEntry, 'id' | 'timestamp'> & { timestamp?: number }): void {
    this.append(owner === undefined ? this.activeStream(panelState) : owner === null ? panelState.chatEntries : (panelState.studentChats[owner] ??= []), entry);
  }

  activeChatTexts(panelState: PanelState, owner?: string | null, replayId?: string): ChatTextEntry[] {
    const target = owner === undefined ? panelState.conversationVariantId : owner;
    if (replayId) return panelState.storyReplay?.replayId === replayId ? panelState.storyReplay.chatTexts : [];
    return target ? (panelState.studentChatTexts[target] ??= []) : panelState.chatTexts;
  }

  clearAll(panelState: PanelState, owner?: string | null): void {
    const target = owner === undefined ? panelState.conversationVariantId : owner;
    const stream = target ? (panelState.studentChats[target] ??= []) : panelState.chatEntries;
    stream.length = 0;
    this.activeChatTexts(panelState, target).length = 0;
  }

  clearAllTexts(panelState: PanelState, owner?: string | null): void {
    this.activeChatTexts(panelState, owner).length = 0;
  }

  pushChatText(panelState: PanelState, entry: ChatTextEntry, owner?: string | null, replayId?: string): void {
    const texts = this.activeChatTexts(panelState, owner, replayId);
    const index = texts.findIndex(value => value.id === entry.id);
    if (index < 0) texts.push(entry);
    else texts[index] = entry;
  }

  clearChatText(panelState: PanelState, id: string, owner?: string | null, replayId?: string): void {
    const texts = this.activeChatTexts(panelState, owner, replayId);
    const index = texts.findIndex(entry => entry.id === id);
    if (index >= 0) texts.splice(index, 1);
  }

  endRun(panelState: PanelState, owner: string | null, runId: string, replayId?: string): void {
    const texts = this.activeChatTexts(panelState, owner, replayId);
    for (let index = texts.length - 1; index >= 0; index--) if (texts[index]!.runId === runId) texts.splice(index, 1);
    // Runtime owns phase/timer cleanup. An old run event cannot clear the new snapshot.
  }

  private append(stream: ChatEntry[], entry: Omit<ChatEntry, 'id' | 'timestamp'> & { timestamp?: number }): void {
    applyFlowEntryInPlace(stream, { ...entry, id: this.chatId++, timestamp: entry.timestamp ?? Date.now() }, FLOW_STREAM_MAX);
  }
}
