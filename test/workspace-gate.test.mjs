import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import { apply, isInside, normalizeWorkspaces, parseSkill, skillFile } from '../index.js'

const SKILL_NAME = 'dynamic-competition-analysis-four-images-model'

function fakeContext() {
  const providers = []
  const ctx = {
    skills: {
      registerProvider(factory) {
        providers.push(factory())
        return () => {}
      },
    },
    logger: () => ({ warn() {} }),
  }
  return { ctx, providers }
}

async function makeWorkspace() {
  return mkdtemp(join(tmpdir(), 'dsh-four-images-'))
}

test('仓库内的 SKILL.md 可解析且 frontmatter 合法', async () => {
  const raw = await readFile(skillFile, 'utf8')
  const skill = parseSkill(raw)
  assert.equal(skill.name, SKILL_NAME)
  assert.match(skill.description, /动态竞争分析/)
  assert.match(skill.content, /^# 动态竞争分析/)
  assert.deepEqual(skill.invocation, { modelInvocable: true, userInvocable: true })
  // 技能正文引用的资源目录都在技能目录内
  for (const resource of ['reference/', 'references/', 'scripts/', 'examples/']) {
    assert.ok(skill.content.includes(resource), `正文应引用 ${resource}`)
  }
})

test('parseSkill 支持块标量 description 与 invocation 开关', () => {
  const skill = parseSkill(
    [
      '---',
      'name: demo-skill',
      'description: >',
      '  第一行',
      '  第二行',
      'whenToUse: 需要时使用',
      'disable-model-invocation: true',
      'user-invocable: "false"',
      '---',
      '',
      '# 正文',
    ].join('\n'),
  )
  assert.equal(skill.description, '第一行 第二行')
  assert.equal(skill.whenToUse, '需要时使用')
  assert.deepEqual(skill.invocation, { modelInvocable: false, userInvocable: false })
  assert.equal(skill.content, '# 正文')
})

test('parseSkill 对非法输入整条丢弃', () => {
  assert.equal(parseSkill('没有 frontmatter'), undefined)
  assert.equal(parseSkill('---\nname: Demo Skill\ndescription: x\n---\n'), undefined, 'name 必须是 kebab-case')
  assert.equal(parseSkill('---\nname: demo\ndescription: x\ndisable-model-invocation: maybe\n---\n'), undefined)
})

test('normalizeWorkspaces 只保留绝对路径并去重', () => {
  const root = resolve(tmpdir())
  const { workspaces, ignored } = normalizeWorkspaces({
    workspaces: [`  ${root}  `, root, 'relative\\path', '', 42],
  })
  assert.deepEqual(workspaces, [root])
  // 相对路径、空字符串与非字符串被忽略；重复的绝对路径只是去重，不算无效项
  assert.equal(ignored.length, 3)
})

test('isInside 判断工作区包含关系', () => {
  const root = resolve(tmpdir(), 'ws')
  assert.equal(isInside(root, root), true)
  assert.equal(isInside(join(root, 'project', 'src'), root), true)
  assert.equal(isInside(resolve(tmpdir(), 'other'), root), false)
  if (process.platform === 'win32') {
    assert.equal(isInside(root.toUpperCase(), root.toLowerCase()), true, 'Windows 下大小写不敏感')
  }
})

test('未配置 workspaces 时不注册提供者', () => {
  const { ctx, providers } = fakeContext()
  apply(ctx, { workspaces: [] })
  apply(ctx, {})
  assert.equal(providers.length, 0)
})

test('仅在工作区内提供工作区技能，并提供正文', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))

  const { ctx, providers } = fakeContext()
  apply(ctx, { workspaces: [root] })
  assert.equal(providers.length, 1)
  const provider = providers[0]

  const inside = await provider.list({ cwd: join(root, 'analysis') })
  assert.equal(inside.length, 1)
  assert.equal(inside[0].name, SKILL_NAME)
  assert.equal(inside[0].source, 'project-dsh')
  assert.equal(inside[0].path, skillFile)
  assert.deepEqual(inside[0].resourceBase, { kind: 'directory', path: join(skillFile, '..') })

  const definition = await provider.get(inside[0], {})
  assert.match(definition.content, /^# 动态竞争分析/)

  const outside = await provider.list({ cwd: resolve(tmpdir(), 'not-configured') })
  assert.deepEqual(outside, [])

  const missingCwd = await provider.list({})
  assert.deepEqual(missingCwd, [])
})

test('工作区已有原生 .dsh/skills 副本时不重复提供', async (t) => {
  const root = await makeWorkspace()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, '.git'))
  await mkdir(join(root, '.dsh', 'skills', SKILL_NAME), { recursive: true })
  await writeFile(join(root, '.dsh', 'skills', SKILL_NAME, 'SKILL.md'), '---\nname: x\ndescription: y\n---\n')

  const { ctx, providers } = fakeContext()
  apply(ctx, { workspaces: [root] })
  const provider = providers[0]
  assert.deepEqual(await provider.list({ cwd: join(root, 'project') }), [])
})
