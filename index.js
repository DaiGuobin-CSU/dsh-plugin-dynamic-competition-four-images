/**
 * dsh-plugin-dynamic-competition-four-images
 *
 * 把「动态竞争分析·四象模型」技能以 **工作区技能** 的方式交付。
 *
 * 交付方式（二选一，互不冲突）：
 * 1. 技能本体随包发布在 `.dsh/skills/dynamic-competition-analysis-four-images-model/`，
 *    工作区中的会话由 DSH 原生 filesystem provider 以 source `project-dsh` 发现；
 * 2. 本插件按 `config.workspaces` 指定的工作区提供同一份技能，供未把技能文件
 *    放进工作区、但已安装本插件的场景使用。
 *
 * 本插件**不注册全局技能**：只有会话工作目录位于已配置的工作区内时才提供技能，
 * 因此不会出现在其他工作区或全局技能列表中。
 *
 * @module dsh-plugin-dynamic-competition-four-images
 */

import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis 插件名。 */
export const name = 'dynamic-competition-four-images'

/** 技能注册表是本插件唯一的 Service 依赖。 */
export const inject = ['skills']

/** 技能名，与 SKILL.md frontmatter 的 `name` 一致。 */
const SKILL_NAME = 'dynamic-competition-analysis-four-images-model'
const SKILLS_ROOT = fileURLToPath(new URL('./.dsh/skills/', import.meta.url))
const SKILL_DIR = join(SKILLS_ROOT, SKILL_NAME)
const SKILL_FILE = join(SKILL_DIR, 'SKILL.md')
const PROVIDER_NAME = 'dynamic-competition-four-images'
/** 工作区技能的优先级：低于原生 project-dsh（100），与 bundled（600）区分。 */
const PROJECT_SKILL_RANK = 700
/** 以工作区技能来源上报，使界面把它当工作区技能而非全局技能。 */
const SKILL_SOURCE = 'project-dsh'
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * 注册技能提供者。仅在存在已配置工作区时注册，避免产生任何全局技能。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ workspaces?: unknown }} [config]
 */
export function apply(ctx, config) {
  const { workspaces, ignored } = normalizeWorkspaces(config)
  if (ignored.length > 0) {
    warn(ctx, `忽略 ${ignored.length} 条无效的 workspaces 配置（只接受非空绝对路径）：${ignored.join('，')}`)
  }
  if (workspaces.length === 0) {
    warn(ctx, '未配置 workspaces，本插件不提供技能；工作区 .dsh/skills 下的副本仍由 DSH 原生发现。')
    return
  }

  return ctx.skills.registerProvider(() => ({
    name: PROVIDER_NAME,

    async list(options) {
      const candidate = await workspaceCandidate(options, workspaces, ctx)
      return candidate === undefined ? [] : [candidate]
    },

    async get(candidate, options) {
      options?.signal?.throwIfAborted()
      if (candidate === undefined || candidate.name !== SKILL_NAME) return undefined
      const skill = await loadSkill(options?.signal)
      return skill === undefined ? undefined : toDefinition(skill)
    },
  }))
}

/**
 * 归一化 `workspaces` 配置：只接受非空绝对路径，去重并保持顺序。
 * @param {{ workspaces?: unknown }} [config]
 * @returns {{ workspaces: string[], ignored: string[] }}
 */
export function normalizeWorkspaces(config) {
  const raw = config?.workspaces
  const entries = Array.isArray(raw) ? raw : []
  const workspaces = []
  const ignored = []
  const seen = new Set()
  for (const entry of entries) {
    if (typeof entry !== 'string') {
      ignored.push(String(entry))
      continue
    }
    const trimmed = entry.trim()
    if (trimmed === '' || !isAbsolute(trimmed)) {
      ignored.push(trimmed === '' ? '(空字符串)' : trimmed)
      continue
    }
    const resolved = resolve(trimmed)
    const key = normalizeForCompare(resolved)
    if (seen.has(key)) continue
    seen.add(key)
    workspaces.push(resolved)
  }
  return { workspaces, ignored }
}

/**
 * 判断 `inner` 是否等于 `outer` 或位于其下（大小写不敏感地适配 Windows）。
 * @param {string} inner
 * @param {string} outer
 */
export function isInside(inner, outer) {
  const from = normalizeForCompare(resolve(outer))
  const to = normalizeForCompare(resolve(inner))
  const rel = relative(from, to)
  if (rel === '') return true
  if (rel === '..' || rel.startsWith(`..${sep}`)) return false
  return !isAbsolute(rel)
}

/**
 * 解析一份技能 Markdown（frontmatter + 正文），不做文件 IO，便于单测。
 * @param {string} raw
 * @returns {{ name: string, description: string, whenToUse?: string, invocation: { modelInvocable: boolean, userInvocable: boolean }, content: string } | undefined}
 */
export function parseSkill(raw) {
  const parts = splitFrontmatter(raw)
  if (parts === undefined) return undefined
  const data = parseFrontmatter(parts.yaml)
  const skillName = scalarField(data.name)
  const description = scalarField(data.description)
  const whenToUse = scalarField(data.whenToUse)
  if (skillName === undefined || description === undefined) return undefined
  if (!NAME_PATTERN.test(skillName)) return undefined

  const disableModelInvocation = parseBooleanFlag(data['disable-model-invocation'])
  const userInvocable = parseBooleanFlag(data['user-invocable'])
  // 缺省合法（undefined），非法拼写按 DSH 约定整条丢弃。
  if (disableModelInvocation === null || userInvocable === null) return undefined

  return {
    name: skillName,
    description,
    ...(whenToUse === undefined ? {} : { whenToUse }),
    invocation: {
      modelInvocable: !(disableModelInvocation ?? false),
      userInvocable: userInvocable ?? true,
    },
    content: parts.body.trim(),
  }
}

/** 技能文件路径，测试与诊断用。 */
export const skillFile = SKILL_FILE

/** 读取技能文件；缺失或不可读时返回 undefined。 */
async function loadSkill(signal) {
  signal?.throwIfAborted()
  let raw
  try {
    raw = await readFile(SKILL_FILE, 'utf8')
  } catch {
    return undefined
  }
  signal?.throwIfAborted()
  return parseSkill(raw)
}

/**
 * 判断当前会话是否应拿到技能候选：
 * 工作目录必须在已配置工作区内，且该工作区的 `.dsh/skills` 里没有原生副本
 * （有副本时交给 DSH 原生 provider，避免同名重复）。
 */
async function workspaceCandidate(options, workspaces, ctx) {
  const cwd = options?.cwd
  if (typeof cwd !== 'string' || cwd.trim() === '') return undefined
  const directory = resolve(cwd)
  if (!workspaces.some((root) => isInside(directory, root))) return undefined
  if (await hasNativeSkill(directory)) return undefined

  const skill = await loadSkill(options?.signal)
  if (skill === undefined) {
    warn(ctx, `无法读取技能文件：${SKILL_FILE}`)
    return undefined
  }
  return toCandidate(skill)
}

/** 工作区（项目根）里是否已有该技能的原生副本。 */
async function hasNativeSkill(directory) {
  const root = await projectRootOf(directory)
  const skillsRoot = join(root, '.dsh', 'skills')
  return (
    (await fileExists(join(skillsRoot, SKILL_NAME, 'SKILL.md'))) ||
    (await fileExists(join(skillsRoot, `${SKILL_NAME}.md`)))
  )
}

/** 最近的含 `.git` 的祖先目录；没有则回退为当前目录。 */
async function projectRootOf(directory) {
  let current = directory
  for (;;) {
    if (await fileExists(join(current, '.git'))) return current
    const parent = dirname(current)
    if (parent === current) return directory
    current = parent
  }
}

async function fileExists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function toCandidate(skill) {
  return {
    name: skill.name,
    description: skill.description,
    ...(skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse }),
    invocation: skill.invocation,
    provider: PROVIDER_NAME,
    source: SKILL_SOURCE,
    resourceBase: { kind: 'directory', path: SKILL_DIR },
    rank: PROJECT_SKILL_RANK,
    locator: { skillFile: SKILL_FILE },
    path: SKILL_FILE,
  }
}

function toDefinition(skill) {
  return {
    name: skill.name,
    description: skill.description,
    ...(skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse }),
    invocation: skill.invocation,
    provider: PROVIDER_NAME,
    source: SKILL_SOURCE,
    resourceBase: { kind: 'directory', path: SKILL_DIR },
    path: SKILL_FILE,
    content: skill.content,
  }
}

const BOOLEAN_TRUE = new Set(['true', 'yes', 'on', '1'])
const BOOLEAN_FALSE = new Set(['false', 'no', 'off', '0'])

/** 解析 YAML 风格布尔值；缺省返回 undefined（调用方决定默认值），非法拼写返回 null。 */
function parseBooleanFlag(value) {
  if (value === undefined) return undefined
  const normalized = String(value).trim().toLowerCase()
  if (BOOLEAN_TRUE.has(normalized)) return true
  if (BOOLEAN_FALSE.has(normalized)) return false
  return null
}

function normalizeForCompare(path) {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

/** 拆出 frontmatter 行与正文；无合法 frontmatter 时返回 undefined。 */
function splitFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return undefined
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() !== '---') continue
    return {
      yaml: lines.slice(1, index),
      body: lines.slice(index + 1).join('\n'),
    }
  }
  return undefined
}

/** 只解析本技能需要的 YAML 子集：标量、引号、块标量，其余行忽略。 */
function parseFrontmatter(lines) {
  const data = {}
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '' || /^\s*#/.test(line)) {
      index += 1
      continue
    }
    const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(line)
    if (match === null) {
      index += 1
      continue
    }
    const key = match[1]
    const rest = match[2].trim()
    if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-' || rest === '|+' || rest === '>+') {
      const block = []
      index += 1
      while (index < lines.length && (lines[index].startsWith(' ') || lines[index].startsWith('\t'))) {
        block.push(lines[index].trim())
        index += 1
      }
      data[key] = rest.startsWith('|') ? block.join('\n') : block.join(' ').replace(/\s+/g, ' ')
      continue
    }
    data[key] = unquote(rest)
    index += 1
  }
  return data
}

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if (first === last && (first === "'" || first === '"')) {
      const inner = value.slice(1, -1)
      return first === "'" ? inner.replaceAll("''", "'") : inner.replaceAll('\\"', '"').replaceAll('\\\\', '\\')
    }
  }
  return value
}

function scalarField(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function warn(ctx, message) {
  try {
    const logger = typeof ctx?.logger === 'function' ? ctx.logger('dynamic-competition-four-images') : undefined
    logger?.warn?.(message)
  } catch {
    // 日志服务不可用时保持静默，不影响技能提供。
  }
}
