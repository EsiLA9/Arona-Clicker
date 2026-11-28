# M06 公共字段与结构化编辑组件服务

## 1. 现况与目标

独立编辑器 `renderType/renderField` 生成结构化表单；Runtime Editor `dsl-editors.ts` 有 Condition/Effect 的 render/read，`actions.ts/subdialog.ts` 有独立弹窗与写回；Story `condition-tree-dialog.ts:openConditionTreeDialog`、`condition-tree-model.ts`、叶编辑与 `reference-navi.ts` 已有更完整的条件树交互。已有公共 `condition-reference-picker.ts`。如果直接新增一个 StructuredEditor，外壳共用但各域依旧分别实现树、拖拽、引用、确认和回写，便重现旧问题。

目标是共享实际数据编辑生命周期和组件，而非统一所有领域语义。公共字段由 M02 描述驱动，复杂字段进入详细编辑；现有 Story 条件树作为首个交互实现来源，现有 Runtime 的真实字段解析作为语义对照。

## 2. 数据结构与实际接口

```ts
interface FieldEditContext {
  sessionId:string; owner:Owner; field:string; expectedDraftRevision:number;
  value:unknown; descriptor:FieldDescriptor; source:SourcePoint;
  writable:boolean; domainContext:Record<string,unknown>;
}
interface StructuredFieldAdapter {
  id:string; root:'tree'|'ordered-list'|'object';
  read(value:unknown): EditNode;
  allowedChildren(node:EditNode,context:FieldEditContext):string[];
  describeNode(node:EditNode,context:FieldEditContext):FieldDescriptor[];
  validate(root:EditNode,context:FieldEditContext):Diagnostic[];
  write(root:EditNode,context:FieldEditContext):unknown;
}
interface EditNode {
  key:string; kind:string; value:unknown; children:EditNode[];
  opaque?:boolean; // 不理解的旧内容，保留原值并禁止危险改写
}
type StructuredAction =
  | {type:'set';node:string;field:string;value:unknown}
  | {type:'insert';parent:string;before?:string;value:EditNode}
  | {type:'move';node:string;parent:string;before?:string}
  | {type:'remove';node:string};
```

EditNode 是本次弹窗的编辑树，不是新 Condition/Effect 数据格式。adapter 读取真实字段、提供节点合法类型与参数、写回真实合同；公共部分只操作节点、编辑生命周期与 UI。临时 key 不写回 Def，不用数组下标充当长期选中身份。有序列表不可任意嵌套；tree 移动拒绝自身后代、非法父节点及适用的深度/数量约束。不同字段的实际限制由领域 adapter 明示，不把某个 Runtime UI 的 authoring limit 强加到所有领域。

公共普通字段组件支持文本、布尔、数字、枚举、资产、引用、对象、数组、联合字段；输入产生目标字段替换动作，M04 实际保存；M02 候选提供允许种类和显示/来源。联合 discriminator 改变时显示被移除的旧参数，确认后构造合法新值，不静默保留无意义字段。未知结构显示原值与未支持状态，禁止无损性未证明的回写。

## 3. 详细编辑弹窗

打开复杂字段：复制当前值及草稿版本，左侧树/集合、右侧选中项参数，固定确认/取消区。Inspector 保留简洁摘要，点击进入完整弹窗，不能压缩多层条件到单行小表单。选择、插入、拖放、嵌套、删除、复制（如果领域支持）、移动全部由同一个树/集合操作层执行。引用选择使用 M02，带当前局部作用域；只读目标允许查看不能修改。选择器返回后保留树、滚动、焦点。局部错误在相关节点和参数显示；确认先校验 adapter，再向 M04 提交一次字段替换及一次撤销。旧版本冲突保留弹窗副本，提示重新加载，取消无写入。关闭恢复入口焦点。

| 领域适配 | 专用规则 | 真实接入点 |
| --- | --- | --- |
| 普通 ConditionGroup | AND/OR、叶/子组、实际 target 与 comparator/value，来源范围 | `AREA_CONTENT_POLICY`、Runtime atomic condition render/read、现有 Story 条件树 |
| Entry.triggerCondition | 现有 True 模式和子树保留、持久条件与其它特殊入口限制 | `openConditionTreeDialog`、叶编辑和引用选择 |
| Enhancement.effects | 有序 Effect、按 op 匹配实际参数、数值表达式及合法目标 | `ENHANCEMENT_CONTENT_POLICY` 与 Runtime Effect 工具 |
| StoryNode.operation | 真实 StoryAction 的联合结构，state 中的动作列表按真实合同处理 | `property-fields.ts`、`story-definition-projection.ts`、action host |
| Map/Shop/Pool/Operation 集合 | 局部身份、嵌套/顺序、上下文候选和删除约束 | 由 M05 的对应领域批次逐个接入 |

不把 StoryAction 误当通用 Effect 的 target/value，不将所有复杂结构强行转为条件树。统计表达式 `stat-dsl.ts` 继续承担数值表达式，而非 M07 的正式正文语法。

## 4. 改造步骤及退出条件

M06-A：抽取普通字段与引用交互，独立编辑器原控件和 World 字段同时使用；只迁移已实际消费的职责。M06-B：把现有 Story 条件树的公共树状态、编辑副本、事件、选择/拖拽、确认/取消改成接 FieldEditContext/adapter；Area 条件与原 Story Entry 条件共同运行，退出 Runtime/Story 重复树和候选逻辑。M06-C：有序 Effect、StoryAction 适配，扩展数值表达式和复杂集合；旧 DOM 直接读写的重复逻辑逐批退役。M06-D：按 M05 的真实表覆盖继续适配，不建万能 DSL 编辑器。

验收：两个真实入口同时通过普通 AND/OR、True 模式保留、嵌套移动、取消、一次确认/撤销、非法参数、失效引用、只读与过期草稿。Effect 顺序真实执行一致，未知旧字段保留；同一引用规则服务表单、选择器和诊断。浏览器验证长树、独立滚动、拖拽、焦点、弹窗关闭和中右栏不重建。测试既有 `story-editor-authoring`、`story-editor-reference-navi`、Runtime Spot authoring、Condition/Effect 领域测试，不删原失败行为断言。
