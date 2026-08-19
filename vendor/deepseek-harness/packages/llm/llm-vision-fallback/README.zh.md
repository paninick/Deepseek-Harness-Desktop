# @deepseek-ai/dsh-llm-vision-fallback

[English](README.md) | 中文

由用户指定的视觉模型为图片附件生成描述，使纯文本主模型（例如 DeepSeek）也能处理它们。

Models 设置页把指定的路由（`provider` + `model`，两者皆缺省时停用该功能）存入 `vision-fallback` 设置 namespace。只要 `ctx.visionFallback.configured()` 为真，apiproxy 的准入闸门就允许纯文本主模型接收带图片的提示；agent loop 在每次派发请求前调用 `ctx.visionFallback.rewriteMessages()`：发往 `inputModalities` 不含 `'image'` 的模型的图片块，会被指定视觉模型一次性生成的描述文本替换。

每条生成的描述都会在主请求派发前以 `vision/describe` 事件追加到会话日志，因此改写后的请求始终可由日志重建，后续步骤也复用已记录的描述而不是重新识图。

## Config

- `maxOutputTokens` —— 视觉调用的输出 token 上限。
- `timeoutMs` —— 视觉调用的端到端时限，单位毫秒。

## Model Experience

纯文本路由上的主模型从不接触原始图片字节；它看到的是替换每张图片的 `【图片…】…【图片描述结束】` 包裹文本块，内容为视觉模型的描述。指定的视觉模型对每张新图片发起一次辅助请求（固定的中文 system prompt，要求忠实转写并描述布局）。描述按附件在会话内只生成一次，之后从日志回放，因此 token 成本是每张图片一次辅助调用，加上描述文本在此后每个主请求中的携带。

## Known Limitations and Deferred Work

- 描述整体替换，没有超出 `maxOutputTokens` 之外的单图体积上限。
- 视觉调用失败会使主请求显式失败，而不是降级为占位文本。
- 设置 UI 把所有已配置模型都列为候选；由于浏览器侧模型目录不携带 `inputModalities`，暂时无法过滤出真正具备视觉能力的路由。
