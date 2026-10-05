/**
 * Browser half of `dsh-team-model-switcher`.
 *
 * Adds one compact control to the conversation header: it lists the live Agent
 * Teams roster of the current Lead session and lets the user pick, per teammate,
 * the model and the reasoning effort it uses from its next request on. It talks
 * to the Host half through the two plain JSON routes that plugin registers on
 * the Web carrier.
 *
 * The bundle is a prebuilt DSH client module: it registers a factory on
 * `window.__ModuleLoader__` and resolves React from the frozen platform table.
 * Both pickers are drawn inside the panel (never a native <select>) so they stay
 * readable: opaque surfaces come from the theme tokens the shell publishes.
 */
window.__ModuleLoader__.load({
  id: 'dsh-team-model-switcher-2',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var React = require('react')
    var h = React.createElement

    var ROUTE_BASE = '/agent-team-model-switch'
    var HEADERS = { 'content-type': 'application/json', 'x-atms': '1' }

    var SURFACE = 'var(--dsw-alias-bg-overlay, Canvas)'
    var NESTED = 'var(--dsw-alias-bg-layer-2, Canvas)'
    var BORDER = 'var(--dsw-alias-border-l1, rgba(128,128,128,.35))'
    var BORDER_STRONG = 'var(--dsw-alias-border-l2, rgba(128,128,128,.5))'
    var LABEL = 'var(--dsw-alias-label-primary, CanvasText)'
    var LABEL_DIM = 'var(--dsw-alias-label-secondary, GrayText)'
    var BRAND = 'var(--dsw-alias-brand-primary, Highlight)'

    var CSS = [
      '.atms-root{position:relative;display:inline-flex;align-items:center}',
      '.atms-trigger{display:inline-flex;align-items:center;font:inherit;font-size:12px;color:inherit;' +
        'opacity:.75;background:0 0;border:0;border-radius:6px;padding:4px 8px;cursor:pointer;white-space:nowrap}',
      '.atms-trigger:hover,.atms-trigger:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 8%,transparent)}',
      '.atms-panel{position:absolute;top:calc(100% + 8px);right:0;z-index:200;box-sizing:border-box;width:400px;' +
        'max-width:calc(100vw - 32px);max-height:min(70vh,540px);overflow-y:auto;padding:10px 12px;border-radius:12px;' +
        'border:1px solid ' + BORDER + ';background:' + SURFACE + ';color:' + LABEL + ';' +
        'box-shadow:0 12px 32px rgba(0,0,0,.28);font-size:12px;line-height:1.5;text-align:left}',
      '.atms-row{padding:7px 0;border-top:1px solid ' + BORDER + '}',
      '.atms-row:first-of-type{border-top:0}',
      '.atms-rowhead{display:flex;align-items:center;justify-content:space-between;gap:10px}',
      '.atms-ident{min-width:0;flex:1 1 auto}',
      '.atms-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + LABEL + '}',
      '.atms-status{font-size:11px;color:' + LABEL_DIM + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.atms-picker{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;max-width:210px;font:inherit;font-size:12px;' +
        'padding:3px 8px;border-radius:6px;border:1px solid ' + BORDER_STRONG + ';background:' + NESTED + ';color:inherit;cursor:pointer}',
      '.atms-picker:hover{border-color:' + BRAND + '}',
      '.atms-picker-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.atms-caret{font-size:9px;color:' + LABEL_DIM + '}',
      '.atms-options{margin:6px 0 2px;max-height:250px;overflow-y:auto;border:1px solid ' + BORDER + ';' +
        'border-radius:8px;background:' + NESTED + ';padding:4px}',
      '.atms-group{padding:6px 8px 2px;font-size:11px;color:' + LABEL_DIM + '}',
      '.atms-option{display:block;width:100%;box-sizing:border-box;text-align:left;font:inherit;font-size:12px;' +
        'padding:5px 8px;border:0;border-radius:6px;background:0 0;color:inherit;cursor:pointer}',
      '.atms-option:hover,.atms-option:focus-visible{background:color-mix(in srgb,currentColor 10%,transparent)}',
      '.atms-option-current{color:' + BRAND + ';font-weight:600}',
      '.atms-option-sub{display:block;font-size:11px;font-weight:400;color:' + LABEL_DIM + ';white-space:normal}',
      '.atms-opt-head{display:flex;align-items:center;gap:8px;padding:3px 4px 7px;border-bottom:1px solid ' + BORDER + '}',
      '.atms-back{flex:0 0 auto;font:inherit;font-size:12px;line-height:1;padding:3px 7px;border-radius:6px;' +
        'border:1px solid ' + BORDER_STRONG + ';background:0 0;color:' + LABEL_DIM + ';cursor:pointer}',
      '.atms-back:hover{color:' + LABEL + ';border-color:' + BRAND + '}',
      '.atms-opt-title{min-width:0;font-size:11px;color:' + LABEL_DIM + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.atms-hint{padding:2px 0;color:' + LABEL_DIM + ';overflow-wrap:anywhere}',
      '.atms-error{padding:2px 0;color:var(--dsw-alias-state-error-primary,#c0392b);overflow-wrap:anywhere}',
      '.atms-notice{padding:2px 0;color:var(--dsw-alias-state-success-primary,#2e8b57);overflow-wrap:anywhere}'
    ].join('')

    /** Inject the panel stylesheet once per page. */
    function injectStyle() {
      if (document.querySelector('style[data-atms]') !== null) return
      var style = document.createElement('style')
      style.dataset.atms = 'dsh-team-model-switcher'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    /** POST one JSON body to a Host route and unwrap its JSON answer. */
    function post(path, body) {
      return fetch(ROUTE_BASE + path, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body)
      }).then(function (response) {
        return response.json().catch(function () {
          throw new Error('host answered HTTP ' + response.status + ' without JSON')
        }).then(function (payload) {
          if (!response.ok || payload.error !== undefined) {
            throw new Error(payload.error || 'host answered HTTP ' + response.status)
          }
          return payload
        })
      })
    }

    /** Read the Lead session id behind any child session. */
    function useLeadSessionId(sessionId, useSession) {
      var read = typeof useSession === 'function' ? useSession : function () { return undefined }
      var parentId = read(function (snapshot) {
        var address = snapshot && snapshot.subagent ? snapshot.subagent.address : undefined
        return address ? address.parentSessionId : undefined
      })
      return parentId || sessionId
    }

    /** Find one catalog model, so the efforts it declares can be offered. */
    function findModel(groups, provider, modelId) {
      var group = groups.filter(function (row) { return row.id === provider })[0]
      if (group === undefined) return undefined
      return (group.models || []).filter(function (row) { return row.id === modelId })[0]
    }

    /** One line describing the efforts a catalog model declares. */
    function effortSummary(model) {
      var efforts = model && model.reasoning ? model.reasoning.efforts || [] : []
      if (efforts.length === 0) return null
      return '思考深度：' + efforts.map(function (effort) { return effort.name || effort.id }).join(' / ')
    }

    /** Compact popover: one member row each, with model and effort pickers. */
    function MemberModelPanel(props) {
      var sessionId = props.sessionId
      var leadSessionId = useLeadSessionId(sessionId, props.useSession)

      var openState = React.useState(false)
      var open = openState[0]
      var setOpen = openState[1]
      var membersState = React.useState([])
      var members = membersState[0]
      var setMembers = membersState[1]
      var groupsState = React.useState([])
      var groups = groupsState[0]
      var setGroups = groupsState[1]
      var expandedState = React.useState(null)
      var expanded = expandedState[0]
      var setExpanded = expandedState[1]
      var busyState = React.useState(null)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var problemState = React.useState(null)
      var problem = problemState[0]
      var setProblem = problemState[1]
      var noticeState = React.useState(null)
      var notice = noticeState[0]
      var setNotice = noticeState[1]
      var rootRef = React.useRef(null)

      /** Load the roster and the routable model catalog. */
      function load() {
        setProblem(null)
        setNotice(null)
        return post('/list', { sessionId: leadSessionId }).then(function (payload) {
          setMembers((payload.members || []).filter(function (row) { return row.role === 'teammate' }))
          setGroups(payload.groups || [])
        }).catch(function (error) {
          setProblem(error && error.message ? error.message : String(error))
        })
      }

      React.useEffect(function () {
        if (!open) return undefined
        function onPointerDown(event) {
          if (rootRef.current !== null && !rootRef.current.contains(event.target)) {
            setOpen(false)
            setExpanded(null)
          }
        }
        function onKeyDown(event) {
          if (event.key !== 'Escape') return
          if (expanded === null) setOpen(false)
          else if (expanded.provider === undefined) setExpanded(null)
          else setExpanded({ member: expanded.member })
        }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return function () {
          document.removeEventListener('mousedown', onPointerDown)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [open, expanded])

      /** Rewrite one roster row with the route the Host confirmed. */
      function withRoute(row, installed) {
        return {
          ...row,
          provider: installed.provider,
          model: installed.model,
          reasoningEffort: installed.reasoningEffort
        }
      }

      /**
       * Apply one picked route: to every teammate when the bulk row is active,
       * otherwise to the single member that row stands for.
       * `effort` undefined keeps the provider/model default.
       */
      function applyRoute(member, provider, model, effort) {
        var all = member.all === true
        setBusy(member.name)
        setNotice(null)
        setProblem(null)
        var body = { sessionId: leadSessionId, provider: provider, model: model }
        if (typeof effort === 'string' && effort.length > 0) body.reasoningEffort = effort
        if (all !== true) body.member = member.name
        post(all === true ? '/select-all' : '/select', body)
          .then(function (installed) {
            if (all === true) {
              var confirmed = {}
              ;(installed.members || []).forEach(function (row) { confirmed[row.name] = row })
              setMembers(function (current) {
                return current.map(function (row) {
                  return confirmed[row.name] === undefined ? row : withRoute(row, confirmed[row.name])
                })
              })
              setNotice('全部 ' + installed.updated + ' 个队员 → ' + installed.provider + '/' + installed.model +
                (installed.reasoningEffort === undefined ? '' : ' · ' + installed.reasoningEffort))
              return
            }
            setMembers(function (current) {
              return current.map(function (row) {
                return row.name === member.name ? withRoute(row, installed) : row
              })
            })
            setNotice(member.name + ' → ' + installed.provider + '/' + installed.model +
              (installed.reasoningEffort === undefined ? '' : ' · ' + installed.reasoningEffort))
          })
          .catch(function (error) {
            setProblem(error && error.message ? error.message : String(error))
          })
          .then(function () { setBusy(null) })
      }

      /** Pick a model; models that declare efforts open the second stage. */
      function chooseModel(member, provider, model) {
        var info = findModel(groups, provider, model.id)
        var efforts = info && info.reasoning ? info.reasoning.efforts || [] : []
        if (efforts.length === 0) {
          setExpanded(null)
          applyRoute(member, provider, model.id, undefined)
          return
        }
        setExpanded({ member: member.name, provider: provider, model: model.id })
      }

      function setDefault(member) {
        if (member.provider === undefined || member.model === undefined) return
        setBusy(member.name)
        setNotice(null)
        setProblem(null)
        var body = { sessionId: leadSessionId, provider: member.provider, model: member.model }
        if (typeof member.reasoningEffort === 'string' && member.reasoningEffort.length > 0) body.reasoningEffort = member.reasoningEffort
        post('/set-default', body)
          .then(function (installed) {
            setNotice('新成员默认 -> ' + installed.provider + '/' + installed.model +
              (installed.reasoningEffort === undefined ? '' : ' · ' + installed.reasoningEffort))
          })
          .catch(function (error) { setProblem(error && error.message ? error.message : String(error)) })
          .then(function () { setBusy(null) })
      }

      function bulkRow(list) {
        var first = list[0]
        var uniform = list.length > 0 && list.every(function (row) {
          return row.provider === first.provider && row.model === first.model &&
            (row.reasoningEffort || '') === (first.reasoningEffort || '')
        })
        return {
          name: '*',
          label: '全部队员',
          all: true,
          status: list.length + ' 个队员',
          provider: uniform ? first.provider : undefined,
          model: uniform ? first.model : undefined,
          reasoningEffort: uniform ? first.reasoningEffort : undefined
        }
      }

      function removeMember(member) {
        if (busy !== null || !window.confirm('将「' + member.name + '」移出团队？\n将停止当前任务、解除未完成任务负责人，并保留历史对话。')) return
        setBusy(member.name)
        setProblem(null)
        post('/remove', { sessionId: leadSessionId, member: member.name })
          .then(function (result) {
            setExpanded(null)
            setMembers(function (current) { return current.filter(function (row) { return row.name !== member.name }) })
            setNotice('已移除 ' + result.name + '，历史对话已保留；解除任务 ' + result.releasedTasks + ' 个')
          })
          .catch(function (error) { setProblem(error.message || String(error)) })
          .then(function () { setBusy(null) })
      }

      var rows = (members.length === 0 ? [] : [bulkRow(members)].concat(members)).map(function (member) {
        var route = member.provider && member.model ? member.provider + '/' + member.model : '选择模型…'
        var current = member.reasoningEffort ? route + ' · ' + member.reasoningEffort : route
        if (member.all === true && (member.provider === undefined || member.model === undefined)) {
          current = '统一设置…'
        }
        if (member.inherited === true) current = current + '（继承队长）'
        var isExpanded = expanded !== null && expanded.member === member.name
        var options = null

        if (isExpanded && expanded.provider === undefined) {
          var modelNodes = []
          groups.forEach(function (group) {
            modelNodes.push(h('div', { className: 'atms-group', key: 'g/' + group.id }, group.name || group.id))
            ;(group.models || []).forEach(function (model) {
              var isCurrent = member.provider === group.id && member.model === model.id
              var summary = effortSummary(model)
              modelNodes.push(h('button', {
                type: 'button',
                key: group.id + '/' + model.id,
                className: isCurrent ? 'atms-option atms-option-current' : 'atms-option',
                title: group.id + '/' + model.id,
                onClick: function () { chooseModel(member, group.id, model) }
              }, (isCurrent ? '✓ ' : '') + (model.name || model.id),
                summary === null ? null : h('span', { className: 'atms-option-sub' }, summary)))
            })
          })
          options = h('div', { className: 'atms-options' }, modelNodes)
        } else if (isExpanded) {
          var info = findModel(groups, expanded.provider, expanded.model)
          var efforts = info && info.reasoning ? info.reasoning.efforts || [] : []
          var currentEffort = member.reasoningEffort === undefined ? null : member.reasoningEffort
          var sameModel = member.provider === expanded.provider && member.model === expanded.model
          var defaultEffort = info && info.reasoning ? info.reasoning.defaultEffort : undefined
          var effortNodes = [
            h('div', { className: 'atms-opt-head', key: 'head' },
              h('button', {
                type: 'button',
                className: 'atms-back',
                title: '返回模型列表',
                onClick: function () { setExpanded({ member: member.name }) }
              }, '‹'),
              h('span', { className: 'atms-opt-title', title: expanded.provider + '/' + expanded.model },
                (info && (info.name || info.id)) || expanded.model)),
            h('button', {
              type: 'button',
              key: '__default',
              className: sameModel && currentEffort === null ? 'atms-option atms-option-current' : 'atms-option',
              onClick: function () {
                setExpanded(null)
                if (sameModel && currentEffort === null) return
                applyRoute(member, expanded.provider, expanded.model, undefined)
              }
            }, (sameModel && currentEffort === null ? '✓ ' : '') + '默认',
              h('span', { className: 'atms-option-sub' },
                defaultEffort === undefined ? '不指定，交给 provider 决定' : '模型缺省 = ' + defaultEffort))
          ]
          efforts.forEach(function (effort) {
            var isCurrent = sameModel && currentEffort === effort.id
            effortNodes.push(h('button', {
              type: 'button',
              key: effort.id,
              className: isCurrent ? 'atms-option atms-option-current' : 'atms-option',
              title: effort.description || effort.id,
              onClick: function () {
                setExpanded(null)
                if (isCurrent) return
                applyRoute(member, expanded.provider, expanded.model, effort.id)
              }
            }, (isCurrent ? '✓ ' : '') + (effort.name || effort.id),
              effort.description === undefined
                ? null
                : h('span', { className: 'atms-option-sub' }, effort.description)))
          })
          options = h('div', { className: 'atms-options' }, effortNodes)
        }

        return h('div', { className: 'atms-row', key: member.name },
          h('div', { className: 'atms-rowhead' },
            h('div', { className: 'atms-ident' },
              h('div', { className: 'atms-name' }, member.label || member.name),
              h('div', { className: 'atms-status' },
                (member.status || '') + (busy === member.name ? ' · 切换中…' : ''))),
            h('button', {
              type: 'button',
              className: 'atms-picker',
              title: current,
              onClick: function () { setExpanded(isExpanded ? null : { member: member.name }) }
            },
              h('span', { className: 'atms-picker-label' }, current),
              h('span', { className: 'atms-caret' }, isExpanded ? '▴' : '▾')),
            member.all === true ? h('button', {
              type: 'button', className: 'atms-picker', disabled: busy !== null || member.provider === undefined,
              title: '设为新成员默认模型', onClick: function () { setDefault(member) }
            }, '设为默认') : h('button', {
              type: 'button', className: 'atms-picker', disabled: busy !== null,
              title: '移出团队，保留历史对话', onClick: function () { removeMember(member) }
            }, '移除')),
          options)
      })

      return h('div', { className: 'atms-root', ref: rootRef },
        h('button', {
          type: 'button',
          className: 'atms-trigger',
          title: '切换队员使用的模型与思考深度；「全部队员」可一键切换整队',
          onClick: function () {
            var next = !open
            setOpen(next)
            setExpanded(null)
            if (next) load()
          }
        }, '成员模型'),
        open
          ? h('div', { className: 'atms-panel' },
            rows.length > 0
              ? [h('div', { className: 'atms-hint', key: 'hint' },
                '「全部队员」= 一次切换整队；「继承队长」= 跟随你的模型（不含队长本人）')].concat(rows)
              : h('div', { className: 'atms-hint' }, '当前会话不是团队队长，或团队里还没有队员'),
            notice !== null ? h('div', { className: 'atms-notice' }, notice) : null,
            problem !== null ? h('div', { className: 'atms-error' }, problem) : null)
          : null)
    }

    /** Required client services. */
    var inject = ['slots']
    /**
     * Register the header control.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      injectStyle()
      ctx.inject(['slots'], function (scope) {
        scope.slots.inject('conversation.session.header.actions', function () {
          return scope.slots.register({
            name: 'conversation.session.header.actions',
            id: 'team-model-switcher',
            order: -10,
            inject: function () { return {} }
          }, MemberModelPanel)
        })
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
