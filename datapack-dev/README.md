# 开发数据包自动加载目录

AC 启动时只读取本目录顶层的 `.zip` 文件，并识别符合命名规则的直接子目录。Vite 会将这些文件作为本地页面资源提供，游戏不需要文件选择器或额外目录配置。

## ZIP

- ZIP 直接放在本目录顶层。
- ZIP 根目录必须有 `datapack.json`。
- ZIP 自动按普通态处理。

## 展开目录

目录名格式：`<modName>@<version>@<editing|finished>`。包内容直接放在该目录内，根部包含 `datapack.json` 与 JSON 分片；图片等资源可放在子目录。

```text
datapack-dev/
  example-mod@1.2.0@finished/
    datapack.json
    00-content.json
    assets/icon.png
  example-mod@1.3.0@editing/
    datapack.json
    00-content.json
```

`modName` 和 `version` 必须与 manifest 完全一致。`editing` 来源不会直接进入 Runtime；`finished` 来源首次发现且无 ModName 冲突时会加入启用序列。后续启动尊重已保存的启用选择。重复 ModName 的来源保留在包库中但不会自动启用。
