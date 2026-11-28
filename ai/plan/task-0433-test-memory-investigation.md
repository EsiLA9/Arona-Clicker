# Task 0433 · Story Editor workspace 测试内存调查

状态：待审核  
调查日期：2026-11-28

## 结论

默认 Node 4GB 堆下，`tests/ui/story/story-editor-workspace.test.ts` 是这组回归中触发堆耗尽的文件。按文件当前顺序，首个未能完成清理的测试是 `edits the initial scene through its non-node placeholder and keeps movement cards selectable`（约第 813 行）：此前 17 个测试已完成，第 18 个执行期间 worker 在 `afterEach` 前因 `heap out of memory` 退出。

现有证据**不能证明第 18 个测试单独泄漏内存**。仅运行该用例时，它通过，清理后的 `heapUsed` 约 622MB；整份 Story workspace 测试在 8GB Node 堆下 55/55 通过。4GB 堆下在 17 个已完成用例后的样本从约 2.2GB 上升到随后 OOM；更早样本会在个别测试后升至约 2.7GB，也会在后续测试后回落至约 0.6GB。样本取自清理回调末尾，V8 尚未必执行 GC，因此不能直接当作存活对象或泄漏量。

因此当前可确认的是：第 18 个用例是默认堆配置下的**触发点**，单独运行并不复现；OOM 出现在同一测试文件多次初始化完整 `GameInstance`／`UIController` 后的累积运行中。现有样本无法区分高峰来自待回收垃圾、仍被引用的对象或其他 worker 开销；是否存在真正的保留泄漏仍待 heap snapshot / dominator 对比确认。调查期间只临时加过 heap 采样日志，现已撤销，没有留下测试源码改动或产品修复。

## 验证记录

- 原始四文件并行定向运行：67 个用例已通过，Story workspace worker 以 `FATAL ERROR: ... heap out of memory` 退出；没有断言失败。
- 单文件拆分后：modal 7/7、Story authoring 36/36、Runtime payment 3/3 通过。
- Story workspace 单文件以默认堆运行：17 个用例后在上述第 18 个用例中 OOM。
- 第 18 个用例单独运行：1/1 通过，54 个跳过；清理后 `heapUsed` 约 622MB。
- Story workspace 单文件将 Node 堆上限设为 8GB：55/55 通过。

## 待审核事项

请审核是否需要继续做内存归因。若继续，建议在 fresh worker 中比较第 1 个用例结束后、第 17 个用例结束后及第 18 个用例执行期间的 heap snapshot dominator；同时核对 `UIController.destroy()`、`GameInstance.dispose()` 和 UI 全局注册表是否仍持有上一轮对象。除非快照显示稳定的强引用增长，不建议把第 18 个用例直接判为代码泄漏或以增大默认堆作为修复。

相关入口：`tests/ui/story/story-editor-workspace.test.ts`、`src/ui/controller/controller.ts` 的销毁路径、`src/arona-clicker/runtime/runtime-game-instance.ts` 的 `dispose()`、`src/ui/runtime/ui-host-registry.ts`。
