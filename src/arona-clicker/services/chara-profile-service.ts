import type { Registry } from '../../data-services/registry/registry';
import type { CharacterProfileMutationPort } from '../contracts/mutation';
import type { ImageStore } from '../../data-services/assets/image-store';
import { resolvePicSrc } from '../../data-services/assets/pic-resolver';
import { resolveCharaProfile } from './chara-profile-resolver';
import type { PlayerState } from '../types/state';
import type { Character } from '../types/ids';
import type { CharaProfile, CharaCustomOverride } from '../types/chara-profile';
import type { CharaNameEntry, CharaAvatarEntry } from '../../data-services/contracts/chara-profile';
import type { PicId } from '../../data-services/contracts/pic';

/** AronaClicker 的 Chara 头像-人名对服务。 */
export class CharaProfileService {
  constructor(
    private readonly registry: Registry,
    private readonly mutations: CharacterProfileMutationPort,
    private readonly imageStore: ImageStore,
    private readonly getState: () => PlayerState,
  ) {}

  characterProfile(
    character: Character | null,
    overrides?: { name?: string; avatar?: PicId },
  ): CharaProfile {
    return resolveCharaProfile(
      this.registry,
      this.getState().charaCustom,
      pic => resolvePicSrc(this.registry.pics, this.imageStore, pic),
      character,
      overrides,
    );
  }

  setCharaProfile(character: Character, override: CharaCustomOverride): void {
    this.mutations.setCharaCustom(character, override);
  }

  clearCharaProfile(character: Character): void {
    this.mutations.clearCharaCustom(character);
  }

  charaNames(character: Character): CharaNameEntry[] {
    return this.registry.charaProfiles.get(character)?.names ?? [];
  }

  charaAvatars(character: Character): CharaAvatarEntry[] {
    return this.registry.charaProfiles.get(character)?.avatars ?? [];
  }
}
