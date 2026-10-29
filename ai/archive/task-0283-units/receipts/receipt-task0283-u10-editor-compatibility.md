# Receipt task0283-U10：原编辑器回归

首次导出回归4pass/2fail：两个旧UIContext夹具没有game，渲染既有getPackCatalog路径时失败；HEAD生产代码已存在相同读取。

仅为两处测试补game.getPackCatalog空只读结果，未改生产导出或草稿逻辑。`npx vitest run --silent tests/ui/runtime-editor-pack-export.test.ts` 6/6通过；可重新解析导出分片，导出只触发下载，不提交Runtime。

其它兼容批次：launcher1、form23、definition12、persistence5、popovers5通过，共46项。最终整合结果见父Task。
