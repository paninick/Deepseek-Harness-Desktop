# 同步日志（sync log）

每轮官方/上游检测与同步的评估记录。决策规则见 feature 决策矩阵：
未触及→不动；触及→评估后决定 采纳/部分移植/保留；都没有→自建并加入保护清单。
同步后必跑 `npm test`——`src/shared/feature-markers.test.js` 是机械丢失闸。

## 2026-08-22 检测（探针首轮）

追踪点更新：official `141eb6fef8`(rc.8) → `b150a551b8`(0.1.1-rc.2)；ChisaAlter `4e350e5216`(0.2.6) → `5959465c05`。通道：git 直连间歇超时，降级 gh API 完成，恢复后补 fetch。

### 官方 0.1.0-rc.8 → 0.1.1-rc.2（评估门命中：识图域）

- **PR #2676 图片/Files API 管线重构**：attachment 28 文件、llm-deepseek/pi-ai、llm 核心。消息图片块从原始字节改为 `ImageAttachmentRef`/`RequestImageAttachment` 引用模型；新增 `RequestImageOffloadPolicy`（量化卸载）与 `textOnlyImageText()`（纯文本模型的省略占位符）。
- **评估结论：保留我们的 vision-fallback。** 官方方案是「省略 + 固定占位文案」，我们是「指定识图模型生成真实描述」——能力上 ours 覆盖 theirs 未覆盖的场景。**移植成本登记**：下次同步 0.1.1 时 `rewriteMessages` 必须移植到新 attachment 引用模型（image block 结构变化），chisa 血统的 attachment UI 同步适配。
- 未触及：host apiproxy（allowlist/scratchCwd 安全）、ui-* 包（picker 安全）、commands 契约。
- **决定：本轮不同步。** 0.1.1 仍是 RC；0.2.7 运行正常。0.2.8 评估窗口再动。

### 上游 0.2.6 → 5959465c05（3 提交）

- `5959465` rc.8 pin + **Ghostty 终端资产修复**（wasm/fonts 进 client lib/assets、after-pack/harness-extract 门禁、新增 src/shared/ghostty-assets）。**评估：部分移植候选**——全部在桌面壳层（共享血统），可 cherry-pick，与 vendor 树解耦。待验证我们 0.2.7 的终端是否也有 wasm/fonts 缺失问题再决定。
- `cea2a76` MCP OAuth 签入 + Settings 健康恢复：我们没有的功能，选装候选，暂不采。
- `5903af5` dshbot 插件（侧栏 bot/群聊）：选装候选，暂不采。

### 基线

- 本仓库：main = `0adcdc9c60`（0.2.7），my-local 前行（katex 修复、picker 恢复、execute 适配、守卫测试）。
- 官方追踪：`refs/sync/official-master` = `b150a551b8`。
- 上游追踪：`refs/sync/chisa-main` = `5959465c05`。
