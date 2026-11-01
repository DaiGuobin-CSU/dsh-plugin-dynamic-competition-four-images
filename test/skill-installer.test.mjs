import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  SKILLS_ROOT,
  copySkillTo,
  createBridgeRoutes,
  isLoopbackRequest,
  parseSkillMarkdown,
  readSkills,
  resolveWorkspace,
  skillStatusAt,
} from '../index.js'

const SKILL_NAME = 'dynamic-competition-analysis-four-images-model'

/** 造一个临时「包内技能源」目录（不含 .dsh 组件，便于沙箱内测试）。 */
async function makeSkillSource(t, name = SKILL_NAME) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-four-images-src-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, name)
  await mkdir(join(directory, 'references'), { recursive: true })
  await mkdir(join(directory, 'scripts'), { recursive: true })
  await writeFile(
    join(directory, 'SKILL.md'),
    `---\nname: ${name}\ndescription: '示例技能说明'\n---\n\n# 示例技能\n`,
  )
  await writeFile(join(directory, 'references', 'full-spec.md'), '# 规范\n')
  await writeFile(join(directory, 'scripts', 'run.py'), 'print("hi")\n')
  return { root, directory, skill: { name, description: '示例技能说明', directory } }
}

async function makeDirectory(t, prefix = 'dsh-four-images-') {
  const root = await mkdtemp(join(tmpdir(), prefix))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

function makeRequest({ method = 'POST', body = {}, remoteAddress = '127.0.0.1', host = '127.0.0.1:39858' } = {}) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8')
  return {
    method,
    headers: { host, 'content-type': 'application/json' },
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      yield payload
    },
  }
}

async function callRoute(route, request) {
  const response = {
    status: 0,
    payload: undefined,
    writeHead(status) {
      this.status = status
    },
    end(body) {
      this.payload = body === undefined ? undefined : JSON.parse(String(body))
    },
  }
  await route.handler(request, response)
  return response
}

function findRoute(routes, suffix) {
  return routes.find((route) => route.path.endsWith(suffix))
}

test('parseSkillMarkdown 读取 name / description', () => {
  const parsed = parseSkillMarkdown("---\nname: demo-skill\ndescription: '一句话说明'\n---\n\n# 正文\n")
  assert.deepEqual(parsed, { name: 'demo-skill', description: '一句话说明' })
  assert.equal(parseSkillMarkdown('没有 frontmatter'), undefined)
  assert.equal(parseSkillMarkdown('---\nname: Demo\ndescription: x\n---\n'), undefined, 'name 必须是 kebab-case')
  assert.equal(parseSkillMarkdown('---\nname: demo\n---\n'), undefined, 'description 必填')
})

test('readSkills 只收集目录名与 frontmatter 一致的有效技能', async (t) => {
  const { root } = await makeSkillSource(t)
  await mkdir(join(root, 'no-skill-md'), { recursive: true })
  await mkdir(join(root, 'name-mismatch'), { recursive: true })
  await writeFile(join(root, 'name-mismatch', 'SKILL.md'), '---\nname: other-name\ndescription: x\n---\n')
  const skills = await readSkills(root)
  assert.equal(skills.length, 1)
  assert.equal(skills[0].name, SKILL_NAME)
  assert.equal(skills[0].description, '示例技能说明')
})

test('包内 skills/ 下的技能可被发现', async () => {
  const skills = await readSkills(SKILLS_ROOT)
  assert.equal(skills.length, 1)
  assert.equal(skills[0].name, SKILL_NAME)
  assert.match(skills[0].description, /动态竞争分析/)
})

test('resolveWorkspace 拒绝相对路径与不存在的目录', async (t) => {
  await assert.rejects(() => resolveWorkspace('relative/path'), /绝对路径/)
  await assert.rejects(() => resolveWorkspace(''), /缺少工作区路径/)
  await assert.rejects(() => resolveWorkspace(join(tmpdir(), 'dsh-four-images-missing-dir')), /不存在/)
  const root = await makeDirectory(t)
  assert.equal(await resolveWorkspace(root), root)
})

test('copySkillTo 写入目标目录，重复复制无变化，改动后可恢复', async (t) => {
  const { skill } = await makeSkillSource(t)
  const targetRoot = await makeDirectory(t)
  const target = join(targetRoot, 'installed')

  assert.equal(await skillStatusAt(skill, target), 'missing')
  const first = await copySkillTo(skill, target)
  assert.equal(first.total, 3)
  assert.equal(first.written, 3)
  assert.equal(await skillStatusAt(skill, target), 'up-to-date')

  const body = await readFile(join(target, 'SKILL.md'), 'utf8')
  assert.match(body, new RegExp(`name: ${SKILL_NAME}`))

  const again = await copySkillTo(skill, target)
  assert.equal(again.written, 0)
  assert.equal(again.unchanged, 3)

  await writeFile(join(target, 'SKILL.md'), `${body}\n<!-- 本地改动 -->\n`)
  assert.equal(await skillStatusAt(skill, target), 'outdated')
  const repaired = await copySkillTo(skill, target)
  assert.equal(repaired.written, 1)
  assert.equal(await skillStatusAt(skill, target), 'up-to-date')

  // 目标目录里的额外文件不会被删除
  await writeFile(join(target, 'local-note.txt'), 'keep me\n')
  await copySkillTo(skill, target)
  assert.equal(await readFile(join(target, 'local-note.txt'), 'utf8'), 'keep me\n')
})

test('桥路由：describe 汇总技能与工作区状态', async (t) => {
  const { root } = await makeSkillSource(t)
  const workspace = await makeDirectory(t)
  const routes = createBridgeRoutes({ skillsRoot: root })
  const describe = findRoute(routes, '/describe')
  assert.ok(describe)

  const empty = await callRoute(describe, makeRequest({ body: {} }))
  assert.equal(empty.status, 200)
  assert.equal(empty.payload.ok, true)
  assert.equal(empty.payload.value.skills.length, 1)
  assert.equal(empty.payload.value.skills[0].name, SKILL_NAME)
  assert.equal(empty.payload.value.skills[0].status, 'unselected')

  const withWorkspace = await callRoute(describe, makeRequest({ body: { workspacePath: workspace } }))
  assert.equal(withWorkspace.payload.value.workspacePath, workspace)
  assert.equal(withWorkspace.payload.value.skills[0].status, 'missing')

  const badWorkspace = await callRoute(describe, makeRequest({ body: { workspacePath: 'relative/path' } }))
  assert.equal(badWorkspace.status, 400)
  assert.equal(badWorkspace.payload.code, 'workspace-not-absolute')
})

test('桥路由：install 校验参数并返回明确错误码', async (t) => {
  const { root } = await makeSkillSource(t)
  const routes = createBridgeRoutes({ skillsRoot: root })
  const install = findRoute(routes, '/install')
  assert.ok(install)

  const missingWorkspace = await callRoute(install, makeRequest({ body: { workspacePath: join(tmpdir(), 'dsh-four-images-missing-dir') } }))
  assert.equal(missingWorkspace.status, 400)
  assert.equal(missingWorkspace.payload.code, 'workspace-not-found')

  const workspace = await makeDirectory(t)
  const unknownSkill = await callRoute(install, makeRequest({ body: { workspacePath: workspace, skillName: 'not-a-skill' } }))
  assert.equal(unknownSkill.status, 400)
  assert.equal(unknownSkill.payload.code, 'skill-not-found')
})

test('桥路由只接受 loopback POST', async (t) => {
  const { root } = await makeSkillSource(t)
  const describe = findRoute(createBridgeRoutes({ skillsRoot: root }), '/describe')

  const remote = await callRoute(describe, makeRequest({ remoteAddress: '10.0.0.9' }))
  assert.equal(remote.status, 403)

  const wrongMethod = await callRoute(describe, makeRequest({ method: 'GET' }))
  assert.equal(wrongMethod.status, 405)

  const badHost = await callRoute(describe, makeRequest({ host: 'evil.example:443' }))
  assert.equal(badHost.status, 403)

  assert.equal(isLoopbackRequest(makeRequest()), true)
  assert.equal(isLoopbackRequest(makeRequest({ remoteAddress: '::ffff:127.0.0.1' })), true)
  assert.equal(isLoopbackRequest(makeRequest({ host: 'evil.example:443' })), false)
})
