/**
 * gen-engine-schema.mjs 的类型声明（供 vitest / tsc 消费 parseEngineSchema）
 */
import type { GenField, GenEntity } from '../tools/datapack-editor/schema/engine-defs';

export interface EngineSchemaParse {
  defMap: Record<string, { type: string; shape: 'array' | 'record' }>;
  defs: Record<string, GenEntity>;
  indexedTypes: string[];
}

export function parseEngineSchema(opts?: { dir?: string }): EngineSchemaParse & {
  generatedAt: string;
  sourceDir: string;
};

export type { GenField };
