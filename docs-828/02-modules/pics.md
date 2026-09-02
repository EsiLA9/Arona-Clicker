# 02-modules/pics — 图片资产（PicDef / ImageStore / CharaProfile）

> 一句话：图片用三段式索引 `mod:type(pic):id` 寻址；`ImageStore` 登记 zip 解出的图，`resolvePicSrc` 是消费端唯一解析入口。

## 职责边界

- **管**：图片索引格式、登记与解析、chara 头像-人名对（charaProfile）。
- **不管**：图片渲染（UI 拿 URL 自行渲染）、zip 解包（`src/data-services/datapack/zip-loader.ts`）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `types/pics.ts` | `PicDef` / 三段式解析（`parsePicId` / `buildPicId` / `isPicRef`） |
| `image/image-store.ts` | `ImageStore`：纯逻辑层登记（键 = `mod + 包内相对路径` → 可显示 URL），不碰 DOM |
| `image/resolve.ts` | `resolvePicSrc`：只接受三段式 PicId → 查 `registry.pics` → 直连 URL 或 `zip:path` 经 ImageStore；非三段式 → `undefined` |
| `system/pic-service.ts` | `PicService`（子门面 `game.pics`）：`urlOf` / `defOf` / `register` |
| `system/chara-profile-service.ts` | `CharaProfileService`（子门面 `game.charaProfiles`）：`characterProfile(char, overrides?)` 四层优先级解析（兜底 proto → 声明表 active → 玩家 charaCustom → 调用点覆写）；改名/换头像选择器 |

## 核心概念

- **索引格式**：`modName : typeName(pic) : idName`（typeName 类别开放：avatar/background/sticker/card/icon/banner…），示例 `base:avatar(pic):hoshino`。
- **裸 URL 唯一存放点是 `PicDef.src`**；Def 字段（`Talklet.avatar` 等）只填 PicId；解析失败回退首字母占位。
- **生命周期**：`zip-loader` 解出图片 → `game.pics.register(mod, images)` → 查 `registry.pics` 解析；切 Mod 由调用方 `clear()`。
- **CharaProfile**：`CharaProfileDef` 表（name 表 + avatar 表 + active 指针）+ `state.charaCustom` 玩家覆写（经单一写入口持久化）；校验严格（avatar.pic 持裸 URL 直接 RegistryError）。

## 测试入口

`tests/engine/pics.test.ts`、`tests/engine/avatar-renderer.test.ts`、`tests/engine/character-profile.test.ts`

## 相关文档

[[docs-828/03-data-structures/declarative-dsl]] · [[docs-828/05-conventions/schema-sync]]（pics/charaProfiles 表已进编辑器）
