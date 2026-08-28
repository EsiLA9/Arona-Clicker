// ============================================================
// data/base/character-rework.ts — Character 重构基础数据
//
// 差分 / 培养曲线 / 色彩 / 卡池 / 聊天流 / 三层归属声明。
// 设计文档：docs-818/12-character-rework.md；测试规格：12-character-rework-tests.md。
// ============================================================

import {
  ActiveStoryEntry,
  activeStory,
  and,
  Character,
  CharacterPersistConfig,
  CharacterRarity,
  CharacterSchool,
  CharacterVariantDef,
  chatMessage,
  ChatMessageDef,
  colorGroup,
  ColorGroupDef,
  colorEquipment,
  ColorEquipmentDef,
  cultivateCurve,
  CultivateCurveDef,
  gachaPool,
  GachaPoolDef,
  line,
  narrate,
  Resource,
  story,
  StoryDef,
  talklet,
  variant,
} from '../../engine/types';
import { allCharacters } from './characters';

/** 全局默认培养曲线：上限 30 级、线性经验、5 星突破每星 +5 级上限。 */
export const baseCultivateCurves: CultivateCurveDef[] = [
  cultivateCurve('base:curve:standard')
    .maxLevel(30)
    .expTable(...Array.from({ length: 34 }, (_, i) => 100 * (i + 1)))
    .starMax(5)
    .starCost(1, 3, 10, 30, 60)
    .levelCapPerStar(5)
    .build(),
];

/**
 * 默认差分：每个原型一个 isDefault 差分（id = 原型 id 首字母大写），
 * spotTagBonus 沿用原型旧表（字段冻结预留，不参与计算）。
 */
function defaultVariants(): CharacterVariantDef[] {
  // 除星野外，每位角色的默认头像色组（星野默认差分使用 pics 图片头像）
  const defaultColorGroups: Record<string, string> = {
    [Character.Arona]: 'base:group:schale-solid',
    [Character.Shiroko]: 'base:group:shiroko-duotone',
    [Character.Serika]: 'base:group:serika-gradient',
    [Character.Yuuka]: 'base:group:yuuka-radial',
    [Character.Mika]: 'base:group:mika-pie',
    [Character.Iori]: 'base:group:iori-gradient',
    [Character.Miyako]: 'base:group:miyako-duotone',
    [Character.Saori]: 'base:group:saori-radial',
  };
  return allCharacters
    .filter(c => c.id !== Character.None)
    .map(c => {
      const id = `${c.id.charAt(0).toUpperCase()}${c.id.slice(1)}`;
      // 千年学生：打开对话空间时界面切换为对应特色的对话主题
      const theme = id === 'Yuuka' || id === 'Noa'
        ? { colorGroupId: 'base:group:violet', tokens: { primary: '#8b5cf6' } }
        : undefined;
      const b = variant(id, c.id)
        .name(c.name)
        .displayName(c.displayName)
        .school(c.school)
        .rarity(c.rarity)
        .desc(c.description)
        .default()
        .curve('base:curve:standard');
      if (theme) b.theme(theme.colorGroupId, theme.tokens);
      // 星野默认差分头像指向 pics 表；其余角色用 ColorGroup 抽象头像
      if (c.id === Character.Hoshino) {
        b.avatar('base:avatar(pic):hoshino');
      } else {
        const cg = defaultColorGroups[c.id];
        if (cg) b.colorGroup(cg);
      }
      return b.build();
    });
}

/** 特殊差分示例：与默认差分独立培养/碎片，验证差分隔离。 */
const specialVariants: CharacterVariantDef[] = [
  variant('HoshinoSwimsuit', Character.Hoshino)
    .name('泳装星野')
    .displayName('小鸟游星野（泳装）')
    .school(CharacterSchool.Abydos)
    .rarity(CharacterRarity.SuperRare)
    .desc('换上泳装的星野学长。夏日限定，慵懒依旧。')
    .curve('base:curve:standard')
    .colorGroup('base:group:hoshino-gradient')
    .build(),
];

export const baseCharacterVariants: CharacterVariantDef[] = [...defaultVariants(), ...specialVariants];

/**
 * 色彩组（唯一色彩实体）：重点色彩组（slots 内联 hex）+ 头像渲染方案（compositionType）
 * + theme-tree 预设（theme 覆盖表，primary 缺省取主色位）+ 解锁条件。
 * 原 Color（纯主题皮肤，solid 单色组）与 ColorGroup（头像模板）合并为一表：
 * 共享色（sky/ink/rose 等）按字面 hex 复制进各组的 slots/theme，组间互不牵连。
 */
export const baseColorGroups: ColorGroupDef[] = [
  // --- 主题皮肤（solid 单色组；原 Color） ---
  colorGroup('base:group:schale-solid')
    .name('夏莱蓝').desc('什亭之匣的标准配色。获得阿罗娜后解锁。')
    .type('solid')
    .primary('#3b82f6')
    .unlockProtoStat(Character.Arona)
    .build(),
  colorGroup('base:group:abydos-sand')
    .name('阿比多斯黄沙').desc('被沙漠侵蚀的学园配色。拥有星野（任一差分）后解锁。')
    .type('solid')
    .primary('#eab308')
    .unlockProtoStat(Character.Hoshino)
    .build(),
  colorGroup('base:group:momotalk-pink')
    .name('Momotalk 粉').desc('聊天软件的主题色。完成欢迎剧情（flag）后解锁。')
    .type('solid')
    .primary('#ec4899')
    .unlockFlag('momotalk_pink_unlocked')
    .build(),
  colorGroup('base:group:hoshino-swim')
    .name('星野·泳装').desc('夏日泳池的清凉蓝调。拥有星野（任一差分）后解锁。')
    .type('solid')
    .primary('#3ec6e0')
    .unlockProtoStat(Character.Hoshino)
    .build(),
  colorGroup('base:group:rose')
    .name('玫瑰').desc('获得白子后解锁。')
    .type('solid')
    .primary('#ff5d8f')
    .unlockProtoStat(Character.Shiroko)
    .build(),
  colorGroup('base:group:emerald')
    .name('翡翠').desc('获得芹香后解锁。')
    .type('solid')
    .primary('#10b981')
    .unlockProtoStat(Character.Serika)
    .build(),
  colorGroup('base:group:violet')
    .name('紫罗兰').desc('获得优香后解锁。')
    .type('solid')
    .primary('#8b5cf6')
    .unlockProtoStat(Character.Yuuka)
    .build(),
  colorGroup('base:group:amber')
    .name('琥珀').desc('获得未花后解锁。')
    .type('solid')
    .primary('#f59e0b')
    .unlockProtoStat(Character.Mika)
    .build(),
  colorGroup('base:group:crimson')
    .name('绯红').desc('获得伊织后解锁。')
    .type('solid')
    .primary('#e11d48')
    .unlockProtoStat(Character.Iori)
    .build(),
  colorGroup('base:group:teal')
    .name('青碧').desc('获得都子后解锁。')
    .type('solid')
    .primary('#14b8a6')
    .unlockProtoStat(Character.Miyako)
    .build(),
  colorGroup('base:group:indigo')
    .name('靛蓝').desc('获得纱织后解锁。')
    .type('solid')
    .primary('#6366f1')
    .unlockProtoStat(Character.Saori)
    .build(),
  colorGroup('base:group:sky')
    .name('晴空').desc('获得阿罗娜后解锁（浅蓝变体）。')
    .type('solid')
    .primary('#38bdf8')
    .unlockProtoStat(Character.Arona)
    .build(),
  colorGroup('base:group:lime')
    .name('青柠').desc('完成欢迎剧情（flag）后解锁。')
    .type('solid')
    .primary('#a3e635')
    .unlockFlag('momotalk_pink_unlocked')
    .build(),
  colorGroup('base:group:ink')
    .name('墨蓝').desc('拥有星野（任一差分）后解锁（深底变体）。')
    .type('solid')
    .primary('#1e3a5f')
    .theme({ panel: '#101828' }) // 部分节点示例：只定义 panel，其余仍由 primary 派生
    .unlockProtoStat(Character.Hoshino)
    .build(),
  colorGroup('base:group:coral')
    .name('珊瑚').desc('完成欢迎剧情（flag）后解锁（全量自定义覆盖示例）。')
    .type('solid')
    .primary('#ff7a59')
    .theme({ primary: '#ff7a59', bg: '#fff3ee', bgAlt: '#ffe6dc', text: '#3a1f17', textDim: '#8a6a5c', border: '#ffd0c0', accent: '#ff9e80', panel: '#fff7f2' })
    .unlockFlag('momotalk_pink_unlocked')
    .build(),

  // --- 头像构成模板（组合色组；原 ColorGroup） ---
  colorGroup('base:group:hoshino-gradient')
    .name('星野·渐变').desc('泳装蓝调的柔滑渐变。')
    .type('gradient')
    .primary('#3ec6e0')
    .slot('secondary', '#38bdf8')
    .theme({ playerBubble: '#0e3a4d' }) // 部分节点示例：组声明自己的 player-bubble，其余沿用主色位
    .build(),
  colorGroup('base:group:abydos-duotone')
    .name('阿比多斯·双色').desc('黄沙主色 + 墨蓝阴影的阶调层次。')
    .type('duotone')
    .primary('#eab308')
    .slot('shadow', '#1e3a5f')
    .build(),
  colorGroup('base:group:prism-pie')
    .name('棱镜·饼图').desc('四色分区构成的抽象头像。')
    .type('pie')
    .primary('#ff5d8f')
    .slot('secondary', '#10b981')
    .slot('accent', '#8b5cf6')
    .slot('highlight', '#f59e0b')
    .build(),
  colorGroup('base:group:radial-dawn')
    .name('黎明·径向').desc('珊瑚中心向绯红边缘的径向渐变。')
    .type('radial')
    .primary('#ff7a59')
    .slot('edge', '#ff5d8f')
    .build(),
  // 角色默认头像色组：除星野（使用 pics 图片头像）外，每人一套专属构成；解锁随角色获得
  colorGroup('base:group:shiroko-duotone')
    .name('白子·双色').desc('白子的玫瑰主色叠墨蓝阴影。')
    .type('duotone')
    .primary('#ff5d8f')
    .slot('shadow', '#1e3a5f')
    .unlockProtoStat(Character.Shiroko)
    .build(),
  colorGroup('base:group:serika-gradient')
    .name('芹香·渐变').desc('芹香的翡翠色滑向青柠色。')
    .type('gradient')
    .primary('#10b981')
    .slot('secondary', '#a3e635')
    .unlockProtoStat(Character.Serika)
    .build(),
  colorGroup('base:group:yuuka-radial')
    .name('优香·径向').desc('优香的紫罗兰色中心向晴空色散射。')
    .type('radial')
    .primary('#8b5cf6')
    .slot('edge', '#38bdf8')
    .unlockProtoStat(Character.Yuuka)
    .build(),
  colorGroup('base:group:mika-pie')
    .name('未花·饼图').desc('未花的多彩扇形分区。')
    .type('pie')
    .primary('#f59e0b')
    .slot('secondary', '#ff5d8f')
    .slot('accent', '#8b5cf6')
    .slot('highlight', '#10b981')
    .unlockProtoStat(Character.Mika)
    .build(),
  colorGroup('base:group:iori-gradient')
    .name('伊织·渐变').desc('伊织的绯红向墨蓝渐沉。')
    .type('gradient')
    .primary('#e11d48')
    .slot('secondary', '#1e3a5f')
    .unlockProtoStat(Character.Iori)
    .build(),
  colorGroup('base:group:miyako-duotone')
    .name('都子·双色').desc('都子的青碧主色叠墨蓝阴影。')
    .type('duotone')
    .primary('#14b8a6')
    .slot('shadow', '#1e3a5f')
    .unlockProtoStat(Character.Miyako)
    .build(),
  colorGroup('base:group:saori-radial')
    .name('纱织·径向').desc('纱织的靛蓝中心向晴空色散射。')
    .type('radial')
    .primary('#6366f1')
    .slot('edge', '#38bdf8')
    .unlockProtoStat(Character.Saori)
    .build(),
];

/** 色彩装备：收集品，捆绑色彩组（头像视觉 + 主题预设）+ 数值效用。 */
export const baseColorEquipments: ColorEquipmentDef[] = [
  colorEquipment('base:equip:schale-badge')
    .name('夏莱徽章').desc('什亭之匣的标准徽章，信用点获取 +1。')
    .colorGroup('base:group:schale-solid')
    .effects({ op: 'addResource', target: Resource.Credit, value: 1 })
    .category('common')
    .unlockFlag('momotalk_pink_unlocked')
    .build(),
  colorEquipment('base:equip:hoshino-swim-gear')
    .name('星野泳装装备').desc('夏日泳池的清凉套装，信用点获取 +2。')
    .colorGroup('base:group:hoshino-gradient')
    .effects({ op: 'addResource', target: Resource.Credit, value: 2 })
    .category('rare')
    .unlockProtoStat(Character.Hoshino)
    .build(),
  colorEquipment('base:equip:abydos-legacy')
    .name('阿比多斯传承').desc('阿比多斯学园的古老传承，信用点获取 +3。')
    .colorGroup('base:group:abydos-duotone')
    .effects({ op: 'addResource', target: Resource.Credit, value: 3 })
    .category('epic')
    .unlockProtoStat(Character.Hoshino, 2)
    .build(),
  colorEquipment('base:equip:prism-set')
    .name('棱镜套装').desc('多彩棱镜的抽象集合，信用点获取 +1。')
    .colorGroup('base:group:prism-pie')
    .effects({ op: 'addResource', target: Resource.Credit, value: 1 })
    .category('rare')
    .unlockProtoStat(Character.Mika)
    .build(),
  colorEquipment('base:equip:dawn-aura')
    .name('黎明之气').desc('破晓时分的暖色光晕，信用点获取 +2。')
    .colorGroup('base:group:radial-dawn')
    .effects({ op: 'addResource', target: Resource.Credit, value: 2 })
    .category('common')
    .unlockProtoStat(Character.Shiroko)
    .build(),
];

/** 卡池：常驻池（全体默认差分）+ 泳装 UP 池。 */
export const baseGachaPools: GachaPoolDef[] = [
  gachaPool('base:pool:regular')
    .name('常规招募')
    .desc('常驻开放的招募池。')
    .currency(Resource.Pyroxene)
    .costPerPull(120)
    .rate(CharacterRarity.Common, 79)
    .rate(CharacterRarity.Rare, 18)
    .rate(CharacterRarity.SuperRare, 3)
    .dupRewards(5, { [Resource.Credit]: 200 })
    .members(...baseCharacterVariants.filter(v => v.isDefault && v.id !== 'HoshinoSwimsuit').map(v => v.id))
    .build(),
  gachaPool('base:pool:swimsuit-up')
    .name('夏日限定 Pick Up')
    .desc('泳装星野概率提升！重复获得返还其专属碎片。')
    .currency(Resource.Pyroxene)
    .costPerPull(120)
    .rate(CharacterRarity.Common, 77)
    .rate(CharacterRarity.Rare, 18)
    .rate(CharacterRarity.SuperRare, 5)
    .featured('HoshinoSwimsuit')
    .pity(50)
    .dupRewards(10, { [Resource.Credit]: 500 })
    .members('HoshinoSwimsuit', 'Shiroko', 'Hoshino', 'Serika')
    .build(),
];

/** 聊天流内容：少量开场消息示范。 */
export const baseChatMessages: ChatMessageDef[] = [
  chatMessage('base:chat:arona-1', 'Arona').order(1).content('老师，欢迎回到什亭之匣！系统一切正常哦。').build(),
  chatMessage('base:chat:arona-2', 'Arona').order(2).content('有什么计划的话，随时叫我！').build(),
  chatMessage('base:chat:hoshino-1', 'Hoshino').order(1).content('唔……老师吗……好困……').build(),
  chatMessage('base:chat:hoshino-2', 'Hoshino').order(2)
    .content('下次一起去海边吧……嗯，说定了哦，队长。')
    .unlock({ target: 'protoStat', key: String(Character.Hoshino), comparator: '>=', value: 2 })
    .build(),
  chatMessage('base:chat:shiroko-1', 'Shiroko').order(1).content('老师，今天的行动方针呢？').build(),
];

/** 三层归属声明：收集类资产跨世界线保留，已读随世界线。 */
export const baseCharacterPersistConfig: CharacterPersistConfig = {
  roster: 'global',
  gacha: 'global',
  equips: 'global',
  chatRead: 'init',
};

// ============================================================
// 羁绊剧情（对话空间玩法）
//
// 羁绊剧情入口已并入 ActiveStoryEntry：入口点由消费侧决定——
// 聊天流 Talklet.kizuna 卡片引用（默认入口），或故事栏内容表引用。
// 卡片启动走 startCardStory（跳过场景/条件判定，但尊重单次完成态）。
// ============================================================

export const baseBondStoryEntries: ActiveStoryEntry[] = [
  activeStory('base:bond:hoshino_1')
    .owner('Hoshino')
    .build(),
  activeStory('base:bond:hoshino_evening')
    .owner('Hoshino')
    .build(),
];

export const baseBondStories: StoryDef[] = [
  story('base:bond:hoshino_1', '羁绊剧情 · 星野：午后的堤防')
    .scene(
      narrate('——阿比多斯 · 堤防 · 午后——', 'center'),
      line('星野', '唔……老师也来吹风吗……海风很舒服哦……'),
      line('老师', '（在她旁边坐下）', '（默默坐下）'),
      line('星野', '说起来……队长还记得第一次见面的时候吗？')
        .choice('当然记得，就在对策委员会室。', { op: 'setFlag', target: 'bond_hoshino_choice', value: 'committee' })
        .choice('抱歉……有点记不清了。', { op: 'setFlag', target: 'bond_hoshino_choice', value: 'forget' }),
      line('星野', '呵呵……没关系哦。反正以后的日子还长着呢，队长。')
        .effects({ op: 'setFlag', target: 'bond_hoshino_done', value: '1' }),
    )
    .build(),
  story('base:bond:hoshino_evening', '羁绊剧情 · 星野：傍晚的河堤')
    .scene(
      narrate('——阿比多斯 · 河堤 · 黄昏——', 'center'),
      line('星野', '……老师，其实我一直想找机会单独跟您聊聊。', '我也有话想跟你说。'),
      line('星野', '最近总觉得一个人发呆的时候，会想起很多以前的事。')
        .choice('回忆过去也很重要呢。', { op: 'setFlag', target: 'bond_evening_choice', value: 'memory' })
        .choice('那就多创造新的回忆吧。', { op: 'setFlag', target: 'bond_evening_choice', value: 'new' }),
      line('星野', '嗯……说得对。不管是过去的还是未来的，只要和老师一起，就都是好时光。')
        .effects({ op: 'setFlag', target: 'bond_evening_done', value: '1' }),
    )
    .build(),
];
