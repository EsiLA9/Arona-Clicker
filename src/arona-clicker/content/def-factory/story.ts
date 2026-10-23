import type { ExtraCompound } from '../../../engine/types/extra';
import type { StoryId } from '../../../engine/types/ids';
import type { StoryDef } from '../../../data-services/contracts/story';
import type { StoryNode, StoryStageDeclaration, StoryStageId } from '../../../data-services/contracts/story-node';

export class StoryBuilder {
  private readonly _id: StoryId;
  private readonly _name: string;
  private _nodes: readonly StoryNode[] = [];
  private _stages: Readonly<Record<StoryStageId, StoryStageDeclaration>> = {};
  private _extra?: ExtraCompound;

  constructor(id: StoryId, name: string) { this._id = id; this._name = name; }

  /** Set the sole ordered execution list; entries are already explicit StoryNode declarations. */
  nodes(value: readonly StoryNode[]): this { this._nodes = value; return this; }

  /** Declare auto/input mode by stage ID; stage order comes only from nodes. */
  stages(value: Readonly<Record<StoryStageId, StoryStageDeclaration>>): this { this._stages = value; return this; }

  extra(value: ExtraCompound): this { this._extra = value; return this; }

  build(): StoryDef {
    return {
      id: this._id,
      name: this._name,
      nodes: [...this._nodes],
      stages: { ...this._stages },
      ...(this._extra ? { extra: this._extra } : {}),
    };
  }
}

export const story = (id: StoryId, name: string): StoryBuilder => new StoryBuilder(id, name);
