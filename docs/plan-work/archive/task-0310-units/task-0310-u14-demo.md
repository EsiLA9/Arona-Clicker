# Unit task-0310-U14

## Goal
提供真实文件夹 PackSource 演示包及隔离存档的游戏内演示入口。

## Must Read / Read Set
Task0310 演示矩阵；FolderPackSource/parsePack；main boot；SaveSystem；Controller mount 与 bindEvents。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
普通 mount 会读普通存档；独立示例需手工 bindEvents/render；SaveSystem 是每页面静态适配，开发演示可临时将其方法换为内存实现，不影响其他浏览器页面。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/ui/development/area-map-demo/datapack.json
- src/ui/development/area-map-demo/content.json
- src/ui/development/area-map-demo-pack.ts
- src/ui/development/area-map-demo.ts
- src/ui/main.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 提供真实文件夹 PackSource 演示包及隔离存档的游戏内演示入口。

## Verification
实际 PackSource 导入测试在 U15；浏览器访问 /src/ui/index.html?areaMapDemo=1；普通 boot 先判 DEV 参数，仅示例绕过真实存档。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
