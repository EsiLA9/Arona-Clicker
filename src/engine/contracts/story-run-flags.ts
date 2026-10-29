/** 本次 Entry 播放携带的可保存值；条件只判断键存在，不比较值。 */
export type StoryFlagValue = string | number | boolean | null | readonly StoryFlagValue[] | { readonly [key: string]: StoryFlagValue };

/** 初始投入/快照使用 JSON 字典；播放器内部持有独立 Map。 */
export type StoryRunFlags = Readonly<Record<string, StoryFlagValue>>;
