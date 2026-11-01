# 动态竞争-四象模型 Skill (dsh-plugin-dynamic-competition-four-images)

基于动态竞争理论构建的 DSH（DeepSeek Harness）插件，经过以「四象模型」为框架的改进，提供六维动态竞争评分能力。

**自 1.1.0 起，技能以「工作区技能」交付，不再写入全局技能目录。**

## ✨ 核心能力

- 六维动态竞争评分（主 / 环 / 位 / 行 / 才 / 心）。
- AMC 张力分析、多点克制逻辑与十三项自检机制。
- 技能正文：`.dsh/skills/dynamic-competition-analysis-four-images-model/SKILL.md`。

## 🗂️ 工作区技能的分层

DSH 的技能来自两级目录，本插件只使用工作区一级：

| 层级 | 目录 | 来源标记 | 本插件的做法 |
|---|---|---|---|
| 全局技能 | `<DSH_HOME>/skills`（如 `~/.dsh/skills`） | `user-dsh` | **不再写入**，也不注册全局技能 |
| 工作区技能 | `<项目根>/.dsh/skills` 或 `<项目根>/.agents/skills` | `project-dsh` / `project-agents` | 技能本体随包发布于此；插件也只在配置的工作区提供它 |

项目根 = 最近的含 `.git` 的祖先目录；没有 `.git` 时取会话工作目录。

## 🚀 安装与配置

### 方式一：通过包名安装（推荐）

1. 在 DSH 插件页面点击 **「+ 添加插件」**，输入包名 `dsh-plugin-dynamic-competition-four-images` 并安装、启用。
2. 在 profile 的 `cordis.patch.yml` 中把插件行限制到指定工作区：

```yaml
- id: dynamic-competition-four-images
  config:
    workspaces:
      - D:\Path\To\Your\Workspace          # 绝对路径；可写多条
      # - D:\Another\Workspace
```

3. 重启 DSH 生效。未配置 `workspaces` 时插件不提供技能（工作区里自带的 `.dsh/skills` 副本仍会被 DSH 原生发现）。

### 方式二：通过自定义插件市场安装

1. 在 DSH 中开启「自定义插件市场」。
2. 进入「发现」页面，添加索引源 URL：
   `https://rootandsource.github.io/dsh-plugin-dynamic-competition-four-images/plugin-index/index.json`
3. 搜索「动态竞争」或「四象」，点击卡片安装，再按方式一的第 2、3 步配置工作区。

### 配置项

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `workspaces` | `string[]` | `[]` | 允许使用该技能的工作区绝对路径。会话工作目录位于其中时，插件才提供技能；相对路径与空值会被忽略。 |

## 🔁 从旧版（全局技能）迁移

旧版本把整包复制到 `~/.dsh/skills/dynamic-competition-analysis-four-images-model`，导致技能在每个工作区都可见。迁移只需删除这份全局副本（技能本体已随插件/工作区提供）：

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.dsh\skills\dynamic-competition-analysis-four-images-model"
```

删除后，`~/.dsh/skills` 目录本身保留，不再出现 `dynamic-competition-analysis-four-images-model`。

## 🧪 校验

在仓库会话中，该技能应显示为工作区技能（来源 `project-dsh`）：

```powershell
node --test test/            # 或在受限沙箱中：node test/workspace-gate.test.mjs
npm pack --dry-run           # 确认 .dsh/skills 随包发布
```

单元测试覆盖：frontmatter 解析、工作区路径匹配（含 Windows 大小写）、未配置工作区时不注册、工作区外不可见、工作区已有原生副本时不重复提供。

## 📁 目录结构

```
dsh-plugin-dynamic-competition-four-images/
├── index.js                  # 按 workspaces 门控的技能提供者（不注册全局技能）
├── cordis.patch.yml          # bundle 行：workspaces 默认空
├── package.json              # dsh.bundle 清单与 files
├── test/workspace-gate.test.mjs
├── plugin-index/             # 自定义插件市场索引
└── .dsh/skills/dynamic-competition-analysis-four-images-model/
    ├── SKILL.md
    ├── reference/four-images-model-governance.md
    ├── references/full-spec.md
    ├── scripts/dynamic_competition_skill.py
    └── examples/example_a.json, example_b.json
```

## 许可

MIT，详见 [LICENSE](LICENSE)。
