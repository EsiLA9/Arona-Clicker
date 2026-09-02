/** Effect 机制在需要嵌入演出片段时消费的最小结构。 */
export interface EngineTalklet {
  /** 领域演出载荷可附带自身字段；引擎只解释下列最小字段。 */
  readonly [key: string]: unknown;
  text: string;
  speaker?: string;
  avatar?: string;
  image?: string;
}
