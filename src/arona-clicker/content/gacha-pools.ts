import { gachaPool } from './def-factory/gacha-pool';
import { CharacterRarity } from '../types/ids';
import type { GachaPoolDef } from '../../data-services/contracts/gacha-pool';
import { baseCharacterVariants } from './character-variants';

export const baseGachaPools: GachaPoolDef[] = [
  gachaPool('base:gachapool:regular')
    .name('常规招募').desc('常驻开放的招募池。')
    .currency(Resource.Pyroxene).costPerPull(120)
    .rate(CharacterRarity.Common, 79).rate(CharacterRarity.Rare, 18).rate(CharacterRarity.SuperRare, 3)
    .dupRewards(5, { [Resource.Credit]: 200 })
    .members(...baseCharacterVariants.filter(v => v.isDefault && v.id !== 'HoshinoSwimsuit').map(v => v.id)).build(),
  gachaPool('base:gachapool:swimsuit-up')
    .name('夏日限定 Pick Up').desc('泳装星野概率提升！重复获得返还其专属碎片。')
    .currency(Resource.Pyroxene).costPerPull(120)
    .rate(CharacterRarity.Common, 77).rate(CharacterRarity.Rare, 18).rate(CharacterRarity.SuperRare, 5)
    .featured('HoshinoSwimsuit').pity(50)
    .dupRewards(10, { [Resource.Credit]: 500 })
    .members('HoshinoSwimsuit', 'Shiroko', 'Hoshino', 'Serika').build(),
];
import { Resource } from '../types/ids';
