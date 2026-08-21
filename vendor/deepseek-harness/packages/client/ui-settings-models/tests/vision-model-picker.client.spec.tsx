// @vitest-environment jsdom
/** Vision-route pickers list only catalog rows that advertise image input. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RpcResponse, SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import { VISION_FALLBACK_NS, VisionModelPicker } from '../src/client/VisionModelPicker.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

let nextRpc = 0
function ok<T>(value: T): RpcResponse<T> {
  return { rpcId: `r-${nextRpc++}` as never, result: { ok: true, value } }
}

function fail<T>(message: string, code = 'settings-rejected'): RpcResponse<T> {
  return {
    rpcId: `r-${nextRpc++}` as never,
    result: { ok: false, error: { code, message, details: { ns: 'x' } } as never },
  }
}

function namespace(value: Record<string, string> = {}): SettingsNamespaceView {
  return {
    ns: VISION_FALLBACK_NS,
    schema: {},
    value,
    applies: 'live',
    secrets: [],
    revision: 7,
  }
}

const IMAGE_GROUPS = [{
  id: 'codingplan',
  name: 'Codingplan',
  models: [
    { id: 'doubao-seed', name: 'Doubao Seed', inputModalities: ['text', 'image'] as const },
    { id: 'glm-5.3', name: 'GLM 5.3', inputModalities: ['text'] as const },
    { id: 'bare', name: 'Bare' },
  ],
}]

function mount(options: {
  stored?: Record<string, string>
  namespace?: SettingsNamespaceView | undefined
  writable?: boolean
  models?: ReturnType<typeof vi.fn>
  mutate?: ReturnType<typeof vi.fn>
  onSaved?: () => void
} = {}) {
  const models = options.models ?? vi.fn(() => Promise.resolve(ok({
    groups: IMAGE_GROUPS,
    failures: [],
  })))
  const mutate = options.mutate ?? vi.fn(() => Promise.resolve(ok({})))
  const onSaved = options.onSaved ?? (() => {})
  const view = render(
    <VisionModelPicker
      api={{ llm: { models }, settings: { mutate } } as never}
      t={key => en[key]}
      namespace={'namespace' in options ? options.namespace : namespace(options.stored)}
      writable={options.writable ?? true}
      onSaved={onSaved}
    />,
  )
  return { ...view, models, mutate, onSaved }
}

describe('VisionModelPicker', () => {
  it('offers only explicitly image-capable models on both routes', async () => {
    mount()

    const primary = await screen.findByLabelText(en.visionModel)
    const backup = screen.getByLabelText(en.visionModelBackup)
    expect(within(primary).getByRole('option', { name: 'Codingplan / Doubao Seed' })).toBeTruthy()
    expect(within(backup).getByRole('option', { name: 'Codingplan / Doubao Seed' })).toBeTruthy()
    expect(screen.queryAllByRole('option', { name: 'Codingplan / GLM 5.3' })).toHaveLength(0)
    expect(screen.queryAllByRole('option', { name: 'Codingplan / Bare' })).toHaveLength(0)
  })

  it('keeps stored text-only routes visible instead of snapping them to off', async () => {
    mount({
      stored: {
        provider: 'codingplan',
        model: 'glm-5.3',
        backupProvider: 'codingplan',
        backupModel: 'bare',
      },
    })

    const primary = await screen.findByLabelText(en.visionModel) as HTMLSelectElement
    const backup = screen.getByLabelText(en.visionModelBackup) as HTMLSelectElement
    expect(within(primary).getByRole('option', { name: 'codingplan / glm-5.3' })).toBeTruthy()
    expect(within(backup).getByRole('option', { name: 'codingplan / bare' })).toBeTruthy()
    expect(primary.value).toBe('codingplan\nglm-5.3')
    expect(backup.value).toBe('codingplan\nbare')
  })

  it('treats half-stored routes as off', async () => {
    mount({ stored: { provider: 'codingplan', backupModel: 'bare' } })

    const primary = await screen.findByLabelText(en.visionModel) as HTMLSelectElement
    const backup = screen.getByLabelText(en.visionModelBackup) as HTMLSelectElement
    expect(primary.value).toBe('')
    expect(backup.value).toBe('')
  })

  it('persists primary and backup routes independently', async () => {
    const { mutate } = mount()
    await waitFor(() => {
      expect(within(screen.getByLabelText(en.visionModel)).getByRole('option', {
        name: 'Codingplan / Doubao Seed',
      })).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText(en.visionModel), { target: { value: 'codingplan\ndoubao-seed' } })
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      ns: VISION_FALLBACK_NS,
      ops: [
        { op: 'set', path: ['provider'], value: 'codingplan' },
        { op: 'set', path: ['model'], value: 'doubao-seed' },
      ],
      expectedRevision: 7,
    })

    await waitFor(() => {
      expect((screen.getByLabelText(en.visionModelBackup) as HTMLSelectElement).disabled).toBe(false)
    })
    fireEvent.change(screen.getByLabelText(en.visionModelBackup), { target: { value: 'codingplan\ndoubao-seed' } })
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(2) })
    expect(mutate.mock.calls[1]?.[0]).toEqual({
      ns: VISION_FALLBACK_NS,
      ops: [
        { op: 'set', path: ['backupProvider'], value: 'codingplan' },
        { op: 'set', path: ['backupModel'], value: 'doubao-seed' },
      ],
      expectedRevision: 7,
    })
  })

  it('clears a route and persists the explicit policy', async () => {
    const { mutate } = mount({
      stored: { provider: 'codingplan', model: 'doubao-seed', mode: 'auto' },
    })
    await waitFor(() => {
      expect(within(screen.getByLabelText(en.visionModel)).getByRole('option', {
        name: 'Codingplan / Doubao Seed',
      })).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText(en.visionModel), { target: { value: '' } })
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
    expect(mutate.mock.calls[0]?.[0].ops).toEqual([
      { op: 'unset', path: ['provider'] },
      { op: 'unset', path: ['model'] },
    ])

    await waitFor(() => {
      expect((screen.getByLabelText(en.visionModelMode) as HTMLSelectElement).disabled).toBe(false)
    })
    fireEvent.change(screen.getByLabelText(en.visionModelMode), { target: { value: 'backup' } })
    await waitFor(() => { expect(mutate).toHaveBeenCalledTimes(2) })
    expect(mutate.mock.calls[1]?.[0].ops).toEqual([
      { op: 'set', path: ['mode'], value: 'backup' },
    ])
  })

  it('hides itself while the vision-fallback namespace is absent', () => {
    mount({ namespace: undefined })
    expect(screen.queryByLabelText(en.visionModel)).toBeNull()
  })

  it('reports catalog and save failures', async () => {
    const { unmount } = mount({ models: vi.fn(() => Promise.resolve(fail('catalog offline'))) })
    expect(await screen.findByText(`${en.visionModelLoadFailed}: catalog offline`)).toBeTruthy()
    unmount()

    mount({ mutate: vi.fn(() => Promise.resolve(fail('revision conflict'))) })
    await waitFor(() => {
      expect(within(screen.getByLabelText(en.visionModel)).getByRole('option', {
        name: 'Codingplan / Doubao Seed',
      })).toBeTruthy()
    })
    fireEvent.change(screen.getByLabelText(en.visionModel), { target: { value: 'codingplan\ndoubao-seed' } })
    expect(await screen.findByText(`${en.visionModelSaveFailed}: revision conflict`)).toBeTruthy()
  })

  it('reports catalog and save transport rejections', async () => {
    const { unmount } = mount({ models: vi.fn(() => Promise.reject(new Error('catalog disconnected'))) })
    expect(await screen.findByText(`${en.visionModelLoadFailed}: catalog disconnected`)).toBeTruthy()
    unmount()

    mount({ mutate: vi.fn(() => Promise.reject(new Error('settings disconnected'))) })
    await waitFor(() => {
      expect(within(screen.getByLabelText(en.visionModel)).getByRole('option', {
        name: 'Codingplan / Doubao Seed',
      })).toBeTruthy()
    })
    fireEvent.change(screen.getByLabelText(en.visionModel), { target: { value: 'codingplan\ndoubao-seed' } })
    expect(await screen.findByText(`${en.visionModelSaveFailed}: settings disconnected`)).toBeTruthy()
  })

  it('disables all route controls while the document is read-only', async () => {
    mount({ writable: false })
    expect((await screen.findByLabelText(en.visionModel) as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByLabelText(en.visionModelBackup) as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByLabelText(en.visionModelMode) as HTMLSelectElement).disabled).toBe(true)
  })

  it('ignores catalog settlement after unmount', async () => {
    const resolved = Promise.withResolvers<RpcResponse<{ groups: typeof IMAGE_GROUPS; failures: never[] }>>()
    const first = mount({ models: vi.fn(() => resolved.promise) })
    first.unmount()
    resolved.resolve(ok({ groups: IMAGE_GROUPS, failures: [] }))
    await Promise.resolve()

    const rejected = Promise.withResolvers<RpcResponse<{ groups: typeof IMAGE_GROUPS; failures: never[] }>>()
    const second = mount({ models: vi.fn(() => rejected.promise) })
    second.unmount()
    rejected.reject(new Error('connection lost'))
    await Promise.resolve()
    expect(screen.queryByLabelText(en.visionModel)).toBeNull()
  })
})
