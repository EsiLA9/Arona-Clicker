export type CharacterPersistScope = 'global' | 'init';

export interface CharacterPersistConfig {
  roster?: CharacterPersistScope;
  gacha?: CharacterPersistScope;
  equips?: CharacterPersistScope;
  chatRead?: CharacterPersistScope;
}
