# Agent Note: Vision routes use provider connections

Status: implemented

English | [中文](2026-08-20-vision-routes-use-provider-connections.zh.md)

## Problem

The vision fallback stored only `provider` and `model`, but the Models page listed every catalog row and did not explain where the selected route obtained its endpoint, protocol, or credential. A text-only model could therefore be selected as a vision route, while a separate vision endpoint appeared to require duplicate fields in the vision settings namespace. The primary/backup policy also had only pure route-order tests, leaving the assembled LLM calls and logged successful route unverified.

## Decision

Vision routing remains a consumer of the LLM provider registry. Each primary or backup route stores only a provider id and model id; the provider profile owns its endpoint, wire protocol, and credential. A vision model served by the same connection is selected under that provider. A separate vision API is configured once as a custom provider and then selected as a vision route, so secret storage and protocol adaptation stay in the provider implementation.

The host model catalog carries an adapter's declared `inputModalities`, and both vision selectors list only rows that explicitly include `image`. A stored route absent from that filtered catalog remains visible and selected, so an existing configuration never silently changes to Off. Hand-written settings can still name any registered route; the provider adapter remains the final capability check.

Automatic routing calls the primary through `ctx.llm` and then the backup after a non-cancellation failure. The successful `vision/describe` event records the provider and model that produced the description.

## Alternatives considered

- **Store a vision-specific endpoint and API key beside each route.** This duplicates provider profiles and secret ownership, bypasses provider protocol selection, and makes one credential change update several namespaces.
- **Leave every catalog model selectable and fail during the describe call.** This admits an image into a turn that the selected fallback cannot serve, producing a later and less actionable provider error.
- **Infer image support from model ids.** Provider aliases and custom deployment names make name-based inference unreliable; an explicit adapter declaration is the only supported claim.

## Consequences

Shared and separate vision APIs use the same configuration flow: reuse an existing provider or add another provider. Strict filtering hides models whose modality is unknown until their profile declares image input. Stale stored routes remain operable and visible, and manually authored invalid routes still fail loudly rather than being rewritten or discarded.

## Testing

The host catalog spec pins modality projection, the client component spec pins primary and backup filtering plus writes and failures, and the service spec pins primary failure, backup success, substituted text, and the logged backup route.
