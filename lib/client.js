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

    var SURFACE = 'var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-2, Canvas))'
    var NESTED = 'var(--dsw-alias-bg-layer-2, Canvas)'
    var BORDER = 'var(--dsw-alias-border-l1, color-mix(in srgb,CanvasText 30%,transparent))'
    var BORDER_STRONG = 'var(--dsw-alias-border-l2, color-mix(in srgb,CanvasText 45%,transparent))'
    var LABEL = 'var(--dsw-alias-label-primary, CanvasText)'
    var LABEL_DIM = 'var(--dsw-alias-label-secondary, GrayText)'
    var BRAND = 'var(--dsw-alias-brand-primary, Highlight)'

    var CSS = [
      '.atms-root{position:relative;display:inline-flex;align-items:center}',
      '.atms-trigger{display:inline-flex;align-items:center;font:inherit;font-size:12px;color:inherit;' +
        'opacity:.75;background:0 0;border:0;border-radius:6px;padding:4px 8px;cursor:pointer;white-space:nowrap}',
      '.atms-trigger:hover,.atms-trigger:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 8%,transparent)}',
      '.atms-panel{position:fixed;top:0;left:0;z-index:200;box-sizing:border-box;width:420px;' +
        'max-width:calc(100vw - 24px);max-height:min(72vh,560px);overflow-y:auto;padding:0;border-radius:14px;' +
        'border:1px solid ' + BORDER + ';background:' + SURFACE + ';color:' + LABEL + ';' +
        'box-shadow:0 16px 40px -16px color-mix(in srgb,var(--dsw-alias-bg-overlay,CanvasText) 45%,transparent),' +
        '0 2px 6px color-mix(in srgb,var(--dsw-alias-bg-overlay,CanvasText) 22%,transparent);' +
        'font-size:12px;line-height:1.5;text-align:left}',
      '.atms-head{padding:12px 14px 10px;border-bottom:1px solid ' + BORDER + '}',
      '.atms-title{font-size:13px;font-weight:600;color:' + LABEL + '}',
      '.atms-sub{padding-top:2px;font-size:11px;color:' + LABEL_DIM + '}',
      '.atms-body{padding:2px 8px 8px}',
      '.atms-row{padding:9px 6px;border-top:1px solid ' + BORDER + '}',
      '.atms-row:first-of-type{border-top:0}',
      '.atms-ident{display:flex;align-items:baseline;justify-content:space-between;gap:10px}',
      '.atms-name{min-width:0;flex:1 1 auto;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + LABEL + '}',
      '.atms-status{flex:none;font-size:11px;color:' + LABEL_DIM + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.atms-status-ok{color:var(--dsw-alias-state-success-primary,CanvasText)}',
      '.atms-status-bad{color:var(--dsw-alias-state-error-primary,CanvasText)}',
      '.atms-picker{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:8px;margin-top:6px;' +
        'padding:6px 10px;font:inherit;font-size:12px;text-align:left;border-radius:8px;' +
        'border:1px solid ' + BORDER_STRONG + ';background:' + NESTED + ';color:inherit;cursor:pointer}',
      '.atms-picker:hover,.atms-picker:focus-visible{border-color:' + BRAND + '}',
      '.atms-picker:disabled{cursor:default;opacity:.6}',
      '.atms-picker-text{min-width:0;flex:1 1 auto}',
      '.atms-model{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + LABEL + '}',
      '.atms-provider{display:block;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + LABEL_DIM + '}',
      '.atms-caret{flex:none;font-size:9px;color:' + LABEL_DIM + '}',
      '.atms-actions{display:flex;justify-content:flex-end;gap:2px;padding-top:4px}',
      '.atms-action{font:inherit;font-size:11px;padding:3px 8px;border:0;border-radius:6px;background:0 0;' +
        'color:' + LABEL_DIM + ';cursor:pointer}',
      '.atms-action:hover:not(:disabled){background:color-mix(in srgb,' + LABEL + ' 8%,transparent);color:' + LABEL + '}',
      '.atms-action:disabled{cursor:default;opacity:.45}',
      '.atms-action-danger:hover:not(:disabled){color:var(--dsw-alias-state-error-primary,CanvasText)}',
      '.atms-options{margin:6px 0 2px;max-height:240px;overflow-y:auto;border:1px solid ' + BORDER + ';' +
        'border-radius:10px;background:' + NESTED + ';padding:4px}',
      '.atms-group{padding:6px 8px 2px;font-size:11px;color:' + LABEL_DIM + '}',
      '.atms-option{display:block;width:100%;box-sizing:border-box;text-align:left;font:inherit;font-size:12px;' +
        'padding:5px 8px;border:0;border-radius:7px;background:0 0;color:inherit;cursor:pointer}',
      '.atms-option:hover,.atms-option:focus-visible{background:color-mix(in srgb,' + LABEL + ' 8%,transparent)}',
      '.atms-option-current{color:' + BRAND + ';font-weight:600}',
      '.atms-option-sub{display:block;font-size:11px;font-weight:400;color:' + LABEL_DIM + ';white-space:normal}',
      '.atms-opt-head{display:flex;align-items:center;gap:8px;padding:3px 4px 7px;border-bottom:1px solid ' + BORDER + '}',
      '.atms-back{flex:0 0 auto;font:inherit;font-size:12px;line-height:1;padding:3px 7px;border-radius:6px;' +
        'border:1px solid ' + BORDER_STRONG + ';background:0 0;color:' + LABEL_DIM + ';cursor:pointer}',
      '.atms-back:hover{color:' + LABEL + ';border-color:' + BRAND + '}',
      '.atms-opt-title{min-width:0;font-size:11px;color:' + LABEL_DIM + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.atms-hint{padding:8px 6px;color:' + LABEL_DIM + ';overflow-wrap:anywhere}',
      '.atms-error{padding:0 14px 10px;color:var(--dsw-alias-state-error-primary,CanvasText);overflow-wrap:anywhere}',
      '.atms-notice{padding:0 14px 10px;color:var(--dsw-alias-state-success-primary,CanvasText);overflow-wrap:anywhere}'
    ].join('')

    /**
     * Upsert the panel stylesheet and tag it with the mount that wrote it.
     * A module update re-runs `apply` on the same page, so a node left by an
     * earlier generation must be refreshed: keeping the first copy would pin the
     * old rules while the new component markup already uses the new class names.
     * @param owner - token identifying the mounting instance.
     * @returns the style node this mount wrote.
     */
    function injectStyle(owner) {
      var node = document.querySelector('style[data-atms]')
      if (node === null) {
        node = document.createElement('style')
        node.dataset.atms = 'dsh-team-model-switcher'
        document.head.appendChild(node)
      }
      if (node.textContent !== CSS) node.textContent = CSS
      node.dataset.atmsOwner = owner
      return node
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

    /** Chinese label for one runtime roster status. */
    var STATUS_TEXT = { running: '运行中', inactive: '空闲', provisioning: '准备中', failed: '失败' }
    function statusText(status) {
      if (typeof status !== 'string' || status.length === 0) return ''
      return STATUS_TEXT[status] || status
    }

    /** Status line class; running and failed carry the theme's state colors. */
    function statusClass(status) {
      if (status === 'running') return 'atms-status atms-status-ok'
      if (status === 'failed') return 'atms-status atms-status-bad'
      return 'atms-status'
    }

    /** The row's complete route, kept as the picker tooltip. */
    function routeTitle(member) {
      if (member.provider === undefined || member.model === undefined) return '未指定模型'
      var parts = [member.provider + '/' + member.model]
      if (typeof member.reasoningEffort === 'string' && member.reasoningEffort.length > 0) {
        parts.push('思考深度 ' + member.reasoningEffort)
      }
      if (member.inherited === true) parts.push('继承队长')
      return parts.join(' · ')
    }

    /** Primary picker line: the catalog name of the route that will be used. */
    function modelLabel(member, groups) {
      if (member.provider === undefined || member.model === undefined) {
        return member.all === true ? '统一设置…' : '选择模型…'
      }
      var info = findModel(groups, member.provider, member.model)
      return (info && (info.name || info.id)) || member.model
    }

    /** Secondary picker line: provider id, current reasoning depth, inheritance. */
    function modelMeta(member) {
      if (member.provider === undefined || member.model === undefined) {
        // The Host only fills a route on the bulk row when every teammate shares
        // one, so a missing route here may also mean "all inherit the Lead".
        return member.all === true ? '为全部队员选择模型' : '尚未指定'
      }
      var text = member.provider
      if (typeof member.reasoningEffort === 'string' && member.reasoningEffort.length > 0) {
        text += ' · 思考深度 ' + member.reasoningEffort
      }
      if (member.inherited === true) text += ' · 继承队长'
      return text
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
      var panelRef = React.useRef(null)

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

      /**
       * Keep the panel inside the viewport and outside ancestor overflow clips. The
       * fixed panel is anchored from the root's viewport box, then corrected from
       * its actual box so transformed or contained ancestors cannot be trusted.
       */
      function placePanel() {
        var root = rootRef.current
        var panel = panelRef.current
        if (root === null || panel === null) return
        var margin = 8
        panel.style.transform = ''
        panel.style.left = '0px'
        panel.style.top = '0px'
        var rootBox = root.getBoundingClientRect()
        var size = panel.getBoundingClientRect()
        var left = Math.max(margin, Math.min(rootBox.right - size.width,
          window.innerWidth - margin - size.width))
        var top = rootBox.bottom + margin
        if (top + size.height > window.innerHeight - margin) {
          top = Math.max(margin, rootBox.top - size.height - margin)
        }
        for (var pass = 0; pass < 4; pass += 1) {
          panel.style.left = Math.round(left) + 'px'
          panel.style.top = Math.round(top) + 'px'
          var actual = panel.getBoundingClientRect()
          var correctionX = left - actual.left
          var correctionY = top - actual.top
          if (Math.abs(correctionX) < 0.5 && Math.abs(correctionY) < 0.5) break
          left += correctionX
          top += correctionY
        }
        var placed = panel.getBoundingClientRect()
        if (placed.left < margin) left += margin - placed.left
        if (placed.right > window.innerWidth - margin) left -= placed.right - (window.innerWidth - margin)
        if (placed.top < margin) top += margin - placed.top
        if (placed.bottom > window.innerHeight - margin) top -= placed.bottom - (window.innerHeight - margin)
        for (var finalPass = 0; finalPass < 3; finalPass += 1) {
          var finalBox = panel.getBoundingClientRect()
          var finalX = finalBox.left < margin ? margin - finalBox.left
            : finalBox.right > window.innerWidth - margin ? window.innerWidth - margin - finalBox.right : 0
          var finalY = finalBox.top < margin ? margin - finalBox.top
            : finalBox.bottom > window.innerHeight - margin ? window.innerHeight - margin - finalBox.bottom : 0
          if (finalX === 0 && finalY === 0) break
          left += finalX
          top += finalY
          panel.style.left = Math.round(left) + 'px'
          panel.style.top = Math.round(top) + 'px'
        }
      }

      React.useEffect(function () {
        if (!open) return undefined
        placePanel()
        window.addEventListener('resize', placePanel)
        window.addEventListener('scroll', placePanel, true)
         var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(placePanel) : null
         if (observer !== null) observer.observe(panelRef.current)
         return function () {
           window.removeEventListener('resize', placePanel)
           window.removeEventListener('scroll', placePanel, true)
           if (observer !== null) observer.disconnect()
         }
      }, [open])

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
          h('div', { className: 'atms-ident' },
            h('div', { className: 'atms-name', title: member.label || member.name }, member.label || member.name),
            h('div', { className: statusClass(member.status) },
              statusText(member.status) + (busy === member.name ? ' · 切换中…' : ''))),
          h('button', {
            type: 'button',
            className: 'atms-picker',
            title: routeTitle(member),
            'aria-expanded': isExpanded,
            onClick: function () { setExpanded(isExpanded ? null : { member: member.name }) }
          },
            h('span', { className: 'atms-picker-text' },
              h('span', { className: 'atms-model' }, modelLabel(member, groups)),
              h('span', { className: 'atms-provider' }, modelMeta(member))),
            h('span', { className: 'atms-caret' }, isExpanded ? '▴' : '▾')),
          h('div', { className: 'atms-actions' },
            member.all === true ? h('button', {
              type: 'button', className: 'atms-action', disabled: busy !== null || member.provider === undefined,
              title: '把当前模型设为新队员的默认模型', onClick: function () { setDefault(member) }
            }, '设为默认') : h('button', {
              type: 'button', className: 'atms-action atms-action-danger', disabled: busy !== null,
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
          ? h('div', { className: 'atms-panel', ref: panelRef },
            h('div', { className: 'atms-head', key: 'head' },
              h('div', { className: 'atms-title' }, '成员模型'),
              h('div', { className: 'atms-sub' }, '选择队员下次请求使用的模型与思考深度；「全部队员」一次切换整队')),
            h('div', { className: 'atms-body', key: 'body' },
              rows.length > 0
                ? rows.concat([h('div', { className: 'atms-hint', key: 'hint' },
                  '「继承队长」表示该队员未单独指定，跟随你的模型（不含队长本人）')])
                : h('div', { className: 'atms-hint' }, '当前会话不是团队队长，或团队里还没有队员')),
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
      var owner = Date.now().toString(36) + Math.random().toString(36).slice(2)
      var style = injectStyle(owner)
      ctx.effect(function () {
        return function () {
          // Only the mount that last wrote the node removes it, so a disposal
          // racing a newer mount cannot strip the rules that mount renders with.
          if (style.parentNode !== null && style.dataset.atmsOwner === owner) style.parentNode.removeChild(style)
        }
      })
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
