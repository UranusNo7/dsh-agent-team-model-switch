/**
 * `dsh-agent-team-model-switch` — Host half.
 *
 * The official Team plugin inherits the Lead's route when it creates a teammate
 * and exposes no way to change it afterwards: `spawn_teammate` has no model
 * parameter, the Agent Teams service has no member mutation, and
 * `ctx.sessionController.selectModel()` refuses subagent-owned sessions with
 * `session/agent-busy`. This plugin couples a model selection directly to the
 * live child Agent's scoped context — the same seam
 * `@deepseek-ai/dsh-api-session-controller` uses for ordinary sessions — so the
 * teammate's next request runs on the new route.
 *
 * This file deliberately imports no DSH package: a plugin whose real path sits
 * outside the DSH profile cannot resolve first-party `@deepseek-ai/*` specifiers,
 * so the selection listeners are inlined (mirroring `dsh-agent`'s
 * `installModelSelection`, minus the model-change notice) and the Web half talks
 * to plain HTTP routes instead of a Typert Remote namespace. The only import is
 * `node:fs`, which keeps explicit teammate routes alive across a DSH restart.
 *
 * @module dsh-agent-team-model-switch/host
 */

import { readFileSync, writeFileSync } from 'node:fs'

/** Loader/plugin name. */
export const name = 'team-model-switcher'
/** Host services this plugin needs before it mounts. */
export const inject = ['tools', 'agentTeams', 'agents', 'llm', 'webServer']

/** Route prefix owned by this plugin. */
const ROUTE_BASE = '/agent-team-model-switch'
/** Desired route per teammate SessionId; outlives an Agent disposed between turns. */
const pending = new Map()
/** Selections currently coupled to a live child Agent, keyed by child SessionId. */
const installed = new Map()
/** Where the explicit teammate routes are kept. */
const OVERRIDE_FILE = `${process.env.DSH_PROFILE_DIR ?? process.env.DSH_HOME ?? '.'}/team-model-switcher.json`
const DEFAULT_FILE = `${process.env.DSH_PROFILE_DIR ?? process.env.DSH_HOME ?? '.'}/team-model-default.json`
/**
 * Routes the user picked explicitly, keyed by teammate SessionId. Unlike
 * `pending`, this survives a DSH restart because it lives in a file.
 */
const overrides = readOverrides()
const REMOVED_FILE = `${process.env.DSH_PROFILE_DIR ?? process.env.DSH_HOME ?? '.'}/team-removed-members.json`
let removed = {}
try { removed = JSON.parse(readFileSync(REMOVED_FILE, 'utf8')) } catch (error) {
  if (error.code !== 'ENOENT') throw error
}
let originalMembers

function retiredTarget(ctx, caller, name) {
  const root = ctx.agentTeams.membership(caller).root
  return Object.values(removed).find((entry) => entry.teamId === root.id && entry.name === name)
}

/** Install reversible guards on the official Team service; no journal rewriting. */
function installRemovalGuards(ctx) {
  const team = ctx.agentTeams
  const restorers = []
  function wrap(object, key, factory) {
    const own = Object.getOwnPropertyDescriptor(object, key)
    const previous = object[key]
    const replacement = factory(previous)
    object[key] = replacement
    restorers.push(() => {
      if (object[key] !== replacement) return
      if (own) Object.defineProperty(object, key, own)
      else delete object[key]
    })
  }
  originalMembers = team.listMembers.bind(team)
  try {
    wrap(team, 'spawnTeammate', (previous) => async function (caller, request) {
      const result = await previous.call(this, caller, request)
      if (defaultSelection !== undefined && result?.member?.id !== undefined &&
        ctx.agentTeams.membership(caller).role === 'lead') {
        applySelection(ctx, result.member, defaultSelection)
      }
      return result
    })
    wrap(team, 'listMembers', (previous) => function (caller) {
      return previous.call(this, caller).filter((row) => !removed[row.id])
    })
    wrap(team, 'sendMessage', (previous) => function (caller, request) {
      if (retiredTarget(ctx, caller, request.target)) throw new Error(`teammate "${request.target}" was removed; choose an active member`)
      if (removed[caller.id]) throw new Error('removed teammates cannot send Team messages')
      return previous.call(this, caller, request)
    })
    wrap(team, 'updateTask', (previous) => function (caller, request) {
      if (removed[caller.id] || (request.owner && retiredTarget(ctx, caller, request.owner))) {
        throw new Error('removed teammates cannot own or update Team tasks')
      }
      return previous.call(this, caller, request)
    })
    // Mailbox replay bypasses sendMessage: prevent old queued messages waking retirees.
    if (typeof team.mailbox?.dispatchOnce !== 'function') throw new Error('this DSH Team version does not support the removal delivery guard')
    wrap(team.mailbox, 'dispatchOnce', (previous) => function (root, message, signal) {
      if (removed[message.targetId]) return Promise.resolve(false)
      return previous.call(this, root, message, signal)
    })
  } catch (error) {
    restorers.reverse().forEach((restore) => restore())
    throw error
  }
  return () => restorers.reverse().forEach((restore) => restore())
}

/** Retire one existing teammate; historical logs and completed tasks are retained. */
async function removeTeamMember(ctx, params) {
  const sessionId = requireText(params?.sessionId, 'sessionId')
  const name = requireText(params?.member, 'member')
  const lead = requireAgent(ctx.get('agents'), sessionId, 'team lead')
  requireLead(ctx.agentTeams, lead)
  const member = originalMembers(lead).find((row) => row.name === name && row.role === 'teammate')
  if (!member) throw new Error(`no teammate named "${name}"; the Lead cannot be removed`)
  const tasks = ctx.agentTeams.listTasks(lead).filter((task) => task.ownerName === name &&
    (task.status === 'pending' || task.status === 'in_progress'))
  for (const task of tasks) {
    await ctx.agentTeams.updateTask(lead, { taskId: task.id, expectedRevision: task.revision, action: 'reassign' })
  }
  ctx.agentTeams.interrupt(lead, name)
  const next = { ...removed, [member.id]: { teamId: lead.id, name, removedAt: Date.now() } }
  writeFileSync(REMOVED_FILE, `${JSON.stringify(next, null, 2)}\n`)
  removed = next
  pending.delete(member.id)
  delete overrides[member.id]
  writeOverrides()
  const selection = installed.get(member.id)
  if (selection) { selection.dispose(); installed.delete(member.id) }
  return { name, removed: true, releasedTasks: tasks.length, historyPreserved: true }
}

const REMOVE_TEAM_MEMBER = {
  name: 'remove_team_member',
  description: 'Remove one broken or unneeded teammate from this Team. Lead only. Stops its current turn, hides it from list_agents, blocks new messages and queued Team delivery, and unassigns unfinished tasks. Keeps conversation history and completed tasks. Removal persists across restart while this plugin is enabled. The Lead cannot be removed; the old name remains reserved by the official roster.',
  parameters: { type: 'object', properties: { member: { type: 'string', description: 'Exact teammate name to remove.' } }, required: ['member'], additionalProperties: false },
  output: { schema: { type: 'object', properties: {
    name: { type: 'string' }, removed: { type: 'boolean' }, releasedTasks: { type: 'number' }, historyPreserved: { type: 'boolean' }
  }, required: ['name', 'removed', 'releasedTasks', 'historyPreserved'], additionalProperties: false },
  render: (_args, result) => [{ type: 'text', text: `Removed ${result.name}; released ${result.releasedTasks} unfinished task(s). Conversation history retained.` }] }
}

function readDefault() {
  try {
    const parsed = JSON.parse(readFileSync(DEFAULT_FILE, 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}
let defaultSelection = readDefault()
function writeDefault() {
  if (defaultSelection === undefined) return
  writeFileSync(DEFAULT_FILE, `${JSON.stringify(defaultSelection, null, 2)}\n`)
}
/** Read the persisted teammate routes; a missing or unreadable file means none. */
function readOverrides() {
  try {
    const parsed = JSON.parse(readFileSync(OVERRIDE_FILE, 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Persist the teammate routes; a failed write only costs the profile the memory. */
function writeOverrides() {
  try {
    writeFileSync(OVERRIDE_FILE, `${JSON.stringify(overrides, null, 2)}\n`)
  } catch {
    /* the running process still routes correctly from memory */
  }
}

/** The route the Lead is on now — what a teammate without its own route inherits. */
function leadRoute(lead) {
  const config = lead?.session?.requestHeader?.()?.config
  if (config?.provider === undefined || config?.model === undefined) return undefined
  return {
    provider: config.provider,
    model: config.model,
    ...(config.reasoningEffort === undefined ? {} : { reasoningEffort: config.reasoningEffort })
  }
}

/**
 * Couple one mutable selection to an Agent's prompt assembly and request routing.
 * Mirrors `installModelSelection` from `@deepseek-ai/dsh-agent` (the durable
 * model-change notice is omitted).
 * @param agentCtx - the selected Agent's scoped context.
 * @param state - mutable holder read at assembly and applied to the request.
 * @returns disposer for the two scoped listeners.
 */
function installSelection(agentCtx, state) {
  const disposeAssembly = agentCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const selected = state.current
    const assembled = await next()
    state.assembled = selected
    if (selected === undefined) return assembled
    return {
      ...assembled,
      variables: { ...assembled.variables, provider: selected.provider, model: selected.model }
    }
  })
  const disposeRequest = agentCtx.on('agent/request', async (_payload, next) => {
    const resolved = await next()
    const selected = state.assembled
    if (selected === undefined) return resolved
    const { reasoningEffort: _inherited, ...withoutInheritedEffort } = resolved
    return {
      ...withoutInheritedEffort,
      provider: selected.provider,
      model: selected.model,
      ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort })
    }
  })
  return () => {
    disposeAssembly()
    disposeRequest()
  }
}

/**
 * Couple one route to a live Agent now, replacing this plugin's earlier
 * selection for the same Session.
 * @param agent - the live teammate Agent.
 * @param sessionId - its Session identity.
 * @param selected - the route to apply to its next requests.
 */
function attach(agent, sessionId, selected) {
  const existing = installed.get(sessionId)
  if (existing !== undefined && existing.agent === agent) {
    existing.state.current = selected
    return
  }
  if (existing !== undefined) existing.dispose()
  const state = { current: selected, assembled: undefined }
  installed.set(sessionId, { agent, state, dispose: installSelection(agent.ctx, state) })
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  return value.trim()
}

/** Resolve one live Agent by SessionId, or fail with a stable message. */
function requireAgent(agents, sessionId, subject) {
  const agent = agents?.get(sessionId)
  if (agent === undefined) {
    throw new Error(`${subject} session "${sessionId}" has no live Agent`)
  }
  return agent
}

/** Resolve the Lead Agent and prove the caller belongs to its Team as Lead. */
function requireLead(agentTeams, lead) {
  let membership
  try {
    membership = agentTeams.membership(lead)
  } catch (error) {
    throw new Error(`session "${lead.id}" is not part of an Agent Team: ${String(error)}`)
  }
  if (membership.role !== 'lead') {
    throw new Error(`session "${lead.id}" is a teammate, not the Team Lead`)
  }
  return membership
}

/**
 * List the Lead's teammates with the route each one will use next.
 * A teammate shows the route the user picked for it; without one it inherits the
 * Lead's current route, which is flagged so the panel does not present the
 * official roster's creation-time values as a choice.
 * @param ctx - Host plugin context.
 * @param sessionId - Lead session identity.
 * @returns the Lead name and every member row.
 */
function listMembers(ctx, sessionId) {
  const agents = ctx.get('agents')
  const agentTeams = ctx.agentTeams
  const lead = requireAgent(agents, sessionId, 'team lead')
  const membership = requireLead(agentTeams, lead)
  const inherited = leadRoute(lead)
  const members = agentTeams.listMembers(lead).map((member) => {
    const override = pending.get(member.id) ?? overrides[member.id]
    const route = override ?? inherited
    const row = { name: member.name, sessionId: member.id, role: member.role, status: member.status }
    if (route?.provider !== undefined) row.provider = route.provider
    if (route?.model !== undefined) row.model = route.model
    if (route?.reasoningEffort !== undefined) row.reasoningEffort = route.reasoningEffort
    if (override === undefined && member.role !== 'lead') row.inherited = true
    return row
  })
  return { lead: membership.name, members }
}

/**
 * Read the routable model catalog through the Session controller Host service.
 * @param ctx - Host plugin context.
 * @returns provider groups, or an empty list when the service is unavailable.
 */
async function modelGroups(ctx) {
  const controller = ctx.get('sessionController')
  if (controller === undefined || typeof controller.modelCatalog !== 'function') return []
  try {
    const catalog = await controller.modelCatalog()
    return (catalog?.groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      models: (group.models ?? []).map((model) => ({
        id: model.id,
        name: model.name,
        // The panel draws the reasoning-effort picker from this, so the catalog's
        // `ModelReasoning` ({ efforts, defaultEffort? }) is passed through.
        ...(model.reasoning === undefined ? {} : {
          reasoning: {
            ...(model.reasoning.defaultEffort === undefined
              ? {}
              : { defaultEffort: model.reasoning.defaultEffort }),
            efforts: (model.reasoning.efforts ?? []).map((effort) => ({
              id: effort.id,
              ...(effort.name === undefined ? {} : { name: effort.name }),
              ...(effort.description === undefined ? {} : { description: effort.description })
            }))
          }
        })
      }))
    }))
  } catch {
    return []
  }
}

/**
 * Resolve the Team, prove the caller is its Lead, and return one teammate row.
 * @param ctx - Host plugin context.
 * @param sessionId - Lead session identity.
 * @param memberName - exact teammate name.
 * @returns the Lead Agent and the named teammate row.
 */
function requireTeammate(ctx, sessionId, memberName) {
  const lead = requireAgent(ctx.get('agents'), sessionId, 'team lead')
  requireLead(ctx.agentTeams, lead)
  const member = ctx.agentTeams.listMembers(lead)
    .find((row) => row.role === 'teammate' && row.name === memberName)
  if (member === undefined) {
    throw new Error(`team has no teammate named "${memberName}"`)
  }
  return { lead, member }
}

/**
 * Resolve the Team, prove the caller is its Lead, and return every teammate.
 * @param ctx - Host plugin context.
 * @param sessionId - Lead session identity.
 * @returns every teammate row (the Lead is never included: its own model belongs
 * to the ordinary session model selection, not to this tool).
 */
function requireTeammates(ctx, sessionId) {
  const lead = requireAgent(ctx.get('agents'), sessionId, 'team lead')
  requireLead(ctx.agentTeams, lead)
  const members = ctx.agentTeams.listMembers(lead).filter((row) => row.role === 'teammate')
  if (members.length === 0) throw new Error('this team has no teammates yet')
  return members
}

/**
 * Normalize one requested route through the LLM service, rejecting bad routes.
 * @param ctx - Host plugin context.
 * @param provider - requested LLM provider id.
 * @param model - requested model id inside that provider.
 * @param reasoningEffort - optional reasoning effort id; empty means the default.
 * @returns the normalized selection.
 */
async function resolveSelection(ctx, provider, model, reasoningEffort) {
  let resolved
  try {
    resolved = await ctx.llm.resolveCallConfig({
      provider,
      model,
      ...(typeof reasoningEffort === 'string' && reasoningEffort.length > 0
        ? { reasoningEffort }
        : {})
    })
  } catch (error) {
    throw new Error(`route ${provider}/${model} is not usable: ${error instanceof Error ? error.message : String(error)}`)
  }
  return {
    provider: resolved.provider,
    model: resolved.model,
    ...(resolved.reasoningEffort === undefined ? {} : { reasoningEffort: resolved.reasoningEffort })
  }
}

/**
 * Remember one selection for a teammate and, when that teammate is live, couple
 * it to that Agent now.
 * A child Agent is disposed between turns, so the route is remembered — in
 * `pending` for this process and in the override file for later runs — and
 * re-applied on every later activation of that Session.
 * @param ctx - Host plugin context.
 * @param member - the teammate row to retarget.
 * @param selected - the normalized route.
 * The pick is pinned even when it equals the Lead's current route: a member
 * session resumes from the route frozen in its own subagent descriptor, so
 * dropping the override here would let that stale route back in.
 * @returns the applied row, including whether that teammate is live right now.
 */
function applySelection(ctx, member, selected) {
  const child = ctx.get('agents')?.get(member.id)
  pending.set(member.id, selected)
  overrides[member.id] = selected
  writeOverrides()
  if (child !== undefined) attach(child, member.id, selected)
  const session = ctx.get('sessions')?.get(member.id) ?? child?.session
  session?.append('model/selection', selected)
  return { name: member.name, sessionId: member.id, ...selected, live: child !== undefined }
}

/**
 * Install one selection on a live teammate for its next request.
 * @param ctx - Host plugin context.
 * @param params - Lead session, member name, and the requested route.
 * @returns the normalized selection that was installed.
 */
async function switchMemberModel(ctx, params) {
  const sessionId = requireText(params?.sessionId, 'sessionId')
  const memberName = requireText(params?.member, 'member')
  const provider = requireText(params?.provider, 'provider')
  const model = requireText(params?.model, 'model')
  const { member } = requireTeammate(ctx, sessionId, memberName)
  return applySelection(ctx, member, await resolveSelection(ctx, provider, model, params?.reasoningEffort))
}

/**
 * Install one selection on every teammate of the Team at once. The route is
 * normalized once and then applied to each teammate, so a "one click" switch
 * either lands on the whole Team or fails before touching any of it.
 * @param ctx - Host plugin context.
 * @param params - Lead session and the requested route.
 * @returns the applied route plus one row per retargeted teammate.
 */
async function switchAllMemberModels(ctx, params) {
  const sessionId = requireText(params?.sessionId, 'sessionId')
  const provider = requireText(params?.provider, 'provider')
  const model = requireText(params?.model, 'model')
  const members = requireTeammates(ctx, sessionId)
  const selected = await resolveSelection(ctx, provider, model, params?.reasoningEffort)
  const applied = members.map((member) => applySelection(ctx, member, selected))
  return { updated: applied.length, ...selected, members: applied }
}

async function setDefaultMemberModel(ctx, params) {
  const sessionId = requireText(params?.sessionId, 'sessionId')
  const provider = requireText(params?.provider, 'provider')
  const model = requireText(params?.model, 'model')
  const lead = requireAgent(ctx.get('agents'), sessionId, 'team lead')
  requireLead(ctx.agentTeams, lead)
  defaultSelection = await resolveSelection(ctx, provider, model, params?.reasoningEffort)
  writeDefault()
  return defaultSelection
}

const SET_DEFAULT_MEMBER_MODEL = {
  name: 'set_default_member_model',
  description: 'Set the persisted provider/model/reasoning effort applied to teammates created afterwards. Only the Team Lead may call this.',
  parameters: {
    type: 'object',
    properties: {
      provider: { type: 'string' },
      model: { type: 'string' },
      reasoningEffort: { type: 'string' }
    },
    required: ['provider', 'model'], additionalProperties: false
  },
  output: { schema: { type: 'object', properties: { provider: { type: 'string' }, model: { type: 'string' }, reasoningEffort: { type: 'string' } }, required: ['provider', 'model'], additionalProperties: false },
    render: (_args, value) => [{ type: 'text', text: `new teammates will use ${value.provider}/${value.model}${value.reasoningEffort === undefined ? '' : ` (reasoning: ${value.reasoningEffort})`}` }] }
}
const SET_MEMBER_MODEL = {
  name: 'set_member_model',
  description:
    'Switch the model one Agent Teams teammate uses from its next request on, whether it is running or idle. Only the Team Lead may call this. The teammate keeps running; the route also re-applies every time that teammate is activated again.',
  parameters: {
    type: 'object',
    properties: {
      member: { type: 'string', description: 'Exact teammate name from list_agents.' },
      provider: { type: 'string', description: 'LLM provider id, for example "opencode-go".' },
      model: { type: 'string', description: 'Model id inside that provider.' },
      reasoningEffort: { type: 'string', description: 'Optional reasoning effort id; omit to use the model default.' }
    },
    required: ['member', 'provider', 'model'],
    additionalProperties: false
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        provider: { type: 'string' },
        model: { type: 'string' },
        reasoningEffort: { type: 'string' }
      },
      required: ['name', 'provider', 'model'],
      additionalProperties: false
    },
    render: (_args, value) => [{
      type: 'text',
      text: `teammate "${value.name}" will use ${value.provider}/${value.model}${
        value.reasoningEffort === undefined ? '' : ` (reasoning: ${value.reasoningEffort})`
      } from its next request on`
    }]
  }
}

/** Model-facing tool: the Lead switches every teammate's model at once. */
const SET_ALL_MEMBER_MODELS = {
  name: 'set_all_member_models',
  description:
    'Switch every teammate of this Agent Team to one model (and optional reasoning effort) from their next request on, whether each one is running or idle. Only the Team Lead may call this; the Lead keeps its own model. Every teammate keeps running, and the route also re-applies every time that teammate is activated again.',
  parameters: {
    type: 'object',
    properties: {
      provider: { type: 'string', description: 'LLM provider id, for example "opencode-go".' },
      model: { type: 'string', description: 'Model id inside that provider.' },
      reasoningEffort: { type: 'string', description: 'Optional reasoning effort id; omit to use the model default.' }
    },
    required: ['provider', 'model'],
    additionalProperties: false
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        model: { type: 'string' },
        reasoningEffort: { type: 'string' },
        updated: { type: 'number' },
        members: { type: 'array', items: { type: 'string' } }
      },
      required: ['provider', 'model', 'updated', 'members'],
      additionalProperties: false
    },
    render: (_args, value) => [{
      type: 'text',
      text: `${value.updated} teammate(s) will use ${value.provider}/${value.model}${
        value.reasoningEffort === undefined ? '' : ` (reasoning: ${value.reasoningEffort})`
      } from their next request on: ${value.members.join(', ')}`
    }]
  }
}

/** Read configured routes and request/response evidence without waking members. */
async function listMemberModels(ctx, sessionId) {
  const roster = listMembers(ctx, sessionId)
  const members = await Promise.all(roster.members.map(async (row) => {
    const pin = pending.get(row.sessionId) ?? overrides[row.sessionId]
    const route = (v) => v && typeof v.provider === 'string' && typeof v.model === 'string'
      ? { provider: v.provider, model: v.model, ...(v.reasoningEffort === undefined ? {} : { reasoningEffort: v.reasoningEffort }) } : null
    const result = { name: row.name, role: row.role, status: row.status, sessionId: row.sessionId,
      source: row.role === 'lead' ? 'lead' : pin ? 'pinned' : 'inherit-on-team-dispatch',
      nextTeamRequest: route(row), nextDirectRequest: null, lastRequest: null, lastResponse: null }
    try {
      const live = ctx.get('sessions')?.get(row.sessionId)
      const events = live ? live.snapshotEvents() : (await ctx.get('sessionController').inspect(row.sessionId)).events
      let descriptor
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const e = events[i]
        if (!result.lastRequest && e.type === 'request/header') {
          const value = route(e.data.header?.config)
          if (value) result.lastRequest = { ...value, seq: e.seq, time: e.time }
        }
        if (!result.lastResponse && e.type === 'assistant/message') {
          const value = route(e.data.message?.source)
          if (value) result.lastResponse = { ...value, seq: e.seq, time: e.time }
        }
        if (!descriptor && e.type === 'subagent/descriptor') descriptor = e.data
      }
      result.nextDirectRequest = pin ? route(pin) : row.role === 'lead' ? route(row) :
        route(descriptor && { provider: descriptor.agentProvider, model: descriptor.agentModel, reasoningEffort: descriptor.agentReasoningEffort })
    } catch (error) {
      result.readError = String(error)
      result.nextDirectRequest = pin ? route(pin) : row.role === 'lead' ? route(row) : null
    }
    return result
  }))
  return { lead: roster.lead, members }
}

const LIST_MEMBER_MODELS = {
  name: 'list_member_models',
  description: 'Read this Team\'s configured next model routes and latest actual request/response evidence. Use instead of list_agents/spawn_teammate model fields, which show creation metadata and spawn/fork backends. nextTeamRequest/nextDirectRequest are plans, NOT actual-use evidence. lastRequest is the latest recorded request; lastResponse is the latest recorded response source. Null means unknown or never used. Does not wake teammates. Only the Lead may call this.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  output: {
    schema: { type: 'object', properties: { report: { type: 'string' } }, required: ['report'], additionalProperties: false },
    render: (_args, value) => [{ type: 'text', text: value.report }]
  }
}

/** Read one bounded JSON request body. */
async function readJson(req, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('request body is too large')
    chunks.push(chunk)
  }
  if (size === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Write one JSON response. */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  })
  res.end(body)
}

/** The panel's own requests carry this header; a cross-site POST cannot. */
function isPanelRequest(req) {
  if (req.method !== 'POST') return false
  if (req.headers['x-atms'] !== '1') return false
  const site = req.headers['sec-fetch-site']
  return site === undefined || site === 'same-origin' || site === 'none'
}

/**
 * Own one panel route: parse JSON, run the handler, answer JSON.
 * @param run - business handler receiving the parsed body.
 * @returns an HTTP handler for `ctx.webServer.register`.
 */
function routeHandler(run) {
  return async (req, res) => {
    if (!isPanelRequest(req)) {
      sendJson(res, 403, { error: 'this route only answers the Agent Teams model panel' })
      return
    }
    let body
    try {
      body = await readJson(req)
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      return
    }
    try {
      sendJson(res, 200, await run(body))
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/**
 * Mount the Lead tool, the activation hook, the two panel routes, and cleanup.
 * @param ctx - Host plugin context with `tools`, `agentTeams`, `agents`, `llm`, and `webServer`.
 */
export function apply(ctx) {
  ctx.effect(() => installRemovalGuards(ctx))
  ctx.effect(() => ctx.tools.register({
    ...REMOVE_TEAM_MEMBER,
    execute: (args, exec) => {
      if (!exec?.agent) throw new Error('remove_team_member requires an Agent')
      return removeTeamMember(ctx, { ...args, sessionId: exec.agent.id })
    }
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: `${ROUTE_BASE}/remove`,
    handler: routeHandler((body) => removeTeamMember(ctx, body))
  }))
  // A routed teammate is re-created for every activation; apply its remembered
  // route before its first request of that activation. The override file is what
  // lets a picked route outlive a DSH restart, when `pending` is empty again.
  ctx.effect(() => ctx.on('agent/created', ({ agent }) => {
    if (agent === undefined) return
    const wanted = pending.get(agent.id) ?? overrides[agent.id]
    if (wanted === undefined) return
    try {
      attach(agent, agent.id, wanted)
    } catch (error) {
      ctx.logger?.warn?.(`agent-team-model-switch: could not apply the remembered route to "${agent.id}": ${String(error)}`)
    }
  }))
  ctx.effect(() => ctx.tools.register({
    ...SET_DEFAULT_MEMBER_MODEL,
    async execute(args, exec) {
      if (!exec?.agent) throw new Error('set_default_member_model can only run for an Agent')
      return setDefaultMemberModel(ctx, { ...args, sessionId: exec.agent.id })
    }
  }))
  ctx.effect(() => ctx.tools.register({
    ...SET_MEMBER_MODEL,
    async execute(args, exec) {
      const agent = exec?.agent
      if (agent === undefined) throw new Error('set_member_model can only run for an Agent')
      const result = await switchMemberModel(ctx, { ...args, sessionId: agent.id })
      return {
        name: result.name,
        provider: result.provider,
        model: result.model,
        ...(result.reasoningEffort === undefined ? {} : { reasoningEffort: result.reasoningEffort })
      }
    }
  }))
  ctx.effect(() => ctx.tools.register({
    ...SET_ALL_MEMBER_MODELS,
    async execute(args, exec) {
      const agent = exec?.agent
      if (agent === undefined) throw new Error('set_all_member_models can only run for an Agent')
      const result = await switchAllMemberModels(ctx, { ...args, sessionId: agent.id })
      return {
        provider: result.provider,
        model: result.model,
        ...(result.reasoningEffort === undefined ? {} : { reasoningEffort: result.reasoningEffort }),
        updated: result.updated,
        members: result.members.map((row) => row.name)
      }
    }
  }))
  ctx.effect(() => ctx.tools.register({
    ...LIST_MEMBER_MODELS,
    async execute(_args, exec) {
      if (!exec?.agent) throw new Error('list_member_models requires an Agent')
      return { report: JSON.stringify(await listMemberModels(ctx, exec.agent.id), null, 2) }
    }
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE_BASE}/models`,
    handler: routeHandler((body) => listMemberModels(ctx, requireText(body?.sessionId, 'sessionId')))
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE_BASE}/list`,
    handler: routeHandler(async (body) => {
      const sessionId = requireText(body?.sessionId, 'sessionId')
      return { ...listMembers(ctx, sessionId), groups: await modelGroups(ctx) }
    })
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE_BASE}/set-default`,
    handler: routeHandler((body) => setDefaultMemberModel(ctx, body))
  }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE_BASE}/select`,
    handler: routeHandler((body) => switchMemberModel(ctx, body))
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE_BASE}/select-all`,
    handler: routeHandler((body) => switchAllMemberModels(ctx, body))
  }))
  ctx.effect(() => () => {
    for (const entry of installed.values()) entry.dispose()
    installed.clear()
  })
}