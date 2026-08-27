# docs-824 — 07 图片资产（PicDef）存储与索引

> 本文回答：**图片怎么存、怎么索引用、怎么解析给聊天流背景 / 聊天流发送图片 / 头像用。**
> 涉及代码：`src/engine/types/pics.ts`、`src/engine/image/`、`src/engine/registry/registry.ts`、`src/data/zip-loader.ts`、`src/engine/game-instance.ts`。

## 1. 索引格式（唯一寻址）

图片用 **三段式索引** 引用，格式：

```text
modName : typeName(pic) : idName
```

- `modName` — 数据包 mod 名（对应 `datapack.name`，如 `base` / `modA`）
- `typeName` — 图片用途类别，字面带 `(pic)` 标记（如 `avatar` / `background` / `sticker` / `card` / `icon` / `banner`，类别开放，mod 可自定）
- `idName` — 类别内唯一 id

示例：`base:avatar(pic):hoshino`、`modA:background(pic):schale_office`、`base:sticker(pic):party_hat`。

解析函数见 `src/engine/types/pics.ts`：`parsePicId` / `buildPicId` / `isPicRef`。

## 2. 声明（PicDef）与来源

图片在数据包的 `pics` 表声明：

```ts
export interface PicDef {
  id: PicId;   // 'mod:type(pic):id'
  src: string; // 直连 URL，或 'zip:包内相对路径'
  label?: string;
}
```

`src` 两种来源：

| 来源 | 写法 | 解析结果 |
| --- | --- | --- |
| 直连 URL / 相对路径 | `https://…` / `data:` / `/assets/x.png` | 原样使用 |
| Mod 压缩包内图片 | `zip:assets/avatar/hoshino.png` | 经 ImageStore 取解出后的本地 data URL |

> 兼容旧写法：`Talklet.avatar` / `CharacterVariantDef.avatar` 直接填 URL 仍可用，
> 引擎解析时对"非三段式索引"一律原样透传，不破坏现有数据。

## 3. 存储与生命周期

```text
Mod 压缩包（.zip）
   ├─ *.json ──→ Datapack（含 pics 表）
   └─ *.png/*.jpg/… ──→ ZipLoadResult.images [{path, url(dataURL)}]
                              │ registerImages(mod, images)
                              ▼
                    ImageStore（mod + 包内路径 → URL）
```

- **`ImageStore`**（`src/engine/image/image-store.ts`）：纯逻辑层，键 = `modName + 包内相对路径`，值 = 可显示 URL（data: / blob:）。只做登记与查询，不碰 DOM。
- **`zip-loader`** 现在会提取 png/jpg/gif/webp/svg/apng/avif/bmp/ico 为 data URL 返回，不再计入 ignoredCount。
- **UI 导入流程**（`src/ui/import-export.ts`）：`game.imageStore.clear()` → `game.registerImages(datapack.name, images)` → `game.reload([datapack])`。
- 切换 Mod / 新会话时由调用方负责 `imageStore.clear()`（引擎不在 init/reload 内隐式清空，避免误伤运行时引用）。

## 4. 解析（消费端唯一入口）

```ts
// GameInstance
game.getPicUrl(ref: string | undefined): string | undefined
game.getPicDef(ref: string): PicDef | undefined
game.registerImages(mod: string, entries: ResolvedImageEntry[]): void
```

`getPicUrl` 解析规则（`src/engine/image/resolve.ts`）：

1. **只接受 `mod:type(pic):id` 三段式 PicId**；直连 URL / 任意字符串 → `undefined`（def 层一律只持 PicId，裸 URL 唯一的存放点是 `PicDef.src`）；
2. 查 `registry.pics`：
   - `src` 直连 → 返回该 URL；
   - `src` 为 `zip:path` → `imageStore.get(mod, path)`；
   - pics 表无此 id → `undefined`。

返回 `undefined` 表示"无图"，UI 回退到首字母圆形占位（头像）或空背景。

## 4b. Chara 头像-人名对（characterProfile 便捷接口）

`GameInstance.characterProfile(character, overrides?)` → `CharaProfile`（name + 已解析 avatar URL + 溯源）。

- **chara 声明层**：`CharaProfileDef` 表（datapack 的 `charaProfiles`）——每个原型持 name 表 + avatar 表 + 当前使用 id；`activeName`/`activeAvatar` 缺省取表首项。
- **玩家覆写层**：`game.setCharaProfile(char, { nameId?/avatarId?/name?/avatar? })` → `PlayerState.charaCustom`（随存档持久化，经 StateMutationService 单一写入口）。
- **调用点覆写层**：`overrides.{name?, avatar?}` 本次临时生效，优先级最高、不落盘。
- 解析优先级：`兜底(proto) → declared(表 active) → player(charaCustom) → override(调用点)`。
- `charaNames(char)` / `charaAvatars(char)` 供「改名/换头像」面板做选择器。
- 校验：name 表至少一条、active* 必须在表内、avatar.pic 必须为 PicId（持有裸 URL 直接 RegistryError）。

## 5. 三个消费场景

| 场景 | 现状 | 消费方式 |
| --- | --- | --- |
| **头像** | ✅ 已接线 | `Talklet.avatar` / `CharacterVariantDef.avatar` 只填 PicId，UI 渲染时 `ctx.game.getPicUrl(...)` 解析（`story.ts` `renderAvatar`、`contacts.ts`）。快捷取值用 `game.characterProfile(char)`。 |
| **聊天流发送图片** | ✅ 已接线 | `Talklet.image` 只填 PicId，聊天流经 `getPicUrl` 渲染（`base:story:hoshino_selfie` 演示）。 |
| **聊天流背景** | 预留 | 背景声明加 `background(pic)` 类索引字段，主题切换或进入场景时用 `getPicUrl` 解析成 CSS background-image。 |

扩展原则：新增任何图片消费点只需"声明一个 PicDef + 字段里填 PicId + 渲染时调 `getPicUrl`"，引擎与 UI 都无需感知图片来源（URL 或 zip）。

## 6. Schema / 协议同步

- `pics` 与 `charaProfiles` 都是 `Datapack` 的数组字段，`npm run gen:schema` 自动产出 `PicDef` / `CharaProfileDef` 表；
- editor 侧 `tools/datapack-editor/schema/`：`TableKey` 与 `TABLE_META` 已登记 `pics` / `charaProfiles` 表（idFormat 走 free，因三段式含 `(pic)` 标记，不满足 editor 的 `pack:kind:name` 校验）；
- `engine-schema.sync.test.ts` 三向一致兜底。
