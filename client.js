/**
 * dsh-plugin-dynamic-competition-four-images — Client 半边
 *
 * 在「设置 → 插件」里增加一个页签：列出插件内的技能，允许用户把它们
 * 添加到指定工作区（写入 <workspace>/.dsh/skills/<name>/）。数据层走宿主
 * 的 loopback 桥（见 index.js），不依赖任何 @Remote 命名空间。
 *
 * 本文件由 dsh.client 加载，注册工厂 id 必须等于包名。
 */

window.__ModuleLoader__.load({
  id: 'dsh-plugin-dynamic-competition-four-images',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-plugin-dynamic-competition-four-images'
    const BRIDGE = '/api/dsh-plugin-dynamic-competition-four-images'
    const SLOT = 'settings.plugins.tab'

    const ZH = {
      'tab.label': '四象模型',
      title: '四象模型分析技能',
      lead: '把插件内携带的技能安装到指定工作区。安装后技能写入该工作区的 .dsh/skills/，只在该工作区生效，不会成为全局技能。',
      'workspace.label': '目标工作区',
      'workspace.placeholder': '选择工作区…',
      'workspace.pick': '选择其他目录…',
      'workspace.picking': '选择中…',
      'workspace.none': '还没有选择工作区',
      'workspace.custom': '自定义目录',
      install: '添加到工作区',
      installing: '正在添加…',
      'skills.empty': '插件内没有找到可用技能。',
      'status.unselected': '未选择工作区',
      'status.missing': '未安装',
      'status.outdated': '有更新可用',
      'status.up-to-date': '已是最新',
      'result.installed': '已添加到工作区',
      'result.updated': '已更新',
      'result.unchanged': '内容一致，无需更新',
      'result.written': '写入 {written} 个文件，共 {total} 个',
      'result.target': '安装位置：{path}',
      'error.prefix': '操作失败：',
      'error.describe': '无法读取插件技能列表',
      'error.noWorkspace': '请先选择一个工作区',
      'error.bridge': '宿主桥不可用，请重启 DSH 后重试',
      version: '版本 {version}',
      'version.update': '有新版本 {latest}（当前 {version}）',
      'version.hint':
        '装到旧版本时，通常是 DSH 的「发布年龄」策略：发布不满 24 小时的版本默认不参与安装解析。可在插件页选择 {latest} 重新安装，或等 24 小时后再装；升级后需重启 DSH。',
      note: '重复添加只会覆盖有变化的文件；删除工作区里的该目录即可移除技能。',
    }

    const EN = {
      'tab.label': 'Four Images',
      title: 'Four Images analysis skill',
      lead: 'Install the skill shipped with this plugin into a workspace. It is written to that workspace’s .dsh/skills/ and stays scoped to that workspace; it never becomes a global skill.',
      'workspace.label': 'Target workspace',
      'workspace.placeholder': 'Choose a workspace…',
      'workspace.pick': 'Choose another folder…',
      'workspace.picking': 'Choosing…',
      'workspace.none': 'No workspace selected yet',
      'workspace.custom': 'Custom folder',
      install: 'Add to workspace',
      installing: 'Adding…',
      'skills.empty': 'No skill found inside this plugin.',
      'status.unselected': 'No workspace selected',
      'status.missing': 'Not installed',
      'status.outdated': 'Update available',
      'status.up-to-date': 'Up to date',
      'result.installed': 'Added to the workspace',
      'result.updated': 'Updated',
      'result.unchanged': 'Already up to date',
      'result.written': '{written} of {total} files written',
      'result.target': 'Installed at {path}',
      'error.prefix': 'Failed: ',
      'error.describe': 'Could not read the skill list',
      'error.noWorkspace': 'Choose a workspace first',
      'error.bridge': 'Host bridge unavailable; restart DSH and retry',
      version: 'Version {version}',
      'version.update': 'Version {latest} is available (installed {version})',
      'version.hint':
        'An older version was installed because of the DSH release-age policy: versions published in the last 24 hours are skipped during installation. Reinstall choosing {latest} in the plugin page, or retry after 24 hours; restart DSH after upgrading.',
      note: 'Re-adding only overwrites files that changed; delete that folder in the workspace to remove the skill.',
    }

    const STATUS_TONE = {
      missing: 'var(--dsw-alias-state-warn-primary)',
      outdated: 'var(--dsw-alias-state-warn-primary)',
      'up-to-date': 'var(--dsw-alias-state-success-primary)',
      unselected: 'var(--dsw-alias-state-idle-primary)',
    }

    function format(template, params) {
      return template.replace(/\{(\w+)\}/g, (whole, key) => (params && key in params ? String(params[key]) : whole))
    }

    /** 比较版本号：left 大于 right 返回正数；只比数字段，带预发布后缀者视为更低。 */
    function compareVersions(left, right) {
      const core = (value) =>
        String(value)
          .split('-')[0]
          .split('.')
          .map((part) => Number.parseInt(part, 10) || 0)
      const a = core(left)
      const b = core(right)
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        const diff = (a[index] ?? 0) - (b[index] ?? 0)
        if (diff !== 0) return diff
      }
      const preA = String(left).includes('-')
      const preB = String(right).includes('-')
      if (preA !== preB) return preA ? -1 : 1
      return 0
    }

    /** 调宿主桥；返回 value，失败抛错。 */
    async function call(op, body) {
      const response = await fetch(`${BRIDGE}/${op}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      let payload
      try {
        payload = await response.json()
      } catch {
        throw new Error(`HTTP ${response.status}`)
      }
      if (payload === null || typeof payload !== 'object') throw new Error(`HTTP ${response.status}`)
      if (payload.ok !== true) throw new Error(payload.message || payload.code || `HTTP ${response.status}`)
      return payload.value
    }

    function workspaceList(snapshot) {
      const raw = snapshot && (snapshot.workspaces ?? snapshot.items ?? snapshot)
      const list = []
      if (!Array.isArray(raw)) return list
      for (const item of raw) {
        if (item === null || typeof item !== 'object') continue
        const path = typeof item.path === 'string' ? item.path : undefined
        if (path === undefined || path === '') continue
        const title = typeof item.title === 'string' && item.title !== '' ? item.title : path
        list.push({ id: String(item.workspaceId ?? item.id ?? path), title, path })
      }
      return list
    }

    const cardStyle = {
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: 12,
      background: 'var(--dsw-alias-bg-layer-1)',
      padding: '16px 18px',
      display: 'grid',
      gap: 14,
    }

    const labelStyle = {
      display: 'block',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.02em',
      color: 'var(--dsw-alias-label-secondary)',
      marginBottom: 6,
    }

    const boxStyle = {
      width: '100%',
      boxSizing: 'border-box',
      minHeight: 34,
      padding: '6px 10px',
      borderRadius: 8,
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'var(--dsw-alias-bg-base)',
      color: 'var(--dsw-alias-label-primary)',
      font: 'inherit',
      fontSize: 13,
    }

    function buttonStyle(primary, disabled) {
      return {
        minHeight: 34,
        padding: '6px 14px',
        borderRadius: 8,
        border: primary ? '1px solid transparent' : '1px solid var(--dsw-alias-border-l2)',
        background: primary ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-base)',
        color: primary ? 'var(--dsw-alias-bg-base)' : 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }
    }

    function badgeStyle(tone) {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        border: `1px solid ${tone}`,
        color: tone,
        fontSize: 12,
        fontWeight: 600,
      }
    }

    return {
      name: NS,
      inject: ['slots'],
      apply(ctx) {
        const getLocale = () => {
          try {
            return typeof ctx.get === 'function' ? ctx.get('locale') : undefined
          } catch {
            return undefined
          }
        }
        const localeFace = () => {
          const live = getLocale()
          return live !== null && live !== undefined && typeof live.bind === 'function' ? live : null
        }

        // locale 服务是异步 install 的：apply 时可能还没就绪，所以每次用时再取，
        // 词典只注册一次（HMR 重复注册会被运行时拒绝，这里静默忽略）。
        let dictsRegistered = false
        const ensureDicts = () => {
          if (dictsRegistered) return
          const live = localeFace()
          if (live === null) return
          dictsRegistered = true
          try {
            ctx.effect(() => live.register(NS, { zh: ZH, en: EN }))
          } catch {
            // 已有词典（例如插件热更新）时保持现状
          }
        }

        const translate = (key, params) => {
          const live = localeFace()
          if (live !== null) {
            try {
              return format(live.bind(NS)(key, params), params)
            } catch {
              // 绑定失败时退回内置中文
            }
          }
          return format(ZH[key] ?? key, params)
        }

        const uiWorkspace = () => {
          try {
            return typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : undefined
          } catch {
            return undefined
          }
        }

        ensureDicts()

        function Installer(props) {
          const t = typeof props?.t === 'function' ? (key, params) => format(props.t(key, params), params) : translate
          const snapshot =
            props !== null && typeof props?.useWorkspaces === 'function' ? props.useWorkspaces((value) => value) : undefined
          const workspaces = workspaceList(snapshot)

          const [path, setPath] = React.useState('')
          const [skills, setSkills] = React.useState([])
          const [version, setVersion] = React.useState('')
          const [latest, setLatest] = React.useState('')
          const [error, setError] = React.useState(null)
          const [busy, setBusy] = React.useState(false)
          const [picking, setPicking] = React.useState(false)
          const [notice, setNotice] = React.useState(null)

          const refresh = React.useCallback(async (workspacePath) => {
            try {
              const value = await call('describe', workspacePath === '' ? {} : { workspacePath })
              setSkills(Array.isArray(value.skills) ? value.skills : [])
              setVersion(typeof value.version === 'string' ? value.version : '')
              setError(null)
            } catch (failure) {
              setSkills([])
              setError(`${t('error.describe')}：${failure instanceof Error ? failure.message : String(failure)}`)
            }
          }, [t])

          React.useEffect(() => {
            let cancelled = false
            refresh(path).catch(() => {
              if (!cancelled) setError(t('error.bridge'))
            })
            return () => {
              cancelled = true
            }
          }, [path, refresh, t])

          // 版本信息单独取：宿主会顺带去 npm registry 查最新版本，失败时静默降级。
          React.useEffect(() => {
            let cancelled = false
            call('versions', {})
              .then((value) => {
                if (cancelled || value === null || typeof value !== 'object') return
                if (typeof value.version === 'string' && value.version !== '') setVersion(value.version)
                setLatest(typeof value.latestVersion === 'string' ? value.latestVersion : '')
              })
              .catch(() => {})
            return () => {
              cancelled = true
            }
          }, [])

          const pickDirectory = async () => {
            const service = uiWorkspace()
            if (service === undefined || typeof service.pickDirectory !== 'function') return
            setPicking(true)
            try {
              const picked = await service.pickDirectory()
              if (typeof picked === 'string' && picked !== '') {
                setPath(picked)
                setNotice(null)
              }
            } catch (failure) {
              setNotice({ kind: 'error', text: `${t('error.prefix')}${failure instanceof Error ? failure.message : String(failure)}` })
            } finally {
              setPicking(false)
            }
          }

          const install = async () => {
            if (path === '') {
              setNotice({ kind: 'error', text: t('error.noWorkspace') })
              return
            }
            setBusy(true)
            setNotice(null)
            try {
              const value = await call('install', { workspacePath: path })
              const tone = value.status === 'unchanged' ? 'warn' : 'ok'
              const head = t(`result.${value.status}`)
              const detail = format(t('result.written'), { written: value.written, total: value.total })
              setNotice({ kind: tone, text: `${head} · ${detail}`, target: format(t('result.target'), { path: value.targetPath }) })
              await refresh(path)
            } catch (failure) {
              setNotice({ kind: 'error', text: `${t('error.prefix')}${failure instanceof Error ? failure.message : String(failure)}` })
            } finally {
              setBusy(false)
            }
          }

          const options = workspaces.map((workspace) => ({ value: workspace.path, label: `${workspace.title} — ${workspace.path}` }))
          if (path !== '' && !options.some((option) => option.value === path)) {
            options.push({ value: path, label: `${t('workspace.custom')} — ${path}` })
          }

          const noticeTone =
            notice === null
              ? 'var(--dsw-alias-label-secondary)'
              : notice.kind === 'error'
                ? 'var(--dsw-alias-state-error-primary)'
                : notice.kind === 'warn'
                  ? 'var(--dsw-alias-state-warn-primary)'
                  : 'var(--dsw-alias-state-success-primary)'

          return h('div', { style: { display: 'grid', gap: 16, padding: '8px 0', maxWidth: 760, color: 'var(--dsw-alias-label-primary)' } }, [
            h('div', { key: 'head' }, [
              h('div', { key: 'title', style: { fontSize: 16, fontWeight: 600 } }, t('title')),
              h(
                'p',
                { key: 'lead', style: { margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } },
                t('lead'),
              ),
              version === ''
                ? null
                : h(
                    'p',
                    { key: 'version', style: { margin: '4px 0 0', fontSize: 12, color: 'var(--dsw-alias-state-idle-primary)' } },
                    format(t('version'), { version }),
                  ),
              latest !== '' && version !== '' && compareVersions(latest, version) > 0
                ? h(
                    'div',
                    {
                      key: 'update',
                      style: {
                        marginTop: 8,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--dsw-alias-state-warn-primary)',
                        display: 'grid',
                        gap: 4,
                      },
                    },
                    [
                      h(
                        'div',
                        { key: 'head', style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-state-warn-primary)' } },
                        format(t('version.update'), { latest, version }),
                      ),
                      h(
                        'div',
                        { key: 'hint', style: { fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } },
                        format(t('version.hint'), { latest, version }),
                      ),
                    ],
                  )
                : null,
            ]),

            h('div', { key: 'card', style: cardStyle }, [
              h('div', { key: 'skills', style: { display: 'grid', gap: 8 } }, [
                skills.length === 0
                  ? h('div', { key: 'empty', style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } }, error ?? t('skills.empty'))
                  : null,
                ...skills.map((skill) =>
                  h('div', { key: skill.name, style: { display: 'grid', gap: 4 } }, [
                    h('div', { key: 'line', style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } }, [
                      h('code', { key: 'name', style: { fontSize: 13, fontWeight: 600 } }, skill.name),
                      h('span', { key: 'badge', style: badgeStyle(STATUS_TONE[skill.status] ?? STATUS_TONE.unselected) }, t(`status.${skill.status}`)),
                    ]),
                    h(
                      'div',
                      { key: 'desc', style: { fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } },
                      skill.description,
                    ),
                  ]),
                ),
              ]),

              h('div', { key: 'picker', style: { display: 'grid', gap: 8 } }, [
                h('label', { key: 'label', style: labelStyle, htmlFor: `${NS}-workspace` }, t('workspace.label')),
                h('div', { key: 'row', style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, [
                  h(
                    'select',
                    {
                      key: 'select',
                      id: `${NS}-workspace`,
                      value: path,
                      style: { ...boxStyle, flex: '1 1 260px' },
                      onChange: (event) => {
                        setPath(event.target.value)
                        setNotice(null)
                      },
                    },
                    [
                      h('option', { key: 'placeholder', value: '' }, t('workspace.placeholder')),
                      ...options.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
                    ],
                  ),
                  h(
                    'button',
                    { key: 'pick', type: 'button', style: buttonStyle(false, picking), disabled: picking, onClick: pickDirectory },
                    picking ? t('workspace.picking') : t('workspace.pick'),
                  ),
                ]),
                path === ''
                  ? h('div', { key: 'none', style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('workspace.none'))
                  : h('div', { key: 'path', style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', wordBreak: 'break-all' } }, path),
              ]),

              h('div', { key: 'actions', style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } }, [
                h(
                  'button',
                  {
                    key: 'install',
                    type: 'button',
                    style: buttonStyle(true, busy || path === '' || skills.length === 0),
                    disabled: busy || path === '' || skills.length === 0,
                    onClick: install,
                  },
                  busy ? t('installing') : t('install'),
                ),
                notice === null
                  ? null
                  : h(
                      'div',
                      { key: 'notice', style: { fontSize: 12, lineHeight: 1.6, color: noticeTone, display: 'grid', gap: 2 } }, [
                        h('div', { key: 'text' }, notice.text),
                        notice.target === undefined ? null : h('div', { key: 'target', style: { color: 'var(--dsw-alias-label-secondary)', wordBreak: 'break-all' } }, notice.target),
                      ],
                    ),
              ]),

              h(
                'p',
                { key: 'note', style: { margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } },
                t('note'),
              ),
            ]),
          ])
        }

        ctx.slots.inject(SLOT, () => {
          // 设置面板打开时 locale 一定已就绪：补充注册词典，并按现状决定 locale 席位
          ensureDicts()
          const registration = {
            name: SLOT,
            id: 'dynamic-competition-four-images',
            order: 40,
            label: () => translate('tab.label'),
            ...(localeFace() === null ? {} : { locale: NS }),
          }
          return ctx.slots.register(registration, Installer)
        })
      },
    }
  },
})
