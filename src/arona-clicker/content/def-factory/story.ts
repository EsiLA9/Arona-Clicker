import type { ExtraCompound } from '../../../engine/types/extra';
import type { InitId, StoryId } from '../../../engine/types/ids';
import type { AreaId } from '../../../engine/types/ids';
import type { VariantId } from '../../../engine/types/character';
import type { StoryDef } from '../../../data-services/contracts/story';
import type { StoryNode, StoryStageDeclaration, StoryStageId } from '../../../data-services/contracts/story-node';
import type { StoryStartContext } from '../../../data-services/contracts/story-node';

export class StoryBuilder {
  private readonly _id: StoryId;
  private readonly _name: string;
  private _nodes: readonly StoryNode[] = [];
  private _stages: Readonly<Record<StoryStageId, StoryStageDeclaration>> = {};
  private _startContext?: StoryStartContext;
  private _initId?: InitId;
  private _extra?: ExtraCompound;

  constructor(id: StoryId, name: string) { this._id = id; this._name = name; }

  /** Set the sole ordered execution list; entries are already explicit StoryNode declarations. */
  nodes(value: readonly StoryNode[]): this { this._nodes = value; return this; }

  /** Declare auto/input mode by stage ID; stage order comes only from nodes. */
  stages(value: Readonly<Record<StoryStageId, StoryStageDeclaration>>): this { this._stages = value; return this; }

  startInArea(areaId: AreaId): this { this._startContext = { type: 'area', areaId }; return this; }
  startInCharaspace(characterId: VariantId): this { this._startContext = { type: 'chara', characterId }; return this; }

  /** Group the Story in the authoring catalog. */
  init(value: InitId): this { this._initId = value; return this; }

  extra(value: ExtraCompound): this { this._extra = value; return this; }

  build(): StoryDef {
    if (!this._startContext) throw new Error(`StoryStartContextRequired:${this._id}`);
    return {
      id: this._id,
      name: this._name,
      ...(this._initId === undefined ? {} : { initId: this._initId }),
      startContext: this._startContext,
      nodes: [...this._nodes],
      stages: { ...this._stages },
      ...(this._extra ? { extra: this._extra } : {}),
    };
  }
}

export const story = (id: StoryId, name: string): StoryBuilder => new StoryBuilder(id, name);
