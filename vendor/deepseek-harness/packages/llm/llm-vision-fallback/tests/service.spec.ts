import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmResolvedModelInfo, Message, StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import VisionFallback, { VISION_FALLBACK_SETTINGS_NAMESPACE } from '../src/index.ts'

function textResponse(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

class VisionRouteAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    if (options.provider === 'vision-primary') throw new Error('primary unavailable')
    yield * textResponse('backup description')
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      inputModalities: provider === 'main' ? ['text'] : ['text', 'image'],
    })
  }
}

class MemorySettings extends SettingsProvider {
  private doc: Record<string, unknown> = {}

  get writable(): boolean {
    return true
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc[ns] = structuredClone(section)
    return Promise.resolve()
  }
}

async function harness(): Promise<{ ctx: Context; adapter: VisionRouteAdapter }> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(MemorySettings)
  await ctx.plugin(VisionFallback, { maxOutputTokens: 2048, timeoutMs: 5_000 })
  const adapter = new VisionRouteAdapter()
  ctx.llm.registerAdapter(['main', 'vision-primary', 'vision-backup'], adapter)
  await ctx.settings.update(VISION_FALLBACK_SETTINGS_NAMESPACE, {
    provider: 'vision-primary',
    model: 'primary-model',
    backupProvider: 'vision-backup',
    backupModel: 'backup-model',
    mode: 'auto',
  })
  return { ctx, adapter }
}

describe('VisionFallback service', () => {
  it('fails over through provider routes and logs the route that produced the description', async () => {
    const { ctx, adapter } = await harness()
    const session = ctx.sessions.create()
    const messages: Message[] = [createUserMessage({
      content: [{
        type: 'image',
        attachment: {
          attachmentId: 'image-1' as never,
          mediaType: 'image/png',
          bytes: 1,
          width: 1,
          height: 1,
          name: 'screen.png',
        },
      }],
      source: { kind: 'user' },
    })]

    const rewritten = await ctx.visionFallback.rewriteMessages(
      session,
      { provider: 'main', model: 'text-only' },
      messages,
      new AbortController().signal,
    )

    expect(adapter.requests.map(request => ({
      provider: request.provider,
      model: request.model,
      purpose: request.purpose,
    }))).toEqual([
      { provider: 'vision-primary', model: 'primary-model', purpose: 'vision-describe' },
      { provider: 'vision-backup', model: 'backup-model', purpose: 'vision-describe' },
    ])
    expect(rewritten[0]?.content).toEqual([{
      type: 'text',
      text: expect.stringContaining('backup description'),
    }])
    const event = session.events.find(candidate => candidate.type === 'vision/describe')
    expect(event?.data).toMatchObject({
      attachmentId: 'image-1',
      route: { provider: 'vision-backup', model: 'backup-model' },
      name: 'screen.png',
      description: 'backup description',
    })
    await ctx.fiber.dispose()
  })
})
