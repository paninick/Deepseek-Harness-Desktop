# @deepseek-ai/dsh-llm-vision-fallback

[English](README.md) | 中文

由用户指定的视觉模型为图片附件生成描述，使纯文本主模型（例如 DeepSeek）也能处理它们。

Models 设置页把指定的路由存入 `vision-fallback` 设置 namespace：主路由（`provider` + `model`，两者皆缺省时停用该功能）、可选的备用路由（`backupProvider` + `backupModel`），以及选择策略（`mode`：`'auto'`、`'primary'` 或 `'backup'`，缺省按 `'auto'` 处理）。每条路由复用所选提供方的接口地址、传输协议与凭据；独立的识图接口应先配置成另一个提供方，再在此处选择。只要 `ctx.visionFallback.configured()` 为真，apiproxy 的准入闸门就允许纯文本主模型接收带图片的提示；agent loop 在每次派发请求前调用 `ctx.visionFallback.rewriteMessages()`：发往 `inputModalities` 不含 `'image'` 的模型的图片块，会被指定视觉模型一次性生成的描述文本替换。

`'auto'` 下主路由先行；当其调用失败——超时、传输错误、限流、提供方拒绝、甚至空描述——会在失败传给主请求之前，改用备用路由并重新获得完整的超时窗口。`'primary'` 与 `'backup'` 固定单一路由、从不切换；备用与主路由相同时会被去重，`'auto'` 绝不会为同一张图片把同一端点调用两次。唯一不切换的失败是用户自己取消主请求。

每条生成的描述都会在主请求派发前以 `vision/describe` 事件追加到会话日志，并携带实际生成它的路由，因此改写后的请求始终可由日志重建，后续步骤也复用已记录的描述而不是重新识图。

## Config

- `maxOutputTokens` —— 视觉调用的输出 token 上限。
- `timeoutMs` —— 单次尝试的视觉调用时限（毫秒）；每个路由各有一个完整窗口。

## Model Experience

纯文本路由上的主模型从不接触原始图片字节；它看到的是替换每张图片的 `【图片…】…【图片描述结束】` 包裹文本块，内容为视觉模型的描述。指定的视觉模型对每张新图片发起一次辅助请求（固定的中文 system prompt，要求忠实转写并描述布局）。描述按附件在会话内只生成一次，之后从日志回放，因此 token 成本是每张图片一次辅助调用，加上描述文本在此后每个主请求中的携带。发生切换的识图最多为该图片在备用路由上增加一次辅助调用。

## Known Limitations and Deferred Work

- 描述整体替换，没有超出 `maxOutputTokens` 之外的单图体积上限。
- 所有指定路由都失败的识图调用会使主请求显式失败，而不是降级为占位文本。
- 切换对任何非取消类失败都会继续下一路；尚未对提供方错误分类，因此凭据无效也会先多消耗一次备用调用才浮出错误。
- 模型页下拉框只列出 `inputModalities` 含 `'image'` 的目录行。不在该列表中的已存指定仍保持选中。手写 `settings.yaml` 仍可点名纯文本路由，且无论该路由宣称何种模态，`configured()` 都为真。
