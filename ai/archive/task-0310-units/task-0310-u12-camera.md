# Unit task-0310-U12

## Goal
实现稳定 SVG 画布的指针平移、锚点缩放和拖动点击抑制。

## Must Read / Read Set
Task0310；AreaMapSession；SelectorPage 的 CTM 坐标与相机方式（算法参考）。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
相机属于 UI session，平移缩放只修改 world transform；SVG viewBox 为 1000×700。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/ui/workspace/area-map-camera.ts
- tests/ui/area-map-camera.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 实现稳定 SVG 画布的指针平移、锚点缩放和拖动点击抑制。

## Verification
相机公式边界与 pointer cleanup 测试；最终浏览器交互。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
