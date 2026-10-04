# 2026-10-01 退役资料快照

由 Task 0168 归档的 14 个文件，共 993,716 字节。逐项原路径、归档路径、SHA-256 与字节数见 manifest.json；迁移前后已核对哈希一致，包含文件当时的未提交内容。

| 子目录 | 内容与使用边界 |
| --- | --- |
| aoci/ | 已退役的 AOCI 入口、索引卷与元数据。仅供历史追溯，不再用于当前项目导航或配置。 |
| agent-instructions/ | 2026-09-17 的旧 AGENTS 备份；其规则已失效，不供 Agent 执行。 |
| test-results/ | 2026-09-10 的旧 Vitest 报告；不能作为当前测试状态。 |
| migration-scripts/ | 5 个一次性引擎迁移脚本。归档后相对路径与当时环境不再成立，禁止作为现行工具运行。 |
| legacy-data/ | bondDict.ts 历史阈值表；当前曲线由 AffectionSystem 提供。 |

机器绑定的 AOCI 服务配置恢复副本留在本机 .codex/config.toml.backup.retired-aoci-20261001，受忽略规则保护；不复制到版本化快照。删除项目配置段不等于当前客户端已卸载服务，连接状态在 Task 收据中单独记录。
