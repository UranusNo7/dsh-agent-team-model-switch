/**
 * Reloadable entry point for `dsh-team-model-switcher`.
 *
 * Why this file exists: the DSH Loader resolves a plugin entry once and Node
 * caches both `specifier -> resolved URL` and `URL -> module`, so re-mounting a
 * plugin after editing its code keeps running the very first module it ever
 * imported. This entry therefore stays frozen and imports the real
 * implementation through a URL that carries a fresh revision on every mount, so
 * `plugin_manager` disable/enable picks up the current file on disk.
 *
 * Keep this file tiny and stable: adding the implementation back here would
 * reintroduce the stale-module problem it exists to avoid.
 *
 * @module dsh-team-model-switcher/entry
 */

/** Loader/plugin name. */
export const name = 'team-model-switcher'
/** Host services this plugin needs before it mounts. */
export const inject = ['tools', 'agentTeams', 'agents', 'llm', 'webServer']

/** Monotonic per-process revision, so two mounts cannot share a URL. */
let revision = 0

/**
 * Mount the implementation as it currently exists on disk.
 * @param ctx - Host plugin context.
 * @returns the implementation's disposer, when it returns one.
 */
export async function apply(ctx) {
  revision += 1
  const url = new URL(`./plugin.js?rev=${revision}-${Date.now()}`, import.meta.url)
  const implementation = await import(url.href)
  return implementation.apply(ctx)
}
