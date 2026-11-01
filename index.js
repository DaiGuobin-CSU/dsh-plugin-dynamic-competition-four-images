/**
 * dsh-plugin-dynamic-competition-four-images — 宿主半边
 *
 * 插件本身安装在 DSH profile（全局）。它不注册任何全局技能，也不自动把技能
 * 注入工作区；只提供三个 loopback 桥接口，供 Client 半边的设置页使用：
 *
 *   POST /api/dsh-plugin-dynamic-competition-four-images/describe
 *   POST /api/dsh-plugin-dynamic-competition-four-images/install
 *   POST /api/dsh-plugin-dynamic-competition-four-images/versions
 *
 * `install` 把包内 `.dsh/skills/<name>/` 复制到用户选择的工作区
 * `<workspace>/.dsh/skills/<name>/`，此后由 DSH 原生 filesystem provider 以
 * source `project-dsh` 发现，即成为该工作区的工作区技能。
 *
 * @module dsh-plugin-dynamic-competition-four-images
 */

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis 插件名。 */
export const name = 'dynamic-competition-four-images'

const PACKAGE_ROOT = fileURLToPath(new URL('./', import.meta.url))
/** 包内技能源目录：随包发布的技能本体（普通目录，避免依赖 .dsh 路径）。 */
export const SKILLS_ROOT = join(PACKAGE_ROOT, 'skills')
const BRIDGE_PREFIX = '/api/dsh-plugin-dynamic-competition-four-images'
const MAX_JSON_BODY_BYTES = 64 * 1024
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 业务错误：桥接口把它翻译成 4xx + code。 */
export class BridgeError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'BridgeError'
    this.code = code
  }
}

/** 注册 loopback 路由；webServer 缺席时静默不启用。 */
export function apply(ctx) {
  ctx.inject(['webServer'], (sctx) => {
    sctx.effect(() => {
      const disposers = createBridgeRoutes().map((route) => sctx.webServer.register(route))
      return () => {
        for (const dispose of disposers) dispose()
      }
    }, 'dynamic-competition-four-images: skill bridge')
  })
}

/** 组出桥路由（供 webServer.register 与单测使用）。 */
export function createBridgeRoutes(options = {}) {
  const skillsRoot = options.skillsRoot ?? SKILLS_ROOT
  const latestResolver = options.latestResolver ?? (() => fetchLatestVersion())
  return [
    defineRoute('/describe', async (body) => {
      const skills = await readSkills(skillsRoot)
      let workspacePath
      if (typeof body?.workspacePath === 'string' && body.workspacePath.trim() !== '') {
        workspacePath = await resolveWorkspace(body.workspacePath)
      }
      const list = []
      for (const skill of skills) {
        list.push({
          name: skill.name,
          description: skill.description,
          status: workspacePath === undefined ? 'unselected' : await skillStatus(skill, workspacePath),
        })
      }
      return { version: await packageVersion(), workspacePath: workspacePath ?? null, skills: list }
    }),

    defineRoute('/install', async (body) => {
      const workspacePath = await resolveWorkspace(body?.workspacePath)
      const skills = await readSkills(skillsRoot)
      const wanted = typeof body?.skillName === 'string' ? body.skillName : skills[0]?.name
      const skill = skills.find((entry) => entry.name === wanted)
      if (skill === undefined) {
        throw new BridgeError('skill-not-found', `插件内没有名为 ${String(wanted)} 的技能`)
      }
      const before = await skillStatus(skill, workspacePath)
      const copied = await installSkill(skill, workspacePath)
      return {
        skillName: skill.name,
        workspacePath,
        targetPath: copied.target,
        status: copied.written === 0 ? 'unchanged' : before === 'missing' ? 'installed' : 'updated',
        written: copied.written,
        unchanged: copied.unchanged,
        total: copied.total,
      }
    }),

    /**
     * 版本信息：本地已装版本 + npm 上的最新版本。
     * 最新版本查不到时返回 null，Client 半边静默降级（只显示本地版本）。
     */
    defineRoute('/versions', async () => {
      const identity = await packageIdentity()
      let latest
      try {
        latest = await latestResolver()
      } catch {
        latest = undefined
      }
      return {
        name: identity.name,
        version: identity.version,
        latestVersion: typeof latest === 'string' && latest !== '' ? latest : null,
      }
    }),
  ]
}

/** 读取包内全部技能（目录名必须与 frontmatter name 一致）。 */
export async function readSkills(root = SKILLS_ROOT) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const skills = []
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    const directory = join(root, entry.name)
    let raw
    try {
      raw = await readFile(join(directory, 'SKILL.md'), 'utf8')
    } catch {
      continue
    }
    const parsed = parseSkillMarkdown(raw)
    if (parsed === undefined || parsed.name !== entry.name) continue
    skills.push({ name: parsed.name, description: parsed.description, directory })
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name))
}

/** 目标工作区里该技能的状态：missing / outdated / up-to-date。 */
export async function skillStatus(skill, workspacePath) {
  return skillStatusAt(skill, targetDirectory(skill.name, workspacePath))
}

/** 目标目录里该技能的状态（测试与复用入口）。 */
export async function skillStatusAt(skill, target) {
  const exists = await directoryExists(target)
  if (!exists) return 'missing'
  let differing = 0
  for (const file of await walkFiles(skill.directory)) {
    const source = await readFile(file.absolute).catch(() => undefined)
    const current = await readFile(join(target, file.relative)).catch(() => undefined)
    if (source === undefined || current === undefined || !source.equals(current)) differing += 1
  }
  return differing === 0 ? 'up-to-date' : 'outdated'
}

/** 把技能复制进工作区；返回写入/未变/总数。 */
export async function installSkill(skill, workspacePath) {
  return copySkillTo(skill, targetDirectory(skill.name, workspacePath))
}

/** 把技能复制到目标目录（测试与复用入口）；只覆盖有变化的文件。 */
export async function copySkillTo(skill, target) {
  const files = await walkFiles(skill.directory)
  let written = 0
  let unchanged = 0
  for (const file of files) {
    const destination = join(target, file.relative)
    const source = await readFile(file.absolute)
    const current = await readFile(destination).catch(() => undefined)
    if (current !== undefined && current.equals(source)) {
      unchanged += 1
      continue
    }
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, source)
    written += 1
  }
  return { target, written, unchanged, total: files.length }
}

/** 工作区技能目标目录：<workspace>/.dsh/skills/<name>。 */
function targetDirectory(skillName, workspacePath) {
  return join(workspacePath, '.dsh', 'skills', skillName)
}

/** 校验并规范化用户给出的工作区路径。 */
export async function resolveWorkspace(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new BridgeError('workspace-required', '缺少工作区路径')
  }
  const trimmed = input.trim()
  if (!isAbsolute(trimmed)) {
    throw new BridgeError('workspace-not-absolute', '工作区路径必须是绝对路径')
  }
  const path = resolve(trimmed)
  const info = await stat(path).catch(() => undefined)
  if (info === undefined || !info.isDirectory()) {
    throw new BridgeError('workspace-not-found', '工作区目录不存在或不是目录')
  }
  return path
}

/** npm registry 最新版本缓存：成功缓存 30 分钟，失败 5 分钟后重试。 */
export const latestVersionCache = { at: 0, version: undefined }
const LATEST_TTL_MS = 30 * 60 * 1000
const LATEST_RETRY_MS = 5 * 60 * 1000
const LATEST_TIMEOUT_MS = 4000
const DEFAULT_PACKAGE_NAME = 'dsh-plugin-dynamic-competition-four-images'

/**
 * 查 npm registry 上本包的最新版本。
 * 任何失败（离线、超时、非 200）都返回 undefined，由调用方降级处理。
 */
export async function fetchLatestVersion(options = {}) {
  const cache = options.cache ?? latestVersionCache
  const now = options.now ?? Date.now()
  const ttl = cache.version === undefined ? LATEST_RETRY_MS : LATEST_TTL_MS
  if (cache.at !== 0 && now - cache.at < ttl) return cache.version

  const fetcher = options.fetch ?? globalThis.fetch
  if (typeof fetcher !== 'function') return undefined
  const identity = await packageIdentity()
  try {
    const response = await fetcher(`https://registry.npmjs.org/${encodeURIComponent(identity.name)}/latest`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(LATEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    const version = typeof payload?.version === 'string' && payload.version !== '' ? payload.version : undefined
    cache.at = now
    cache.version = version
    return version
  } catch {
    cache.at = now
    cache.version = undefined
    return undefined
  }
}

async function packageIdentity() {
  try {
    const raw = await readFile(join(PACKAGE_ROOT, 'package.json'), 'utf8')
    const parsed = JSON.parse(raw)
    return {
      name: typeof parsed.name === 'string' && parsed.name !== '' ? parsed.name : DEFAULT_PACKAGE_NAME,
      version: typeof parsed.version === 'string' ? parsed.version : '0.0.0',
    }
  } catch {
    return { name: DEFAULT_PACKAGE_NAME, version: '0.0.0' }
  }
}

async function packageVersion() {
  return (await packageIdentity()).version
}

async function walkFiles(directory, prefix = '') {
  const entries = await readdir(join(directory, prefix), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(directory, relative)))
      continue
    }
    if (entry.isFile() || entry.isSymbolicLink()) files.push({ relative, absolute: join(directory, relative) })
  }
  return files
}

async function directoryExists(path) {
  const info = await stat(path).catch(() => undefined)
  return info !== undefined && info.isDirectory()
}

/** loopback 守卫：只接受本机同源 POST。 */
export function isLoopbackRequest(request) {
  const address = request?.socket?.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers?.host
  if (typeof host !== 'string') return false
  let hostUrl
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** 解析技能 Markdown 的 frontmatter（本插件只需 name/description）。 */
export function parseSkillMarkdown(raw) {
  const text = raw.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return undefined
  let end = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      end = index
      break
    }
  }
  if (end < 0) return undefined
  const data = {}
  for (let index = 1; index < end; index += 1) {
    const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(lines[index])
    if (match === null) continue
    let value = match[2].trim()
    if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) value = value.slice(1, -1).replaceAll("''", "'")
    else if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1)
    data[match[1]] = value
  }
  const skillName = typeof data.name === 'string' ? data.name.trim() : ''
  const description = typeof data.description === 'string' ? data.description.trim() : ''
  if (skillName === '' || description === '' || !NAME_PATTERN.test(skillName)) return undefined
  return { name: skillName, description }
}

function defineRoute(operation, handle) {
  return {
    kind: 'exact',
    path: `${BRIDGE_PREFIX}${operation}`,
    handler: async (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, code: 'forbidden', message: 'loopback requests only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'POST only' })
        return
      }
      let body
      try {
        body = await readJsonBody(req)
      } catch {
        writeJson(res, 400, { ok: false, code: 'body-too-large', message: 'JSON body too large' })
        return
      }
      if (body === undefined) {
        writeJson(res, 400, { ok: false, code: 'bad-json', message: 'JSON body required' })
        return
      }
      try {
        writeJson(res, 200, { ok: true, value: await handle(body ?? {}) })
      } catch (error) {
        const known = error instanceof BridgeError
        writeJson(res, known ? 400 : 500, {
          ok: false,
          code: known ? error.code : 'internal',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }
}

function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_JSON_BODY_BYTES) throw new Error('body too large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}
