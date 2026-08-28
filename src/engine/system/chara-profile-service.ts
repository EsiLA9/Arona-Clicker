// ============================================================
// engine/system/chara-profile-service.ts — Chara 头像-人名对服务
//
// 便捷取/覆写某 Chara 当前使用的头像-人名对（原 GameInstance 门面
// 方法组的外移）。解析管线：兜底 → chara 表(declared) → 玩家覆写
// (player) → 调用点(override)；avatar 为已解析 URL，前端直接用。
// ============================================================

import type { Registry } from '../registry/registry';
import type { StateMutationService } from './state-mutation-service';
import type { ImageStore } from '../image/index';
import { resolvePicSrc } from '../image/index';
import { resolveCharaProfile } from '../core/chara-profile';
import type { PlayerState, Character } from '../types';
import type { CharaProfile, CharaCustomOverride, CharaNameEntry, CharaAvatarEntry } from '../types/chara-profile';
import type { PicId } from '../types/pics';

export class CharaProfileService {
  constructor(
    private readonly registry: Registry,
    private readonly mutations: StateMutationService,
    private readonly imageStore: ImageStore,
    private readonly getState: () => PlayerState,
  ) {}

  /**
   * 取某 Chara 当前使用的头像-人名对。
   */
  characterProfile(
    character: Character | null,
    overrides?: { name?: string; avatar?: PicId },
  ): CharaProfile {
    return resolveCharaProfile(
      this.registry,
      this.getState().charaCustom,
      pic => resolvePicSrc(this.registry, this.imageStore, pic),
      character,
      overrides,
    );
  }

  /** 玩家侧覆写某 Chara 的头像-人名对（player 层，随存档持久化）。 */
  setCharaProfile(character: Character, override: CharaCustomOverride): void {
    this.mutations.setCharaCustom(character, override);
  }

  /** 清除某 Chara 的玩家侧覆写（回到 chara 声明 / 兜底）。 */
  clearCharaProfile(character: Character): void {
    this.mutations.clearCharaCustom(character);
  }

  /** Chara 的 name 表（改名/选名面板用）。 */
  charaNames(character: Character): CharaNameEntry[] {
    return this.registry.charaProfiles.get(character)?.names ?? [];
  }

  /** Chara 的 avatar 表（换头像面板用）。 */
  charaAvatars(character: Character): CharaAvatarEntry[] {
    return this.registry.charaProfiles.get(character)?.avatars ?? [];
  }
}
