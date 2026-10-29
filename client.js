/**
 * dsh-prompt-optimizor — Browser half.
 *
 * Two contributions:
 *   conversation.input.right  — the one-click polish button, next to the
 *                               composer submit action.
 *   plugins.bundle.config     — the settings page for this bundle.
 *
 * Everything talks to the Host half over loopback HTTP; the API key never
 * leaves the Host.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-prompt-optimizor',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const module = { exports: {} }

    const PACKAGE_NAME = '@local/dsh-prompt-optimizor'
    const API = '/api/prompt-optimizor'
    const BUTTON_SLOT = 'conversation.input.right'
    const SETTINGS_SLOT = 'plugins.bundle.config'
    const ICON = 'dsh-po'

    /* ------------------------------------------------------------- styles */

    const CSS = `
.dsh-po-wrap { position: relative; display: inline-flex; align-items: center; }
.dsh-po-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0; margin: 0; border-radius: 8px;
  border: 1px solid transparent; background: transparent;
  color: var(--dsw-alias-label-tertiary); cursor: pointer;
  transition: color .12s ease, background-color .12s ease, border-color .12s ease;
  -webkit-tap-highlight-color: transparent;
}
.dsh-po-btn:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.dsh-po-btn:active { background: var(--dsw-alias-interactive-bg-active); }
.dsh-po-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsh-po-btn.is-busy { color: var(--dsw-alias-brand-primary); cursor: progress; }
.dsh-po-btn.is-active {
  color: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover-accent);
}
.dsh-po-spinner {
  display: block; width: 13px; height: 13px; border-radius: 50%;
  border: 1.6px solid currentColor; border-right-color: transparent;
  animation: dsh-po-spin .7s linear infinite;
}
@keyframes dsh-po-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .dsh-po-spinner { animation-duration: 2s; } }
.dsh-po-hint {
  position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 40;
  max-width: 280px; padding: 6px 9px; border-radius: 8px;
  font-size: 12px; line-height: 1.45; white-space: normal; width: max-content;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-3);
  border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: 0 6px 20px rgba(0, 0, 0, .12);
}
.dsh-po-settings { display: flex; flex-direction: column; gap: 18px; padding: 4px 0 8px; }
.dsh-po-section { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.dsh-po-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.dsh-po-section-title { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dsh-po-meta { font-size: 12px; color: var(--dsw-alias-label-tertiary); line-height: 1.5; }
.dsh-po-row { display: flex; flex-direction: column; gap: 5px; }
.dsh-po-label { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh-po-input, .dsh-po-select, .dsh-po-textarea {
  width: 100%; box-sizing: border-box; font-size: 13px; line-height: 1.5;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 7px 9px;
  font-family: inherit;
}
.dsh-po-input:focus, .dsh-po-select:focus, .dsh-po-textarea:focus {
  outline: none; border-color: var(--dsw-alias-brand-primary);
}
.dsh-po-textarea { resize: vertical; min-height: 140px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.dsh-po-inline { display: flex; gap: 10px; align-items: center; }
.dsh-po-inline > .dsh-po-row { flex: 1 1 0; min-width: 0; }
.dsh-po-radio-group { display: flex; gap: 8px; flex-wrap: wrap; }
.dsh-po-radio {
  display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; font-size: 13px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-base);
}
.dsh-po-radio.is-selected { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover-accent); }
.dsh-po-radio input { margin: 0; accent-color: var(--dsw-alias-brand-primary); }
.dsh-po-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.dsh-po-btn-primary, .dsh-po-btn-ghost {
  font-size: 13px; padding: 7px 15px; border-radius: 8px; cursor: pointer;
  border: 1px solid transparent; transition: opacity .12s ease, background-color .12s ease;
}
.dsh-po-btn-primary { color: var(--dsw-alias-button-info-label, #fff); background: var(--dsw-alias-brand-primary); font-weight: 600; }
.dsh-po-btn-primary:hover { opacity: .9; }
.dsh-po-btn-primary:disabled { opacity: .5; cursor: default; }
.dsh-po-btn-ghost { color: var(--dsw-alias-label-secondary); background: transparent; border-color: var(--dsw-alias-border-l2); }
.dsh-po-btn-ghost:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.dsh-po-status { font-size: 12px; line-height: 1.5; }
.dsh-po-status.is-ok { color: var(--dsw-alias-state-success-primary); }
.dsh-po-status.is-error { color: var(--dsw-alias-state-error-primary); }
.dsh-po-status.is-busy { color: var(--dsw-alias-label-tertiary); }
.dsh-po-pre {
  margin: 0; padding: 10px 12px; border-radius: 8px; max-height: 220px; overflow: auto;
  white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.6;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l1);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.dsh-po-tag { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px;
  color: var(--dsw-alias-label-tertiary); border: 1px solid var(--dsw-alias-border-l1); }
`

    function ensureStyles() {
      const doc = globalThis.document
      if (doc === null || doc === undefined) return
      const existing = doc.head?.querySelector?.(`style[data-plugin="${ICON}-css"]`)
      if (existing !== null && existing !== undefined) return
      const tag = doc.createElement('style')
      tag.dataset.plugin = `${ICON}-css`
      tag.textContent = CSS
      doc.head?.appendChild?.(tag)
    }

    /* --------------------------------------------------------- http helper */

    function apiUrl(path) {
      const doc = globalThis.document
      const baseURI = doc?.baseURI
      if (typeof baseURI !== 'string' || baseURI === '') return path
      try {
        const base = new URL(baseURI)
        const prefix = base.pathname.endsWith('/') ? base.pathname.replace(/\/+$/, '') : ''
        return `${base.origin}${prefix}${path}`
      } catch {
        return path
      }
    }

    async function requestJson(path, init) {
      const response = await fetch(apiUrl(`${API}${path}`), {
        headers: { 'content-type': 'application/json' },
        ...init,
      })
      let payload = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
      if (!response.ok || payload === null || payload.ok !== true) {
        const message = payload?.error ?? `请求失败（HTTP ${response.status}）`
        throw new Error(String(message))
      }
      return payload
    }

    const getJson = (path) => requestJson(path, { method: 'GET' })
    const postJson = (path, body) => requestJson(path, { method: 'POST', body: JSON.stringify(body ?? {}) })

    function messageOf(error) {
      if (error === null || error === undefined) return '未知错误'
      if (typeof error === 'string') return error
      return typeof error.message === 'string' && error.message !== '' ? error.message : String(error)
    }

    /* ------------------------------------------------------------- button */

    const fallbackUseInput = (selector) => selector({ draft: '' })
    const selectDraft = (state) => (state !== null && state !== undefined && typeof state.draft === 'string' ? state.draft : '')

    function SparkleIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': 'true', focusable: 'false' },
        h('path', {
          d: 'M5.6 1.4l1.15 3.05L9.8 5.6 6.75 6.75 5.6 9.8 4.45 6.75 1.4 5.6 4.45 4.45z',
          fill: 'currentColor',
        }),
        h('path', {
          d: 'M11.5 8.2l.75 1.95 1.95.75-1.95.75-.75 1.95-.75-1.95L8.8 10.9l1.95-.75z',
          fill: 'currentColor',
          opacity: 0.85,
        }),
      )
    }

    function OptimizorButton(props) {
      const inputActions = props?.inputActions
      const sessionId = props?.sessionId
      const useInput = typeof props?.useInput === 'function' ? props.useInput : fallbackUseInput
      const draft = useInput(selectDraft)

      const [phase, setPhase] = React.useState('idle')
      const [hint, setHint] = React.useState('')

      const draftRef = React.useRef(draft)
      draftRef.current = draft
      const originalRef = React.useRef('')
      const optimizedRef = React.useRef('')
      const abortRef = React.useRef(null)
      const aliveRef = React.useRef(true)
      const hintTimer = React.useRef(null)

      const showHint = React.useCallback((message) => {
        setHint(message)
        if (hintTimer.current !== null) clearTimeout(hintTimer.current)
        hintTimer.current = setTimeout(() => {
          hintTimer.current = null
          if (aliveRef.current) setHint('')
        }, 4000)
      }, [])

      React.useEffect(() => {
        aliveRef.current = true
        return () => {
          aliveRef.current = false
          if (hintTimer.current !== null) clearTimeout(hintTimer.current)
          abortRef.current?.abort?.()
          abortRef.current = null
        }
      }, [])

      React.useEffect(() => {
        originalRef.current = ''
        optimizedRef.current = ''
        abortRef.current?.abort?.()
        abortRef.current = null
        setPhase('idle')
      }, [sessionId])

      const notify = React.useCallback(
        (message) => {
          showHint(message)
          try {
            inputActions?.notify?.('error', message)
          } catch {
            /* the notify bridge is optional; the local hint is the fallback */
          }
        },
        [inputActions, showHint],
      )

      const onClick = React.useCallback(async () => {
        const setDraft = typeof inputActions?.setDraft === 'function' ? inputActions.setDraft.bind(inputActions) : undefined
        if (setDraft === undefined) {
          notify('当前界面不支持替换输入框内容。')
          return
        }

        if (phase === 'running') {
          abortRef.current?.abort?.()
          abortRef.current = null
          setPhase('idle')
          return
        }

        const current = draftRef.current ?? ''

        if (phase === 'optimized' && current === optimizedRef.current) {
          setDraft(originalRef.current)
          optimizedRef.current = ''
          setPhase('idle')
          return
        }

        if (current.trim() === '') {
          notify('输入框是空的，先写点内容再优化。')
          return
        }
        if (current.includes('\uFFFC')) {
          notify('草稿里含附件或 @ 引用，请先移除后再优化。')
          return
        }

        originalRef.current = current
        optimizedRef.current = ''
        setPhase('running')
        const controller = new AbortController()
        abortRef.current = controller

        try {
          const payload = await postJson('/optimize', { text: current })
          if (controller.signal.aborted || !aliveRef.current) return
          const optimized = String(payload.optimized ?? '')
          if (optimized.trim() === '') throw new Error('模型没有返回内容。')
          if ((draftRef.current ?? '') !== current) throw new Error('草稿已被修改，本次结果没有写入。')
          optimizedRef.current = optimized
          setDraft(optimized)
          setPhase('optimized')
        } catch (error) {
          if (controller.signal.aborted) {
            setPhase('idle')
            return
          }
          if (!aliveRef.current) return
          setPhase('idle')
          notify(messageOf(error))
        } finally {
          if (abortRef.current === controller) abortRef.current = null
        }
      }, [inputActions, notify, phase])

      const title =
        phase === 'running' ? '正在优化…（再点一次取消）' : phase === 'optimized' ? '恢复原始提示词' : '优化提示词'

      return h(
        'span',
        { className: 'dsh-po-wrap' },
        hint === '' ? null : h('span', { className: 'dsh-po-hint', role: 'status' }, hint),
        h(
          'button',
          {
            type: 'button',
            className: `dsh-po-btn${phase === 'running' ? ' is-busy' : ''}${phase === 'optimized' ? ' is-active' : ''}`,
            title,
            'aria-label': title,
            'aria-busy': phase === 'running' ? 'true' : 'false',
            'data-state': phase,
            onClick,
          },
          phase === 'running' ? h('span', { className: 'dsh-po-spinner' }) : h(SparkleIcon),
        ),
      )
    }

    /* ----------------------------------------------------------- settings */

    const EFFORT_OPTIONS = [
      { value: '', label: '模型默认' },
      { value: 'off', label: 'off（关闭思考）' },
      { value: 'low', label: 'low' },
      { value: 'high', label: 'high' },
      { value: 'max', label: 'max' },
    ]

    function toForm(state) {
      return {
        mode: state.mode === 'custom' ? 'custom' : 'harness',
        provider: typeof state.provider === 'string' ? state.provider : '',
        model: typeof state.model === 'string' ? state.model : '',
        reasoningEffort: typeof state.reasoningEffort === 'string' ? state.reasoningEffort : '',
        baseURL: typeof state.baseURL === 'string' ? state.baseURL : '',
        customModel: typeof state.customModel === 'string' ? state.customModel : '',
        apiKey: '',
        systemPrompt: typeof state.systemPrompt === 'string' ? state.systemPrompt : '',
        maxInputChars: String(state.maxInputChars ?? ''),
        requestTimeoutMs: String(state.requestTimeoutMs ?? ''),
      }
    }

    function SettingsPanel() {
      const [state, setState] = React.useState(null)
      const [form, setForm] = React.useState(null)
      const [catalog, setCatalog] = React.useState([])
      const [catalogFailed, setCatalogFailed] = React.useState(false)
      const [clearKey, setClearKey] = React.useState(false)
      const [status, setStatus] = React.useState({ kind: 'idle', message: '' })
      const [testResult, setTestResult] = React.useState(null)
      const [loading, setLoading] = React.useState(true)

      const aliveRef = React.useRef(true)
      React.useEffect(() => {
        aliveRef.current = true
        return () => {
          aliveRef.current = false
        }
      }, [])

      React.useEffect(() => {
        let mounted = true
        ;(async () => {
          try {
            const statePayload = await getJson('/state')
            if (!mounted) return
            setState(statePayload.state)
            setForm(toForm(statePayload.state))
          } catch (error) {
            if (!mounted) return
            setStatus({ kind: 'error', message: `读取设置失败：${messageOf(error)}` })
          } finally {
            if (mounted) setLoading(false)
          }
          try {
            const catalogPayload = await getJson('/catalog')
            if (!mounted) return
            setCatalog(Array.isArray(catalogPayload.catalog) ? catalogPayload.catalog : [])
          } catch {
            if (mounted) setCatalogFailed(true)
          }
        })()
        return () => {
          mounted = false
        }
      }, [])

      const setField = (key) => (value) => setForm((previous) => (previous === null ? previous : { ...previous, [key]: value }))

      const providers = React.useMemo(() => catalog.filter((entry) => entry && typeof entry.id === 'string'), [catalog])
      const models = React.useMemo(() => {
        if (form === null) return []
        const match = providers.find((entry) => entry.id === form.provider)
        return Array.isArray(match?.models) ? match.models : []
      }, [form, providers])

      const onProviderChange = (providerId) => {
        const match = providers.find((entry) => entry.id === providerId)
        const firstModel = Array.isArray(match?.models) && match.models.length > 0 ? match.models[0].id : ''
        setForm((previous) => (previous === null ? previous : { ...previous, provider: providerId, model: firstModel }))
      }

      const baseline = state === null ? null : JSON.stringify(toForm(state))
      const dirty = form !== null && baseline !== null && JSON.stringify(form) !== baseline && !clearKey

      const save = React.useCallback(
        async (options) => {
          if (form === null) return false
          const silent = options?.silent === true
          if (!silent) setStatus({ kind: 'busy', message: '保存中…' })
          const body = {
            mode: form.mode,
            provider: form.provider,
            model: form.model,
            reasoningEffort: form.reasoningEffort,
            baseURL: form.baseURL,
            customModel: form.customModel,
            systemPrompt: form.systemPrompt,
            maxInputChars: Number.parseInt(form.maxInputChars, 10) || 8000,
            requestTimeoutMs: Number.parseInt(form.requestTimeoutMs, 10) || 60000,
          }
          if (form.apiKey !== '') body.apiKey = form.apiKey
          if (clearKey) body.clearApiKey = true
          try {
            const payload = await postJson('/state', body)
            if (!aliveRef.current) return true
            setState(payload.state)
            setForm(toForm(payload.state))
            setClearKey(false)
            if (!silent) setStatus({ kind: 'ok', message: '已保存。' })
            return true
          } catch (error) {
            if (aliveRef.current) setStatus({ kind: 'error', message: `保存失败：${messageOf(error)}` })
            return false
          }
        },
        [form, clearKey],
      )

      const runTest = React.useCallback(async () => {
        setStatus({ kind: 'busy', message: '正在调用模型…' })
        setTestResult(null)
        const ok = await save({ silent: true })
        if (!ok) return
        try {
          const payload = await postJson('/test', {})
          if (!aliveRef.current) return
          setTestResult(payload)
          setStatus({ kind: 'ok', message: `调用成功，用时 ${payload.elapsedMs ?? '?'} ms。` })
        } catch (error) {
          if (!aliveRef.current) return
          setStatus({ kind: 'error', message: `调用失败：${messageOf(error)}` })
        }
      }, [save])

      if (loading) return h('div', { className: 'dsh-po-settings' }, h('div', { className: 'dsh-po-meta' }, '加载中…'))
      if (form === null) {
        return h(
          'div',
          { className: 'dsh-po-settings' },
          h('div', { className: 'dsh-po-section' }, h('div', { className: 'dsh-po-status is-error' }, status.message || '读取设置失败。')),
        )
      }

      const section = (title, note, children) =>
        h(
          'div',
          { className: 'dsh-po-section' },
          h(
            'div',
            { className: 'dsh-po-section-head' },
            h('span', { className: 'dsh-po-section-title' }, title),
            note === undefined ? null : h('span', { className: 'dsh-po-meta' }, note),
          ),
          ...children,
        )

      const row = (label, control) =>
        h('div', { className: 'dsh-po-row' }, h('label', { className: 'dsh-po-label' }, label), control)

      const input = (key, extra) =>
        h('input', {
          className: 'dsh-po-input',
          value: form[key],
          onChange: (event) => setField(key)(event.target.value),
          ...extra,
        })

      const radio = (value, label, note) =>
        h(
          'label',
          { className: `dsh-po-radio${form.mode === value ? ' is-selected' : ''}` },
          h('input', {
            type: 'radio',
            name: 'dsh-po-mode',
            checked: form.mode === value,
            onChange: () => setField('mode')(value),
          }),
          h('span', {}, label),
          note === undefined ? null : h('span', { className: 'dsh-po-meta' }, note),
        )

      const harnessSection = section('内置模型', '使用 DSH 已配置的模型服务，无需填 API Key', [
        h(
          'div',
          { className: 'dsh-po-radio-group' },
          radio('harness', 'DSH 内置模型'),
          radio('custom', '自定义 OpenAI 兼容 API'),
        ),
        form.mode !== 'harness'
          ? h('div', { className: 'dsh-po-meta' }, '当前使用自定义 API，下面的内置模型选项不会生效。')
          : null,
        providers.length === 0
          ? h('div', { className: 'dsh-po-meta' }, catalogFailed ? '模型列表读取失败，可手工填写 provider / model。' : '没有读到模型列表，可手工填写 provider / model。')
          : null,
        providers.length === 0
          ? h(
              'div',
              { className: 'dsh-po-inline' },
              row('provider', input('provider', { placeholder: 'deepseek-official' })),
              row('model', input('model', { placeholder: 'deepseek-flash' })),
            )
          : h(
              'div',
              { className: 'dsh-po-inline' },
              row(
                'provider',
                h(
                  'select',
                  {
                    className: 'dsh-po-select',
                    value: form.provider,
                    onChange: (event) => onProviderChange(event.target.value),
                  },
                  providers.map((entry) => h('option', { key: entry.id, value: entry.id }, entry.name ?? entry.id)),
                ),
              ),
              row(
                'model',
                h(
                  'select',
                  {
                    className: 'dsh-po-select',
                    value: form.model,
                    onChange: (event) => setField('model')(event.target.value),
                  },
                  (models.length > 0 ? models : [{ id: form.model, name: form.model }])
                    .filter((entry) => typeof entry?.id === 'string' && entry.id !== '')
                    .map((entry) => h('option', { key: entry.id, value: entry.id }, entry.name ?? entry.id)),
                ),
              ),
            ),
        row(
          '推理等级',
          h(
            'select',
            {
              className: 'dsh-po-select',
              value: form.reasoningEffort,
              onChange: (event) => setField('reasoningEffort')(event.target.value),
            },
            EFFORT_OPTIONS.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
          ),
        ),
        h('div', { className: 'dsh-po-meta' }, '模型不支持所选等级时会自动回退到该模型的默认等级；选「模型默认」则不做任何指定。'),
      ])

      const customSection = section('自定义 API', '任何兼容 POST {base}/chat/completions 的服务都能用', [
        row('Base URL', input('baseURL', { placeholder: 'https://api.deepseek.com/v1' })),
        row('模型名', input('customModel', { placeholder: 'deepseek-chat' })),
        row(
          'API Key',
          h('input', {
            className: 'dsh-po-input',
            type: 'password',
            autoComplete: 'off',
            value: form.apiKey,
            placeholder: state?.hasApiKey === true ? '已保存，留空表示保持不变' : '尚未设置',
            onChange: (event) => setField('apiKey')(event.target.value),
          }),
        ),
        h(
          'div',
          { className: 'dsh-po-inline' },
          h(
            'label',
            { className: 'dsh-po-radio' },
            h('input', {
              type: 'checkbox',
              checked: clearKey,
              onChange: (event) => setClearKey(event.target.checked),
            }),
            h('span', {}, '清除已保存的 Key'),
          ),
          h('span', { className: 'dsh-po-tag' }, state?.hasApiKey === true ? 'Key 已保存' : '未保存 Key'),
        ),
        h('div', { className: 'dsh-po-meta' }, 'Key 只保存在本机 DSH 配置里，接口不会把它回传给页面。'),
      ])

      const promptSection = section('润色提示词', `${form.systemPrompt.length} 字`, [
        h('textarea', {
          className: 'dsh-po-textarea',
          value: form.systemPrompt,
          spellCheck: false,
          onChange: (event) => setField('systemPrompt')(event.target.value),
        }),
        h(
          'div',
          { className: 'dsh-po-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-po-btn-ghost',
              onClick: () => setField('systemPrompt')(state?.defaultSystemPrompt ?? ''),
            },
            '恢复默认提示词',
          ),
          h('span', { className: 'dsh-po-meta' }, '留空并保存时会自动回落到默认提示词。'),
        ),
      ])

      const limitsSection = section('限制', undefined, [
        h(
          'div',
          { className: 'dsh-po-inline' },
          row('单次最多字数', input('maxInputChars', { type: 'number', min: 200, max: 200000, step: 100 })),
          row('请求超时（毫秒）', input('requestTimeoutMs', { type: 'number', min: 5000, max: 600000, step: 1000 })),
        ),
      ])

      const statusClass =
        status.kind === 'ok' ? 'is-ok' : status.kind === 'error' ? 'is-error' : status.kind === 'busy' ? 'is-busy' : ''

      return h(
        'div',
        { className: 'dsh-po-settings' },
        h(
          'div',
          { className: 'dsh-po-meta' },
          '输入框右下角的 ✦ 按钮会用这里的模型与提示词改写草稿，再点一次还原原文。',
        ),
        harnessSection,
        customSection,
        promptSection,
        limitsSection,
        h(
          'div',
          { className: 'dsh-po-actions' },
          h(
            'button',
            { type: 'button', className: 'dsh-po-btn-primary', disabled: status.kind === 'busy', onClick: () => save({}) },
            dirty ? '保存修改' : '保存',
          ),
          h(
            'button',
            { type: 'button', className: 'dsh-po-btn-ghost', disabled: status.kind === 'busy', onClick: runTest },
            '保存并测试',
          ),
          status.message === '' ? null : h('span', { className: `dsh-po-status ${statusClass}` }, status.message),
        ),
        testResult === null
          ? null
          : h(
              'div',
              { className: 'dsh-po-section' },
              h(
                'div',
                { className: 'dsh-po-section-head' },
                h('span', { className: 'dsh-po-section-title' }, '测试结果'),
                h('span', { className: 'dsh-po-meta' }, `${testResult.provider ?? ''} / ${testResult.model ?? ''}`),
              ),
              h('div', { className: 'dsh-po-meta' }, '原文'),
              h('pre', { className: 'dsh-po-pre' }, String(testResult.source ?? '')),
              h('div', { className: 'dsh-po-meta' }, '优化后'),
              h('pre', { className: 'dsh-po-pre' }, String(testResult.optimized ?? '')),
            ),
      )
    }

    function SettingsEntry(props) {
      if (props !== null && props !== undefined && props.view === 'summary') return null
      return h(SettingsPanel, null)
    }

    /* ------------------------------------------------------------- exports */

    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === null || slots === undefined) return
      ensureStyles()

      ctx.effect(
        () =>
          slots.inject(BUTTON_SLOT, () =>
            slots.register({ name: BUTTON_SLOT, id: 'dsh-prompt-optimizor/button', order: 10 }, OptimizorButton),
          ),
        'dsh-prompt-optimizor: composer button',
      )

      ctx.effect(
        () => slots.inject(SETTINGS_SLOT, () => slots.register({ name: SETTINGS_SLOT, key: PACKAGE_NAME }, SettingsEntry)),
        'dsh-prompt-optimizor: settings page',
      )
    }

    module.exports = { inject: ['slots'], apply }
    return module.exports
  },
})
