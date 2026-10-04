import { ENTITY_TYPES, parseEntityId } from '../../engine/core/entity-id';
import { parseTagRef } from '../../engine/core/tag';
import {
  buildAuthoringDef,
  getContentPolicy,
  validateAuthoringInput,
  type AuthoringValidationContext,
} from '../../data-services/authoring/content-policy';
import { validateDatapack } from '../../data-services/registry/registry-validate';
import {
  jsonArchiveEntry,
  type ArchivePlan,
  type ArchiveWriter,
  ZipArchiveWriter,
} from '../../data-services/archive/archive-writer';
import type { Datapack } from '../../data-services/contracts/datapack';
import type { AreaDef, InitDef, SpotDef } from '../../data-services/contracts/world';
import type { EnhancementDef } from '../../data-services/contracts/enhancement';
import type { PackManifest } from '../../data-services/datapack/manifest';
import {
  runtimeEditorDefinitionSuspensions,
  runtimeEditorDefinitions,
  type RuntimeDatapackEditorState,
  type RuntimeEditorContentKind,
  type RuntimeEditorDefinitionDraft,
  type RuntimeEditorSpotDraft,
} from './state';

const EXPORTABLE_CONTENT_KINDS: readonly RuntimeEditorContentKind[] = ['inits', 'areas', 'spots', 'enhancements'];

export interface RuntimeEditorPackExportContext extends AuthoringValidationContext {
  readonly initIds?: ReadonlySet<string>;
  readonly areaIds?: ReadonlySet<string>;
  /** 编辑态数据包的原始完整内容；编辑器只覆盖可编辑四类，其余表原样保留。 */
  readonly sourceDatapack?: Datapack;
  /** 重导出时保留原包的显示颜色。 */
  readonly sourceManifest?: Pick<PackManifest, 'color'>;
}

export interface RuntimeEditorPackExportDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface RuntimeEditorPackArchive {
  readonly plan: ArchivePlan;
  readonly manifest: PackManifest;
  readonly datapack: Datapack;
  readonly filename: string;
  readonly counts: Readonly<Record<string, number>>;
}

export type RuntimeEditorPackExportResult =
  | { readonly ok: true; readonly archive: RuntimeEditorPackArchive }
  | { readonly ok: false; readonly diagnostics: readonly RuntimeEditorPackExportDiagnostic[] };

export function compileRuntimeEditorPack(
  editor: RuntimeDatapackEditorState,
  context: RuntimeEditorPackExportContext = {},
): RuntimeEditorPackExportResult {
  const diagnostics: RuntimeEditorPackExportDiagnostic[] = [];
  if (!/^[a-z0-9-]+$/.test(editor.modName)) {
    diagnostics.push({ code: 'invalid-mod-name', path: 'modName', message: 'modName 只能包含小写字母、数字和连字符。' });
  }
  if (!editor.displayName.trim()) {
    diagnostics.push({ code: 'invalid-field', path: 'displayName', message: 'Mod 显示名称不能为空。' });
  }
  if (!editor.version.trim()) {
    diagnostics.push({ code: 'invalid-field', path: 'version', message: 'Mod 版本不能为空。' });
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const compiled: Record<RuntimeEditorContentKind, unknown[]> = {
    inits: [],
    areas: [],
    spots: [],
    enhancements: [],
  };
  for (const kind of EXPORTABLE_CONTENT_KINDS) {
    const policy = getContentPolicy(kind);
    if (!policy) continue;
    const suspended = new Set(runtimeEditorDefinitionSuspensions(editor, kind));
    for (const definition of runtimeEditorDefinitions(editor, kind)) {
      if (suspended.has(definition.idName)) continue;
      const path = kind + '.' + definition.idName;
      if (kind === 'spots') {
        const spot = definition as RuntimeEditorSpotDraft;
        if (spot.unsupportedFunctionalityIds?.length) {
          diagnostics.push({
            code: 'unsupported-round-trip',
            path: path + '.functionalities',
            message: 'Spot 含无法无损导出的资源功能：' + spot.unsupportedFunctionalityIds.join('、'),
          });
          continue;
        }
        if (spot.unsupportedPaymentOptionPaths?.length) {
          diagnostics.push({
            code: 'unsupported-round-trip',
            path: path + '.purchaseOptions',
            message: 'Spot 含无法无损导出的支付方案：' + spot.unsupportedPaymentOptionPaths.join('、'),
          });
          continue;
        }
      }
      const input = authoringInput(policy, definition);
      const problem = validateAuthoringInput(policy, input, context);
      if (problem) {
        diagnostics.push({ code: problem.code, path: problem.path ?? path, message: problem.message });
        continue;
      }
      try {
        compiled[kind].push(buildAuthoringDef(policy, editor.modName, input));
      } catch (error) {
        diagnostics.push({
          code: 'invalid-content',
          path,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const datapack: Datapack = {
    ...(context.sourceDatapack ? structuredClone(context.sourceDatapack) : {}),
    modName: editor.modName,
    name: editor.displayName,
    version: editor.version,
    inits: compiled.inits as InitDef[],
    areas: compiled.areas as AreaDef[],
    spots: compiled.spots as SpotDef[],
    enhancements: compiled.enhancements as EnhancementDef[],
    activeStories: context.sourceDatapack?.activeStories ? structuredClone(context.sourceDatapack.activeStories) : [],
    passiveStories: context.sourceDatapack?.passiveStories ? structuredClone(context.sourceDatapack.passiveStories) : [],
    stories: context.sourceDatapack?.stories ? structuredClone(context.sourceDatapack.stories) : [],
    items: context.sourceDatapack?.items ? structuredClone(context.sourceDatapack.items) : [],
    funcletDefs: context.sourceDatapack?.funcletDefs ? structuredClone(context.sourceDatapack.funcletDefs) : [],
    characters: context.sourceDatapack?.characters ? structuredClone(context.sourceDatapack.characters) : [],
  };
  try {
    validateDatapack(datapack, {
      initIds: context.initIds,
      areaIds: context.areaIds,
    });
  } catch (error) {
    diagnostics.push({
      code: 'invalid-pack',
      path: 'datapack',
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const dependencies = [...collectDependencyModNames(datapack)]
    .filter(modName => modName !== editor.modName)
    .sort((left, right) => left.localeCompare(right, 'en'));
  const manifest: PackManifest = {
    modName: editor.modName,
    name: editor.displayName,
    version: editor.version,
    ...(editor.author.trim() ? { author: editor.author.trim() } : {}),
    ...(context.sourceManifest?.color ? { color: context.sourceManifest.color } : {}),
    dependencies,
  };
  const planEntries = [
    jsonArchiveEntry('datapack.json', manifest),
    jsonArchiveEntry('data/00-meta.json', { name: editor.displayName, version: editor.version }),
  ];
  for (const entry of DATAPACK_LIST_ARCHIVE_ENTRIES) {
    const value = datapack[entry.field];
    if (Array.isArray(value) && value.length > 0) {
      planEntries.push(jsonArchiveEntry(entry.path, { [entry.field]: value }));
    }
  }
  const singletonValues: Record<string, unknown> = {};
  for (const field of DATAPACK_SINGLETON_FIELDS) {
    const value = datapack[field];
    if (value !== undefined) singletonValues[field] = value;
  }
  if (Object.keys(singletonValues).length > 0) planEntries.push(jsonArchiveEntry('data/80-singletons.json', singletonValues));

  const counts: Record<string, number> = {};
  for (const field of DATAPACK_LIST_FIELDS) {
    const value = datapack[field];
    if (Array.isArray(value) && value.length > 0) counts[field] = value.length;
  }

  return {
    ok: true,
    archive: {
      plan: { entries: planEntries },
      manifest,
      datapack,
      filename: safeFilePart(editor.modName) + '-' + safeFilePart(editor.version) + '.zip',
      counts,
    },
  };
}

const DATAPACK_LIST_ARCHIVE_ENTRIES: ReadonlyArray<{ readonly field: DatapackListField; readonly path: string }> = [
  { field: 'inits', path: 'data/10-inits.json' },
  { field: 'areas', path: 'data/20-areas.json' },
  { field: 'spots', path: 'data/30-spots.json' },
  { field: 'enhancements', path: 'data/40-enhancements.json' },
  { field: 'activeStories', path: 'data/50-active-stories.json' },
  { field: 'passiveStories', path: 'data/51-passive-stories.json' },
  { field: 'stories', path: 'data/52-stories.json' },
  { field: 'items', path: 'data/53-items.json' },
  { field: 'dropTables', path: 'data/54-drop-tables.json' },
  { field: 'affectorPacks', path: 'data/55-affector-packs.json' },
  { field: 'triggerDefs', path: 'data/56-trigger-defs.json' },
  { field: 'funcletDefs', path: 'data/57-funclet-defs.json' },
  { field: 'characters', path: 'data/58-characters.json' },
  { field: 'resourceDisplays', path: 'data/59-resource-displays.json' },
  { field: 'pics', path: 'data/60-pics.json' },
  { field: 'charaProfiles', path: 'data/61-chara-profiles.json' },
  { field: 'passivePools', path: 'data/62-passive-pools.json' },
  { field: 'characterVariants', path: 'data/63-character-variants.json' },
  { field: 'cultivateCurves', path: 'data/64-cultivate-curves.json' },
  { field: 'favoriteItems', path: 'data/65-favorite-items.json' },
  { field: 'uniqueWeapons', path: 'data/66-unique-weapons.json' },
  { field: 'traits', path: 'data/67-traits.json' },
  { field: 'gears', path: 'data/68-gears.json' },
  { field: 'colorGroups', path: 'data/69-color-groups.json' },
  { field: 'colorEquipments', path: 'data/70-color-equipments.json' },
  { field: 'themeDesigns', path: 'data/71-theme-designs.json' },
  { field: 'gachaPools', path: 'data/72-gacha-pools.json' },
  { field: 'shops', path: 'data/73-shops.json' },
  { field: 'tags', path: 'data/74-tags.json' },
];

const DATAPACK_LIST_FIELDS = DATAPACK_LIST_ARCHIVE_ENTRIES.map(entry => entry.field) as readonly DatapackListField[];
const DATAPACK_SINGLETON_FIELDS = ['gearConfig', 'characterPersistConfig', 'affectionConfig', 'extras'] as const;
type DatapackListField =
  | 'inits' | 'areas' | 'spots' | 'enhancements' | 'activeStories' | 'passiveStories' | 'stories'
  | 'items' | 'dropTables' | 'affectorPacks' | 'triggerDefs' | 'funcletDefs' | 'characters'
  | 'resourceDisplays' | 'pics' | 'charaProfiles' | 'passivePools' | 'characterVariants'
  | 'cultivateCurves' | 'favoriteItems' | 'uniqueWeapons' | 'traits' | 'gears' | 'colorGroups'
  | 'colorEquipments' | 'themeDesigns' | 'gachaPools' | 'shops' | 'tags';

export async function writeRuntimeEditorPack(
  archive: RuntimeEditorPackArchive,
  writer: ArchiveWriter = new ZipArchiveWriter(),
): Promise<Uint8Array> {
  return writer.write(archive.plan);
}

function authoringInput(policy: NonNullable<ReturnType<typeof getContentPolicy>>, definition: RuntimeEditorDefinitionDraft): Record<string, unknown> {
  const raw = definition as unknown as Record<string, unknown>;
  const input: Record<string, unknown> = {};
  for (const field of policy.fields) {
    if (raw[field.key] !== undefined) input[field.key] = raw[field.key];
  }
  for (const extension of policy.extensions ?? []) {
    if (raw[extension.inputKey] !== undefined) input[extension.inputKey] = raw[extension.inputKey];
  }
  return input;
}

function collectDependencyModNames(value: unknown): Set<string> {
  const dependencies = new Set<string>();
  const visit = (current: unknown): void => {
    if (typeof current === 'string') {
      const entity = parseEntityId(current);
      if (entity && ENTITY_TYPES.has(entity.type)) dependencies.add(entity.mod);
      const tag = parseTagRef(current);
      if (tag) dependencies.add(tag.modName);
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }
    if (current && typeof current === 'object') {
      for (const item of Object.values(current)) visit(item);
    }
  };
  visit(value);
  return dependencies;
}

function safeFilePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'runtime-mod';
}
