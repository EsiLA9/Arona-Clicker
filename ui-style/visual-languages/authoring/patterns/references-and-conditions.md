# 引用选择器、Navi 与条件树

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 复杂编辑弹窗

Story 复杂编辑弹窗由 `story-editor/editor-dialog.ts` 复用 ModalManager。标题与底部操作固定，正文独立滚动，可使用 `.story-editor-dialog__split` 并排放置编辑内容和预览。通过右上角关闭或底部取消退出，关闭后回到入口控件。更改 Story ID 首先使用该外壳，左侧修改名称和目标编辑副本，右侧显示引用影响。输入仅更新弹窗内容，确认后沿用现有工作区更新。行为验证见 `tests/ui/story/story-editor-identity.test.ts`。

## Reference Navi

Story 的内容引用沿用局部标记 Navi 的 ModalManager、输入操作行与稳定列表行：`reference-navi.ts` 在已标注引用字段旁装配“选择…”按钮，保留原 select / input 及字段写入口。名称 / ID 搜索仅切换行显隐，Story / Entry 的查看来源独立于回填。候选来自原字段目录，Story / Entry 合并当前草稿。固定枚举不装配 Navi。打开后焦点进入顶部搜索框。结果行先显示名称、再显示 ID，当前行带 `aria-current`，无匹配时显示单独的空态。关闭恢复原字段焦点，区域协调保留字段与滚动。空目录、缺失引用、禁写与已移除字段由原字段会话检查处理。入口为 `property-fields.ts`、`structured-value.ts`、`view.ts` 与 `controller.ts`。回归见 `tests/ui/story/story-editor-reference-navi.test.ts`。

## 局部标记 Navi

局部标记 Navi 沿用 ModalManager 的 body 级弹窗和滚动、现有 list-item / mini-action。字段旁只增加一个输入操作行与选择按钮。弹窗搜索过滤稳定行，选择与查看来源是独立动作。结果行依次显示名称、作用域及读写用途。内部标记不可选择时显示禁用说明。关闭后恢复字段焦点，回填沿既有字段命令与区域协调保留原输入和滚动宿主。实现入口为 `story-editor/local-flag-navi.ts`，DOM / 选择 / 来源行为见 `tests/ui/story/story-editor-flag-navi.test.ts`。

## 条件树的布局和编辑

StoryEntry 触发条件使用同一弹窗外壳。左侧树按层级展开，行间横线用于插入，高亮组边框表示移入组尾。右侧显示选中节点属性，各栏有独立滚动容器。添加只插入「待填写」子项并保留选中组，确认时定位首个未完成节点。树节点和属性控件按编辑会话内身份局部更新，确认后才协调工作区。入口为 `story-editor/condition-tree-dialog.ts`，行为见 `tests/ui/story/story-editor-authoring.test.ts`。

组合节点始终提供添加条件和添加子组。True 模式也支持编辑、拖动和删除子项，确认时校验并保留子树。右侧属性栏的层级高于左侧树，保持独立滚动。

## 单条条件与同弹窗引用搜索

单条条件的默认表单由 `condition-fields.ts` 按判断对象提供字段标题，专用交互由 `condition-leaf-editors.ts` 提供。实体引用共用 `condition-reference-navi.ts` 的候选，输入可直接键入 ID，候选显示名称和归属。搜索视图占用同一弹窗主体，以三个独立列呈现 Init 筛选、卡片及详情确认。原条件树保留挂载，返回恢复入口焦点，确认选择仅回填当前节点。区域的旧比较值可通过默认数值表单编辑。

## 共享引用选择器与目标卡

Story 与 StoryEntry 引用复用 `components/shared/condition-reference-picker.ts`，候选使用书本／场记板紧凑行，详情和已选目标使用共用的渐变卡。触发条件在原弹窗内切页，运行内容编辑器使用其子弹窗栈。世界线筛选按原有候选语义组织，编辑器草稿覆盖同 ID 的正式候选。确认回填原字段，取消保持原值。Story 编辑器属性区可直接点击目标卡片打开内容，包含只读字段，跳转纳入工作区历史。试播路线、Flag 来源、目录及运行内容资料库复用身份图标、标题和间距。玩家目录与邀请沿用当前可见标题，不为身份展示增加数据 ID 或提前揭示名称。

[[ui-style/visual-languages/authoring/patterns/identity-and-relations#Story／StoryEntry 身份卡与渐变编辑|Story／StoryEntry 身份卡]] 记录共用的图标、排版和渐变。

当前共享选择器的候选、空态、操作行分别使用 `.editor-list-item`、`.editor-empty`、`.editor-actions`，样式在 `src/ui/css/editor-shared.css`。Story 专用 Navi 继续使用 `story-editor-*` 类。两者沿用各自的写入协议，源码为 `src/ui/components/shared/condition-reference-picker.ts`。
