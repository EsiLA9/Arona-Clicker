import type { ChatTextKind, ChatTextStyle } from '../../engine/contracts/chat-presentation';
import type { ExtraPath, ExtraValue } from '../../engine/types/extra';
import type {
  Character,
  EnhancementId,
  InitId,
  ItemId,
  StoryEntryId,
  StoryId,
  SpotId,
  AreaId,
} from '../../engine/types/ids';
import type { VariantId } from '../../engine/types/character';
import type {
  EntityPresentationOverrideLifetime,
  ThemeEffectValue,
  ValueExpression,
} from '../../engine/types/expression';
import type { EntityPresentationKey } from './entity-presentation';
import type { StoryContent, StoryPresentation } from './story-node';

/** 可由数值表达式结算的作者数值参数；一组状态动作仍作为有序批次声明。 */
export type StoryNumericValue = number | ValueExpression;

/** 实体主题必须明确对象；临时演出主题不依赖实体槽。 */
export type StoryThemeValue = Omit<ThemeEffectValue, 'scope' | 'entityKey'> & (
  | { readonly scope?: 'ephemeral'; readonly entityKey?: never }
  | { readonly scope: 'area'; readonly entityKey: `area:${string}` }
  | { readonly scope: 'student'; readonly entityKey: `variant:${string}` }
);

/**
 * Story Operation 可执行的持久状态动作。
 * 每个分支只声明自己的命名参数；不暴露旧 Effect 的通用 target/value 外壳。
 */
export type StoryStateAction =
  /** 设置指定资源数值。 */
  | { readonly op: 'setResource'; readonly resourceId: string; readonly amount: StoryNumericValue }
  /** 增加指定资源数值。 */
  | { readonly op: 'addResource'; readonly resourceId: string; readonly amount: StoryNumericValue }
  /** 设置指定设施等级。 */
  | { readonly op: 'setSpotLevel'; readonly spotId: SpotId; readonly amount: StoryNumericValue }
  /** 增加指定设施等级。 */
  | { readonly op: 'addSpotLevel'; readonly spotId: SpotId; readonly amount: StoryNumericValue }
  /** 为指定设施设定经理角色。 */
  | { readonly op: 'setManager'; readonly spotId: SpotId; readonly managerId: Character }
  /** 获得指定强化。 */
  | { readonly op: 'addEnhancement'; readonly enhancementId: EnhancementId }
  /** 获得指定数量物品。 */
  | { readonly op: 'addItem'; readonly itemId: ItemId; readonly amount: StoryNumericValue }
  /** 解锁指定世界线。 */
  | { readonly op: 'unlockInit'; readonly initId: InitId }
  /** 写入 flag；旧执行会把数字表达式结算结果转成字符串。 */
  | {
      readonly op: 'setFlag';
      readonly flagId: string;
      readonly value: string | number | boolean | ValueExpression;
    }
  /** 写入全局 Extra；复合值保持 ExtraValue，字面量会按 Extra 节点构造。 */
  | {
      readonly op: 'setExtra';
      readonly path: ExtraPath;
      readonly value: ExtraValue | number | string | boolean | ValueExpression;
    }
  /** 累加整数或浮点 Extra 节点。 */
  | {
      readonly op: 'addExtra';
      /** 要累加的 Extra 节点路径。 */
      readonly path: ExtraPath;
      /** 只对整数与浮点 Extra 有效的增量。 */
      readonly amount: StoryNumericValue;
    }
  /** 删除指定 Extra 节点；节点不存在时无效果。 */
  | {
      readonly op: 'removeExtra';
      /** 要删除的 Extra 节点路径；节点不存在时无效果。 */
      readonly path: ExtraPath;
    }
  /** 获得指定角色差分；重复获得按角色域规则处理。 */
  | {
      readonly op: 'grantCharacter';
      /** 要获得的角色差分身份。 */
      readonly variantId: VariantId;
    }
  /** 增加指定角色差分的好感经验。 */
  | {
      readonly op: 'addAffectionExp';
      /** 要增加好感的角色差分身份。 */
      readonly variantId: VariantId;
      /** 好感经验增量。 */
      readonly amount: StoryNumericValue;
    };

/**
 * 入口请求来源。卡片是面向主动 Entry 的邀请；普通请求和系统请求可指向任一类型。
 * entryType 是请求合同的一部分；未来引用校验应核对目标 Entry 的实际类型。
 */
export type StoryEntryRequest =
  | {
      readonly entryId: StoryEntryId;
      readonly entryType: 'active';
      /** null 明确表示全局游标；字符串表示对应角色的聊天游标。 */
      readonly owner: string | null;
      readonly intent: 'ordinary' | 'system';
    }
  | {
      readonly entryId: StoryEntryId;
      readonly entryType: 'active';
      readonly owner: string | null;
      readonly intent: 'card';
    }
  | {
      readonly entryId: StoryEntryId;
      readonly entryType: 'passive';
      readonly owner: string | null;
      readonly intent: 'ordinary' | 'system';
    };

/**
 * 入口邀请卡的显示内容和请求意图。
 * request 的类型约束保证卡片只引用 active Entry；具体启动/资格策略由宿主另行定义。
 */
export interface StoryEntryCard {
  readonly request: Extract<StoryEntryRequest, { readonly intent: 'card' }>;
  readonly title?: string;
  readonly buttonText?: string;
  readonly align?: 'left' | 'right';
}

/** 普通定位文本模板；羁绊入口卡使用独立的 entryCard 内容分支。 */
export type StoryOverlayTextTemplate = Exclude<ChatTextKind, 'kizuna'>;

/** 覆盖层内的有限显示内容，不携带递归的节点、动作或转移。 */
export type StoryOverlayContent =
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly template?: StoryOverlayTextTemplate;
      readonly style?: ChatTextStyle;
    }
  | {
      readonly kind: 'message';
      readonly content: StoryContent;
      readonly presentation?: StoryPresentation;
      readonly style?: ChatTextStyle;
    }
  | { readonly kind: 'entryCard'; readonly card: StoryEntryCard };

/** 聊天窗格中的临时覆盖层命令。 */
export type StoryOverlayCommand =
  | {
      readonly command: 'show';
      /** 临时内容 ID，供 clearId 对应清理。 */
      readonly id: string;
      /** 归一化聊天窗格坐标；当前渲染器以左下角为原点。 */
      readonly x?: number;
      readonly y?: number;
      readonly align?: 'left' | 'center' | 'right';
      readonly content: StoryOverlayContent;
    }
  | {
      readonly command: 'clearId';
      /** 要清除的临时覆盖层身份。 */
      readonly id: string;
    }
  /** 清除全部演出覆盖层，保留聊天历史。 */
  | { readonly command: 'clearAllTexts' }
  /** 清除当前聊天流内容；不声明跨游标的定向清理能力。 */
  | { readonly command: 'clearFlow' };

/**
 * 主题、实体临时表现与开幕标题动作。
 * ThemeEffectValue 保留色组、色板、token、语义节点、背景、scope 和 entityKey。
 */
export type StoryPresentationCommand =
  | {
      readonly command: 'theme';
      /** 保留主题复合参数，并按 scope 明确实体槽。 */
      readonly value: StoryThemeValue;
    }
  | {
      readonly command: 'setEntityPresentation';
      readonly target: EntityPresentationKey;
      readonly optionId: string;
      readonly owner: string;
      readonly lifetime?: EntityPresentationOverrideLifetime;
    }
  | {
      readonly command: 'clearEntityPresentation';
      readonly target: EntityPresentationKey;
      readonly owner: string;
    }
  /** title 省略或为空时由宿主采用 Entry 标题或 Story 名作为来源。 */
  | {
      readonly command: 'openingTitle';
      /** 非空时覆盖来源标题；省略或空值表示使用来源默认标题。 */
      readonly title?: string;
    };

/**
 * Story 行为载荷。state 保留一次顺序动作批次；入口请求本身不表示当前来源链终止。
 */
export type StoryAction =
  | { readonly kind: 'state'; readonly effects: readonly StoryStateAction[] }
  | { readonly kind: 'travel'; readonly areaId: AreaId; readonly notice?: boolean }
  | { readonly kind: 'overlay'; readonly command: StoryOverlayCommand }
  | { readonly kind: 'presentation'; readonly command: StoryPresentationCommand }
  | { readonly kind: 'entryRequest'; readonly request: StoryEntryRequest };

/** StoryDef 之间的有限控制转移；insert 返回调用处后继，goto 不新增返回点。 */
export interface StoryTransfer {
  readonly mode: 'goto' | 'insert';
  readonly storyId: StoryId;
}
