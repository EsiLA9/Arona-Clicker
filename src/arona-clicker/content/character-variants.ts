import { variant } from './def-factory';
import { Character, CharacterRarity, CharacterSchool } from '../types/ids';
import type { CharacterVariantDef } from '../types/character';
import { allCharacters } from './characters';

function defaultVariants(): CharacterVariantDef[] {
  const defaultColorGroups: Record<string, string> = {
    [Character.Arona]: 'base:colorgroup:schale-solid',
    [Character.Shiroko]: 'base:colorgroup:shiroko-duotone',
    [Character.Serika]: 'base:colorgroup:serika-gradient',
    [Character.Yuuka]: 'base:colorgroup:yuuka-radial',
    [Character.Mika]: 'base:colorgroup:mika-pie',
    [Character.Iori]: 'base:colorgroup:iori-gradient',
    [Character.Miyako]: 'base:colorgroup:miyako-duotone',
    [Character.Saori]: 'base:colorgroup:saori-radial',
  };
  return allCharacters.filter(c => c.id !== Character.None).map(c => {
    const id = `${c.id.charAt(0).toUpperCase()}${c.id.slice(1)}`;
    const theme = id === 'Yuuka' || id === 'Noa'
      ? { colorGroupId: 'base:colorgroup:violet', tokens: { primary: '#8b5cf6' } }
      : undefined;
    const b = variant(id, c.id)
      .name(c.name).displayName(c.displayName).school(c.school).rarity(c.rarity)
      .desc(c.description).default().curve('base:cultivatecurve:standard')
      .gearSlots('base:gear:attack-hat', 'base:gear:defense-vest', 'base:gear:special-badge');
    if (theme) b.theme(theme.colorGroupId, theme.tokens);
    if (c.id === Character.Hoshino) b.avatar('base:avatar(pic):hoshino');
    else if (defaultColorGroups[c.id]) b.colorGroup(defaultColorGroups[c.id]);
    return b.build();
  });
}

const specialVariants: CharacterVariantDef[] = [
  variant('HoshinoSwimsuit', Character.Hoshino)
    .name('泳装星野').displayName('小鸟游星野（泳装）')
    .school(CharacterSchool.Abydos).rarity(CharacterRarity.SuperRare)
    .desc('换上泳装的星野学长。夏日限定，慵懒依旧。')
    .curve('base:cultivatecurve:standard')
    .gearSlots('base:gear:attack-glove', 'base:gear:defense-shoes', 'base:gear:special-watch')
    .colorGroup('base:colorgroup:hoshino-gradient').build(),
];

export const baseCharacterVariants: CharacterVariantDef[] = [...defaultVariants(), ...specialVariants];
