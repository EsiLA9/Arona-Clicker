# Task 0433 · 编辑器模态窗统一工作台外观

状态：待审核
建议执行者：Luna

## 目标

让 Story / Entry 编辑弹窗和 Runtime 编辑子窗采用高级编辑器三栏的顶部密度、间距和主题色。确认窗随内容收高，表单保持可读，目录、条件树和引用选择保留可独立滚动的工作区域。范围限于游戏内编辑器弹窗。通用游戏弹窗、主题编辑器拖动窗、顶部锚定浮层、Runtime 非模态主面板和独立 Datapack Editor 不纳入迁移。

## 当前依据

- `src/ui/css/editor-workspace.css` 的 Advanced 栏框采用 5px 圆角，顶部工具带使用 `panel-light`。`src/ui/css/variables.css` 提供 `--panel-content-padding`（14px）和 `--panel-region-gap`（8px）。`src/ui/controller/controller-theme.ts` 在根节点投影主题变量，挂在 `body` 的弹窗可读取这些变量。
- `src/ui/interaction/modal.ts` 的 `renderModalShell` 提供遮罩、标题、正文和可选底部动作区。`src/ui/css/modal.css` 默认使用 16px 圆角、重阴影、18px 标题和 24px 正文留白。Story 的复杂窗由 `src/ui/story-editor/editor-dialog.ts` 的 `openStoryEditorDialog` 打开，绑定显式关闭与触发控件焦点恢复。改 ID、激活配置、选择所属 Mod、Flag 导入、删除和重置草稿等仍直接调用 `modal.open`。活跃编辑态包选择另走 `src/ui/components/shared/active-editing-pack-picker.ts`。
- `src/ui/runtime-editor/subdialog.ts` 的 `openSubDialog` 自带同样的四个区域，并支持 `push`、`replace` 和恢复父窗 DOM。`src/ui/css/runtime-editor.css` 为子窗写死白底蓝灰配色和 12px 圆角。`src/ui/runtime-editor/actions.ts` 中的 `openRuntimeSpotDeleteConfirm`、`openRuntimeDefinitionDeleteConfirm` 还使用 `runtime-datapack-modal`，该样式会让预期窄窗的删除确认占满可用高度。

## 施工顺序

1. **先建立共用外观。** 为 `ModalOptions` / `renderModalShell` 增加显式编辑器外观选项（建议 `appearance: 'editor'`），在现有遮罩、面板、标题、正文和底部节点上增加可复用的编辑器样式钩子。在共用样式入口集中定义：5px 外框圆角、细边框、减轻的遮罩及阴影、约 36px 单行标题栏、固定宽度关闭按钮、14px 横向对齐和 8px 组内间距。标题能换行撑高。正文用 `panel`，窗头用 `panel-light`，文字取对应 `ink-on-*`，强调色用于选中和焦点，危险动作使用共享危险变体。密度先用真实长标题和按钮文案校准。
2. **迁移 Story / Entry。** 给 `openStoryEditorDialog`、编辑器里的直接 `modal.open` 调用和活跃编辑态包选择接入该外观。以删除／重置草稿、身份／卡片渐变、目录／条件树各走一遍。保留 `story-catalog-dialog`、`story-condition-dialog` 等业务 class，保留现有双栏与内部滚动，清理与共用外壳冲突的间距覆盖。通过样式区分内容高度的确认／表单窗和占用较大工作区域的工具窗，底部动作留在正文滚动区之外。
3. **迁移 Runtime 子窗和删除确认。** 给 `openSubDialog` 的既有节点接入同一组外观钩子，将 `runtime-subdialog-*` 留给已有事件绑定、尺寸特例与滚动定位。子窗内仍依赖 `--re-*` 的表单把颜色映射到对应主题角色，校验输入背景、提示文字和禁用态。两处删除确认改用紧凑编辑器外壳，移除使窗体撑满高度的 `runtime-datapack-modal` 依赖。保留 Runtime 子窗栈的层级、关闭语义及父窗恢复流程。
4. **核对 DOM 与更新边界。** 复用现有 `遮罩 → 面板 → 标题 / 正文 / 可选底部` 结构，预期不加布局包装和滚动宿主。打开、关闭和回退走原有宿主的方法。样式随主题变量更新，窗内操作走原有局部更新，不触发工作台结构刷新。保留草稿输入、父窗 DOM、现有选择器、动作回调以及关闭后的焦点恢复。同步更新 [Workbench 视觉约定](../../ui-style/visual-languages/authoring/patterns/workbench.md) 和 [共享浮层约定](../../ui-style/shared-patterns/controls-and-overlays.md) 的相关段落。

## 验收

- 桌面宽屏分别看一轮短确认窗、普通表单、大型分栏窗和 Runtime 父子窗。核对标题／正文／底部对齐，长标题与底部动作可用，正文滚动时标题和动作留在原位，删除确认随内容收高。
- 用两套差异明显的编辑器主题核对面板、标题、文字、输入、焦点和危险按钮。打开一个普通游戏弹窗及主题编辑拖动窗，确认样式覆盖限于编辑器变体。
- 通过 `npm test -- tests/ui/interaction/modal.test.ts tests/ui/story/story-editor-authoring.test.ts tests/ui/story/story-editor-workspace.test.ts tests/ui/runtime-editor/runtime-editor-payment-actions.test.ts` 跑定向回归，按仓库约定保留 `.test-artifacts/latest.log`。核对普通窗默认行为、Story 复杂窗禁止遮罩／Esc 关闭及触发点焦点恢复、Runtime 嵌套返回及父级暂存。并行执行资源不足时分批运行。

## 当前进展

已实现 `ModalOptions.appearance: 'editor'` 共用外观，并接入 Story／Entry 编辑窗、相关直接 `modal.open` 入口、活跃编辑态包选择、Runtime 子窗与删除确认。同步更新了共享控件和 Authoring Workbench 视觉约定。未进行浏览器验收（按用户要求）。

指定的四个定向测试分别通过：modal 7/7、Story authoring 36/36、Story workspace 55/55、Runtime payment 3/3。Story workspace 使用默认 4GB Node 堆时会 OOM；单独用例定位和堆样本见 [[ai/plan/task-0433-test-memory-investigation]]。`npm run check:docs` 与 `git diff --check` 通过。等待审核是否需要进一步进行 heap snapshot 归因。
