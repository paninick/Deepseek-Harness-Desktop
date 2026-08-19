/**
 * Pure route-selection policy for the vision fallback: which designated
 * routes a describe call should try, in what order, and whether a failure
 * should move on to the next one. Extracted from the service so the policy
 * is testable without a Cordis context or a live provider.
 *
 * @module @deepseek-ai/dsh-llm-vision-fallback/src/routing
 */

/** One vision-model route as stored in the vision-fallback settings. */
export interface VisionRoute {
  /** Registered provider route. */
  provider: string
  /** Provider-owned model id. */
  model: string
}

/** Route selection policy stored alongside the routes. */
export type VisionFallbackMode = 'auto' | 'primary' | 'backup'

/** What {@link visionRoutes} selects from. */
export interface VisionRoutingInput {
  /** Designated primary route, when both its fields are set. */
  primary?: VisionRoute
  /** Designated backup route, when both its fields are set. */
  backup?: VisionRoute
  /** Stored policy; absent or unknown spellings behave as `'auto'`. */
  mode?: VisionFallbackMode
}

/**
 * Ordered routes a describe call should try under the stored policy.
 *
 * `'auto'` tries the primary and then the backup; `'primary'` and
 * `'backup'` pin one route explicitly. A backup identical to the primary is
 * deduplicated, so `'auto'` never calls the same endpoint twice for one
 * image.
 * @param input - the designated routes and the stored policy.
 * @returns the routes to try, in order; empty while nothing is designated.
 */
export function visionRoutes({ primary, backup, mode = 'auto' }: VisionRoutingInput): VisionRoute[] {
  if (mode === 'primary') return primary === undefined ? [] : [primary]
  if (mode === 'backup') return backup === undefined ? [] : [backup]
  if (primary === undefined) return backup === undefined ? [] : [backup]
  if (backup === undefined) return [primary]
  return backup.provider === primary.provider && backup.model === primary.model
    ? [primary]
    : [primary, backup]
}

/**
 * Whether a failed describe attempt should move on to the next route.
 *
 * The user's own cancellation is the only failure that must not: every other
 * failure — timeout, transport, rate limit, provider refusal, even an empty
 * description — names the route that produced it, and trying the other
 * designated route is exactly the remedy the backup exists for.
 * @param _error - the failure of the attempted route (reserved for finer
 *   classification; currently every value behaves alike).
 * @param userSignal - the main-request cancellation the rewrite runs under.
 * @returns whether the next route should be tried.
 */
export function shouldFailOver(_error: unknown, userSignal: AbortSignal): boolean {
  return !userSignal.aborted
}
