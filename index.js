/**
 * dsh-prompt-optimizor — Host half.
 *
 * Owns the plugin config (through the harness `settings` service), the three
 * loopback-only HTTP routes the browser half talks to, and the two polishing
 * paths:
 *
 *   harness  — `ctx.llm.stream`, i.e. the models already configured in DSH.
 *              No API key of its own, no provider wiring.
 *   custom   — any OpenAI-compatible `/chat/completions` endpoint with a
 *              user-supplied base URL + key.
 *
 * The browser half never sees the API key: `GET /state` only reports
 * `hasApiKey`.
 */

import { createRequire } from 'node:module'
import { join } from 'node:path'

const PACKAGE_NAME = '@local/dsh-prompt-optimizor'
const BUNDLE_ID = 'dsh-prompt-optimizor'
const API_PREFIX = '/api/prompt-optimizor'
const BODY_LIMIT = 256 * 1024
const LABEL = (what) => `${BUNDLE_ID}: ${what}`

/**
 * Shipped default polishing prompt. Kept verbatim on purpose: it is the
 * behaviour contract users expect from Prompt Optimizor (compress, never
 * expand, output the prompt only).
 */
const DEFAULT_SYSTEM_PROMPT = `# Role: 你扮演的角色是：提示词精简优化专家

## Profile
- language: 中文
- description: 专注于对用户原始提示词进行轻量级、保结构的精简优化，去除冗余与重复表达，明确核心任务，使优化后的提示词长度与原始提示词基本相当
- background: 熟悉提示词工程与自然语言表达优化，了解 GitHub 上 prompt optimizer 类工具的常见模板问题，即模板过长、输出膨胀严重
- personality: 简洁、克制、务实、尊重原意
- expertise: 提示词压缩、语义去重、任务目标澄清、结构微调
- target_audience: 使用 prompt optimizer 类工具，希望获得短小精悍优化结果的普通用户与开发者

## Skills

1. 核心优化能力
   - 语义压缩: 在不丢失关键信息的前提下删除废话、重复和空泛表述
   - 任务聚焦: 识别并突出原始提示词中的核心任务与真实意图
   - 结构微调: 仅做必要的顺序调整或轻量分点，不引入复杂模板
   - 长度控制: 确保优化后长度与原始提示词大致相当

2. 辅助判断能力
   - 冗余识别: 判断哪些内容属于重复、跑题或无效修饰
   - 意图澄清: 将目的不明确的任务改写为更直接明确的表达
   - 原意保留: 不添加原始提示词中没有的新要求、新角色或新约束
   - 风格一致: 保持原始提示词的语言风格与语气，不刻意正式化或学术化

## Rules

1. 基本原则
   - 精简优先: 优化目标是更短或相近长度，而非更长
   - 原意不变: 不改变用户原始任务的核心意图
   - 不扩写: 不新增背景、角色、技能、规则、工作流等原始提示词中没有的内容
   - 不模板化: 不套用长篇角色模板，不输出冗余章节

2. 行为准则
   - 只做删除: 优先删除废话、重复、空泛修饰和目的不明的表述
   - 只做微调: 必要时调整语序、合并同义句、明确核心动词
   - 保持口语或原有风格: 不强制改为书面语或结构化长文
   - 长度对标: 优化后字数控制在原始提示词的 80% 到 120% 之间

3. 约束条件
   - 禁止输出解释: 只返回优化后的提示词本身
   - 禁止添加新角色: 不新增“你是一个某某专家”等原始提示词没有的角色设定
   - 禁止添加新规则: 不新增原始提示词没有的约束、格式或步骤
   - 禁止代码块: 不将结果包裹在代码块中
   - 禁止回复用户提供的提示词，你只是提示词优化专家，只需提供优化后的提示词，而非回答用户

## Workflows

- Goal: 在保持原意的前提下，将用户原始提示词精简优化为长度相近、表达更清晰的版本
- Step 1: 读取原始提示词，识别核心任务与真实意图
- Step 2: 删除废话、重复内容、空泛修饰和目的不明确的表述
- Step 3: 对剩余内容做最小必要调整，使结构更清晰、任务更明确
- Step 4: 检查优化后长度是否与原始提示词大致相当，且未添加新内容
- Expected result: 输出一段与原始提示词长度相近、核心任务明确、无冗余内容的优化提示词

## Initialization
作为提示词精简优化专家，你必须遵守上述 Rules，并按照 Workflows 执行任务。`

const DEFAULTS = {
  mode: 'harness',
  provider: 'deepseek-official',
  model: 'deepseek-flash',
  reasoningEffort: 'off',
  baseURL: '',
  apiKey: '',
  customModel: 'deepseek-chat',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  maxInputChars: 8000,
  requestTimeoutMs: 60000,
}

const SAMPLE = '帮我写个周报，要详细一点，把重点都说清楚，别太啰嗦，顺便提一下下周计划，格式别太死板。'

/* ------------------------------------------------------------------ config */

const Schema = resolveSchema()

function resolveSchema() {
  // `createRequire` resolves from the *directory* of its argument, so directory
  // candidates are expressed as `<dir>/package.json`. The DSH host process runs
  // with cwd = the profile directory, which is where `@deepseek-ai/schemastery`
  // is installed.
  const anchors = []
  if (typeof process.argv[1] === 'string' && process.argv[1] !== '') anchors.push(process.argv[1])
  anchors.push(join(process.cwd(), 'package.json'))
  const profileDir = process.env.DSH_PROFILE_DIR
  if (typeof profileDir === 'string' && profileDir !== '') anchors.push(join(profileDir, 'package.json'))
  anchors.push(import.meta.url)
  for (const anchor of anchors) {
    try {
      const factory = createRequire(anchor)('@deepseek-ai/schemastery')
      // schemastery's default export is the callable `Schema` itself, but the
      // cjs interop sometimes wraps it; accept both shapes.
      const object = typeof factory === 'function' || (typeof factory === 'object' && factory !== null)
      if (object && typeof factory.object === 'function') return factory
    } catch {
      /* try the next anchor */
    }
  }
  return null
}

/**
 * Mark a Config field live-editable. The settings service only exposes fields
 * whose schema node carries `meta.volatile`; without it the whole entry is
 * invisible to `describe()` and every write is refused with
 * `has no volatile fields`. DSH's schemastery build wraps such fields in a
 * cosmokit `Volatile` reference, which is what lets a saved value take effect
 * without a remount.
 */
const live = (field) => (typeof field?.volatile === 'function' ? field.volatile() : field)

const Config =
  Schema === null
    ? undefined
    : Schema.object({
        mode: live(Schema.string().default(DEFAULTS.mode)),
        provider: live(Schema.string().default(DEFAULTS.provider)),
        model: live(Schema.string().default(DEFAULTS.model)),
        reasoningEffort: live(Schema.string().default(DEFAULTS.reasoningEffort)),
        baseURL: live(Schema.string().default(DEFAULTS.baseURL)),
        apiKey: live(Schema.string().default(DEFAULTS.apiKey)),
        customModel: live(Schema.string().default(DEFAULTS.customModel)),
        systemPrompt: live(Schema.string().default(DEFAULTS.systemPrompt)),
        maxInputChars: live(Schema.number().default(DEFAULTS.maxInputChars)),
        requestTimeoutMs: live(Schema.number().default(DEFAULTS.requestTimeoutMs)),
      })

export { Config }

/* ------------------------------------------------------------------- apply */

export function apply(ctx, config) {
  ctx.inject(['settings'], (scope) => {
    const settings = scope.get('settings')
    if (settings === null || settings === undefined || typeof settings.configure !== 'function') return
    scope.effect(() => {
      // `configure` throws when a policy is already registered for this
      // instance, and a mounting plugin must never fail over a form policy.
      try {
        return settings.configure({ auto: false }, ctx.fiber)
      } catch (error) {
        console.warn(`[${BUNDLE_ID}] settings.configure failed`, error)
        return () => {}
      }
    }, LABEL('settings presentation'))
  })

  ctx.inject(['webServer'], (scope) => {
    const webServer = scope.get('webServer')
    if (webServer === null || webServer === undefined || typeof webServer.register !== 'function') return

    register(scope, webServer, `${API_PREFIX}/state`, { methods: ['GET', 'POST'] }, (req, res) =>
      handleState(ctx, config, req, res),
    )
    register(scope, webServer, `${API_PREFIX}/catalog`, { methods: ['GET'] }, (req, res) => handleCatalog(ctx, res))
    register(scope, webServer, `${API_PREFIX}/optimize`, { methods: ['POST'] }, (req, res) =>
      handleOptimize(ctx, config, req, res),
    )
    register(scope, webServer, `${API_PREFIX}/test`, { methods: ['POST'] }, (req, res) =>
      handleTest(ctx, config, req, res),
    )
  })
}

function register(scope, webServer, path, options, handler) {
  scope.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path,
        handler: async (req, res) => {
          if (!guardRequest(req, res, options.methods)) return
          try {
            await handler(req, res)
          } catch (error) {
            console.warn(`[${BUNDLE_ID}] ${req.method} ${path} failed`, error)
            sendJson(res, statusOf(error), { ok: false, error: messageOf(error) })
          }
        },
      }),
    LABEL(`route ${path}`),
  )
}

/* ------------------------------------------------------------------ routes */

async function handleState(ctx, config, req, res) {
  if (req.method === 'GET') {
    const current = await loadConfig(ctx, config)
    sendJson(res, 200, { ok: true, state: publicState(current) })
    return
  }

  const body = await readJsonBody(req)
  const patch = buildPatch(body)
  const current = await loadConfig(ctx, config)
  const merged = normalizeConfig({ ...current, ...patch })
  await saveConfig(ctx, {
    mode: merged.mode,
    provider: merged.provider,
    model: merged.model,
    reasoningEffort: merged.reasoningEffort,
    baseURL: merged.baseURL,
    customModel: merged.customModel,
    systemPrompt: merged.systemPrompt,
    maxInputChars: merged.maxInputChars,
    requestTimeoutMs: merged.requestTimeoutMs,
    ...('apiKey' in patch ? { apiKey: patch.apiKey } : {}),
  })
  sendJson(res, 200, { ok: true, state: publicState(merged) })
}

async function handleCatalog(ctx, res) {
  const catalog = await loadCatalog(ctx)
  sendJson(res, 200, { ok: true, catalog })
}

async function handleOptimize(ctx, config, req, res) {
  const body = await readJsonBody(req)
  const current = await loadConfig(ctx, config)
  const result = await optimize(ctx, current, typeof body.text === 'string' ? body.text : '')
  sendJson(res, 200, {
    ok: true,
    optimized: result.optimized,
    mode: current.mode,
    provider: current.mode === 'custom' ? 'custom' : current.provider,
    model: current.mode === 'custom' ? current.customModel : current.model,
    elapsedMs: result.elapsedMs,
  })
}

async function handleTest(ctx, config, req, res) {
  let body = {}
  try {
    body = await readJsonBody(req)
  } catch {
    body = {}
  }
  const current = await loadConfig(ctx, config)
  const sample = typeof body.sample === 'string' && body.sample.trim() !== '' ? body.sample : SAMPLE
  const result = await optimize(ctx, current, sample)
  sendJson(res, 200, {
    ok: true,
    source: sample,
    optimized: result.optimized,
    mode: current.mode,
    provider: current.mode === 'custom' ? 'custom' : current.provider,
    model: current.mode === 'custom' ? current.customModel : current.model,
    elapsedMs: result.elapsedMs,
  })
}

/* ------------------------------------------------------------ config store */

function normalizeConfig(input) {
  const source = input !== null && typeof input === 'object' ? input : {}
  const str = (key) => (source[key] === undefined || source[key] === null ? DEFAULTS[key] : String(source[key]))
  const mode = str('mode') === 'custom' ? 'custom' : 'harness'
  const provider = str('provider').trim() === '' ? DEFAULTS.provider : str('provider').trim()
  const model = str('model').trim() === '' ? DEFAULTS.model : str('model').trim()
  const systemPrompt = str('systemPrompt').trim() === '' ? DEFAULT_SYSTEM_PROMPT : String(source.systemPrompt ?? DEFAULTS.systemPrompt)
  return {
    mode,
    provider,
    model,
    reasoningEffort: str('reasoningEffort').trim(),
    baseURL: str('baseURL').trim(),
    apiKey: str('apiKey'),
    customModel: str('customModel').trim() === '' ? DEFAULTS.customModel : str('customModel').trim(),
    systemPrompt,
    maxInputChars: clampInt(source.maxInputChars, 200, 200000, DEFAULTS.maxInputChars),
    requestTimeoutMs: clampInt(source.requestTimeoutMs, 5000, 600000, DEFAULTS.requestTimeoutMs),
  }
}

function clampInt(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function buildPatch(body) {
  const patch = {}
  const strings = ['provider', 'model', 'reasoningEffort', 'baseURL', 'customModel']
  if (body.mode !== undefined) patch.mode = body.mode === 'custom' ? 'custom' : 'harness'
  for (const key of strings) {
    if (body[key] !== undefined && body[key] !== null) patch[key] = String(body[key]).trim()
  }
  if (body.systemPrompt !== undefined && body.systemPrompt !== null) patch.systemPrompt = String(body.systemPrompt)
  if (body.maxInputChars !== undefined) patch.maxInputChars = clampInt(body.maxInputChars, 200, 200000, DEFAULTS.maxInputChars)
  if (body.requestTimeoutMs !== undefined) {
    patch.requestTimeoutMs = clampInt(body.requestTimeoutMs, 5000, 600000, DEFAULTS.requestTimeoutMs)
  }
  if (body.clearApiKey === true) patch.apiKey = ''
  else if (typeof body.apiKey === 'string' && body.apiKey !== '') patch.apiKey = body.apiKey
  return patch
}

function publicState(cfg) {
  return {
    mode: cfg.mode,
    provider: cfg.provider,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
    baseURL: cfg.baseURL,
    customModel: cfg.customModel,
    systemPrompt: cfg.systemPrompt,
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    hasApiKey: cfg.apiKey !== '',
    maxInputChars: cfg.maxInputChars,
    requestTimeoutMs: cfg.requestTimeoutMs,
  }
}

function findDescriptor(ctx) {
  const settings = ctx.get('settings')
  if (settings === null || settings === undefined || typeof settings.describe !== 'function') return undefined
  let list
  try {
    list = settings.describe()
  } catch {
    return undefined
  }
  if (!Array.isArray(list)) return undefined
  const names = [BUNDLE_ID, PACKAGE_NAME]
  return list.find((entry) => {
    const ns = entry?.ns
    if (typeof ns !== 'string') return false
    return names.some((name) => ns === name || ns.endsWith(`:${name}`) || ns.endsWith(`/${name}`))
  })
}

async function loadConfig(ctx, fallback) {
  const descriptor = findDescriptor(ctx)
  if (descriptor === undefined) return normalizeConfig(fallback)
  return normalizeConfig(descriptor.value ?? fallback)
}

async function saveConfig(ctx, patch) {
  const settings = ctx.get('settings')
  const descriptor = findDescriptor(ctx)
  if (descriptor === undefined || settings === null || settings === undefined || typeof settings.update !== 'function') {
    const error = new Error('未找到本插件的配置命名空间，无法保存。请在插件页确认插件已安装后重试。')
    error.status = 501
    throw error
  }
  await settings.update(descriptor.ns, patch, descriptor.revision)
}

/* ----------------------------------------------------------------- polish */

async function optimize(ctx, cfg, text) {
  const input = String(text ?? '')
  if (input.trim() === '') throw badRequest('输入框是空的，先写点内容再优化。')
  if (input.length > cfg.maxInputChars) {
    throw badRequest(`草稿 ${input.length} 字，超过上限 ${cfg.maxInputChars} 字；请缩短内容，或在插件设置里调大上限。`)
  }
  const signal = AbortSignal.timeout(Math.max(5000, cfg.requestTimeoutMs))
  const startedAt = Date.now()
  const raw =
    cfg.mode === 'custom'
      ? await polishWithCustomEndpoint(cfg, input, signal)
      : await polishWithHarnessModel(ctx, cfg, input, signal)
  const optimized = postProcess(raw)
  if (optimized === '') {
    const error = new Error('模型没有返回任何内容，请检查润色提示词与模型。')
    error.status = 502
    throw error
  }
  return { optimized, elapsedMs: Date.now() - startedAt }
}

async function polishWithHarnessModel(ctx, cfg, text, signal) {
  const llm = ctx.get('llm')
  if (llm === null || llm === undefined || typeof llm.stream !== 'function') {
    const error = new Error('当前框架没有可用的模型服务（ctx.llm），请改用自定义 API 模式。')
    error.status = 501
    throw error
  }
  const provider = cfg.provider
  const model = cfg.model
  if (provider === '' || model === '') throw badRequest('还没有选择润色模型，请到插件设置里选一个。')

  const options = {
    provider,
    model,
    system: cfg.systemPrompt,
    temperature: 0.3,
    maxTokens: Math.min(4096, Math.max(512, Math.round(text.length * 2.2) + 320)),
    signal,
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
  }
  const effort = await resolveEffort(llm, provider, model, cfg.reasoningEffort)
  if (effort !== undefined) options.reasoningEffort = effort

  let output = ''
  let failure
  try {
    for await (const chunk of llm.stream(options)) {
      if (chunk === null || typeof chunk !== 'object') continue
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
        output += chunk.text
        continue
      }
      if (chunk.type === 'finish') {
        const reason = chunk.reason
        if (reason !== null && typeof reason === 'object' && (reason.kind === 'error' || reason.kind === 'aborted')) {
          failure = reason.failure ?? { message: reason.kind }
        }
      }
    }
  } catch (error) {
    if (isAbort(error)) throw timeoutError()
    throw error
  }
  if (failure !== undefined) {
    const detail = failure.message ?? failure.code ?? '未知错误'
    const error = new Error(`模型调用失败：${detail}`)
    error.status = 502
    throw error
  }
  return output
}

async function resolveEffort(llm, provider, model, wanted) {
  if (typeof wanted !== 'string' || wanted.trim() === '') return undefined
  if (typeof llm.resolveModelInfo !== 'function') return undefined
  try {
    const info = await llm.resolveModelInfo(provider, model)
    const efforts = info?.reasoning?.efforts
    if (!Array.isArray(efforts) || efforts.length === 0) return undefined
    const ids = efforts.map((entry) => entry?.id).filter((id) => typeof id === 'string')
    if (ids.includes(wanted)) return wanted
    const fallback = info?.reasoning?.defaultEffort
    return typeof fallback === 'string' ? fallback : undefined
  } catch {
    return undefined
  }
}

async function polishWithCustomEndpoint(cfg, text, signal) {
  const url = chatCompletionsUrl(cfg.baseURL)
  if (url === undefined) throw badRequest('请填写自定义 API 地址，例如 https://api.openai.com/v1。')
  if (cfg.apiKey === '') throw badRequest('请填写自定义 API Key。')

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.customModel,
        messages: [
          { role: 'system', content: cfg.systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        stream: false,
      }),
      signal,
    })
  } catch (error) {
    if (isAbort(error)) throw timeoutError()
    const failure = new Error(`连接自定义 API 失败：${messageOf(error)}`)
    failure.status = 502
    throw failure
  }

  const raw = await response.text()
  if (!response.ok) {
    const error = new Error(`自定义 API 返回 HTTP ${response.status}：${raw.slice(0, 300)}`)
    error.status = 502
    throw error
  }
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    const error = new Error(`自定义 API 返回的不是 JSON：${raw.slice(0, 200)}`)
    error.status = 502
    throw error
  }
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : (part?.text ?? ''))).join('')
  }
  const error = new Error('自定义 API 的响应里没有 choices[0].message.content。')
  error.status = 502
  throw error
}

function chatCompletionsUrl(baseURL) {
  const trimmed = String(baseURL ?? '').trim()
  if (trimmed === '') return undefined
  const withoutSlash = trimmed.replace(/\/+$/, '')
  const full = /\/chat\/completions$/.test(withoutSlash) ? withoutSlash : `${withoutSlash}/chat/completions`
  try {
    const parsed = new URL(full)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return parsed.toString()
  } catch {
    return undefined
  }
}

function postProcess(value) {
  let text = String(value ?? '').trim()
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(text)
  if (fenced !== null) text = fenced[1].trim()
  text = text.replace(/^(优化后的提示词|优化后的|优化后|改写后的提示词|润色后的提示词)\s*[:：]\s*/, '')
  return text.trim()
}

/* ---------------------------------------------------------------- catalog */

let catalogCache = { at: 0, value: undefined }

async function loadCatalog(ctx) {
  const now = Date.now()
  if (catalogCache.value !== undefined && now - catalogCache.at < 60000) return catalogCache.value
  const llm = ctx.get('llm')
  if (llm === null || llm === undefined || typeof llm.listProviders !== 'function') return []
  let providers = []
  try {
    providers = llm.listProviders() ?? []
  } catch {
    providers = []
  }
  const catalog = []
  for (const provider of providers) {
    const id = typeof provider?.id === 'string' ? provider.id : undefined
    if (id === undefined) continue
    let models = []
    if (typeof llm.listModels === 'function') {
      try {
        models = (await withTimeout(llm.listModels(id), 8000)) ?? []
      } catch {
        models = []
      }
    }
    catalog.push({
      id,
      name: typeof provider.name === 'string' ? provider.name : id,
      models: models
        .filter((model) => typeof model?.id === 'string')
        .map((model) => ({ id: model.id, name: typeof model.name === 'string' ? model.name : model.id })),
    })
  }
  catalogCache = { at: now, value: catalog }
  return catalog
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/* ------------------------------------------------------------- http plumbing */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function hostNameOf(host) {
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    if (end > 0) return host.slice(1, end).toLowerCase()
  }
  const colon = host.indexOf(':')
  return (colon === -1 ? host : host.slice(0, colon)).toLowerCase()
}

function isLoopbackPeer(req) {
  const address = req.socket?.remoteAddress
  if (typeof address !== 'string') return false
  return address === '::1' || address.startsWith('127.') || address.startsWith('::ffff:127.')
}

function isLoopbackHost(req) {
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return true
  const name = hostNameOf(host)
  if (name === '' || name === 'localhost' || name === '::1') return true
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name)
}

function isLoopbackOrigin(origin) {
  if (typeof origin !== 'string' || origin === '') return true
  try {
    const raw = new URL(origin).hostname
    const host = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw
    return host === 'localhost' || host === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  } catch {
    return false
  }
}

function guardRequest(req, res, methods) {
  const method = typeof req.method === 'string' ? req.method : ''
  if (!methods.includes(method)) {
    sendJson(res, 405, { ok: false, error: `method ${method} not allowed` })
    return false
  }
  if (!isLoopbackPeer(req) || !isLoopbackHost(req) || !isLoopbackOrigin(req.headers.origin)) {
    sendJson(res, 403, { ok: false, error: 'forbidden: loopback only' })
    return false
  }
  if (method === 'POST') {
    const type = String(req.headers['content-type'] ?? '').toLowerCase()
    if (!type.includes('application/json')) {
      sendJson(res, 415, { ok: false, error: 'content-type must be application/json' })
      return false
    }
  }
  return true
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) throw payloadTooLarge()
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    const parsed = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw badRequest('请求体不是合法 JSON。')
  }
}

/* ------------------------------------------------------------------ errors */

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

function payloadTooLarge() {
  const error = new Error('请求体过大。')
  error.status = 413
  return error
}

function timeoutError() {
  const error = new Error('请求超时，请稍后重试或在插件设置里调大超时时间。')
  error.status = 504
  return error
}

function isAbort(error) {
  const name = error?.name
  return name === 'AbortError' || name === 'TimeoutError'
}

function statusOf(error) {
  const status = error?.status
  return typeof status === 'number' && status >= 400 && status <= 599 ? status : 500
}

function messageOf(error) {
  if (error === null || error === undefined) return '未知错误'
  if (typeof error === 'string') return error
  if (isAbort(error)) return '请求超时或已取消。'
  if (typeof error.message === 'string' && error.message !== '') return error.message
  return String(error)
}
