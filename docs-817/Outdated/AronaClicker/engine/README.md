# Engine Docs

## Purpose

This folder describes the runtime-side foundation we should settle before building the main game engine:

- how a `Datapack` is loaded
- how multiple datapacks coexist in one runtime
- how templates can reference templates from other datapacks safely
- how to stay compatible with the current editor export model

The current repository already contains useful building blocks:

- `src/core/Datapack.ts`
- `src/core/Template.ts`
- `src/editor/EditorTemplateRepository.ts`
- `src/editor/EditorSubDemo.ts`

The core runtime already has:

- `DatapackMetadata.dependencies`
- `Datapack`
- `TemplateArchive`
- `TemplateRef`

The editor side already has:

- `mod:type:id` style reference strings
- local and external navigator stores
- bundle export/import flow

So the next step is not to invent a brand new format. It is to define a clean bridge from editor bundle data into runtime objects.

## Target Architecture

We should build the engine datapack pipeline around five roles:

1. `DatapackSource`
   Reads raw bundle/json input and exposes manifest + template payloads.

2. `DatapackLoader`
   Parses files, validates metadata, and creates in-memory package descriptors.

3. `DatapackRegistry`
   Holds every loaded datapack, dependency graph, and the global template index.

4. `TemplateResolver`
   Resolves `mod:type:id` links into `TemplateRef` objects after all raw templates are registered.

5. `CompatibilityLayer`
   Normalizes legacy ids, type aliases, and shorthand references so old editor data can still load.

## Doc Index

- [Datapack Loading](01-datapack-loading.md)
- [Multi-Datapack Relations](02-multi-datapack-relations.md)
- [Implementation Roadmap](03-implementation-roadmap.md)

## Recommended Design Direction

The recommended rule set is:

- canonical template id format is always `modId:type:id`
- references may be authored in compact forms, but must be normalized during load
- cross-pack references are only valid when the target pack is the same pack or a declared dependency
- duplicate full ids are fatal unless an explicit extension/patch mechanism is used
- direct overwrite of another datapack's template should not be the default compatibility strategy

This gives us a stable runtime key space and keeps multi-datapack behavior debuggable.
