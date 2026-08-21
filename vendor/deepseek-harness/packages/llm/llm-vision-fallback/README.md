# @deepseek-ai/dsh-llm-vision-fallback

English | [中文](README.zh.md)

User-designated vision-capable models describe image attachments so a text-only main model (e.g. DeepSeek) can act on them.

The Models settings page stores the designated routes in the `vision-fallback` settings namespace: a primary route (`provider` + `model`; both absent disables the feature), an optional backup route (`backupProvider` + `backupModel`), and a selection policy (`mode`: `'auto'`, `'primary'`, or `'backup'`; absent behaves as `'auto'`). Each route reuses its selected provider's endpoint, wire protocol, and credential; a separate vision API is configured as another provider and then selected here. The apiproxy admission gate admits image prompts for text-only main models whenever `ctx.visionFallback.configured()` is true, and the agent loop calls `ctx.visionFallback.rewriteMessages()` before dispatching each request: image blocks bound for a model whose `inputModalities` excludes `'image'` are replaced with description text generated once by a designated vision model.

Under `'auto'` the primary route serves first; when its call fails — timeout, transport error, rate limit, provider refusal, even an empty description — the backup route is tried with its own full deadline before the failure reaches the main request. `'primary'` and `'backup'` pin one route and never fail over; a backup identical to the primary is deduplicated so `'auto'` never calls the same endpoint twice for one image. The only failure that never moves on is the user's own cancellation of the main request.

Each generated description is appended to the session log as a `vision/describe` event before the main request dispatches, carrying the route that actually produced it, so rewritten requests remain reconstructable from the log and later steps reuse logged descriptions instead of re-describing.

## Config

- `maxOutputTokens` — vision-call output-token cap.
- `timeoutMs` — per-attempt vision-call deadline in milliseconds; each route gets its own window.

## Model Experience

The main model never sees raw image bytes on a text-only route; it sees `【图片…】…【图片描述结束】` framed text blocks in place of each image, containing the vision model's description. The designated vision model receives one auxiliary request per new image (fixed Chinese system prompt demanding faithful transcription and layout description). Descriptions are generated once per attachment per session and replayed from the log afterwards, so token cost is one auxiliary call per image plus the description text carried in every subsequent main request. A failed-over describe adds at most one extra auxiliary call for that image, on the backup route only.

## Known Limitations and Deferred Work

- Descriptions are substituted whole; there is no per-image size cap beyond `maxOutputTokens`.
- A vision call that fails on every designated route fails the main request loudly instead of degrading to a placeholder.
- Failover moves on from any non-cancellation failure; it does not yet classify provider errors, so an invalid credential also costs one backup attempt before surfacing.
- The Models page pickers list only catalog rows whose `inputModalities` include `'image'`. A stored designation missing from that list stays selected. Hand-written `settings.yaml` can still name a text-only route, and `configured()` stays true regardless of that route's advertised modalities.
