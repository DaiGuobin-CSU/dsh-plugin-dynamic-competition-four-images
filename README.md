# 动态竞争-四象模型 Skill (dsh-plugin-dynamic-competition-four-images)

基于动态竞争理论构建的 DSH（DeepSeek Harness）插件，经过以「四象模型」为框架的改进，提供六维动态竞争评分能力。

**自 1.2.0 起：插件全局安装，插件内的技能由用户按工作区选择性添加**（设置 → 插件 → 四象模型），技能只写入被选择的工作区，不会成为全局技能。

## ✨ 核心能力

- 六维动态竞争评分（主 / 环 / 位 / 行 / 才 / 心）。
- AMC 张力分析、多点克制逻辑与十三项自检机制。
- 技能正文：包内 `skills/dynamic-competition-analysis-four-images-model/SKILL.md`。

## 🚀 安装

### 方式一：通过包名安装（推荐）

1. 在 DSH 插件页面点击 **「+ 添加插件」**，输入包名 `dsh-plugin-dynamic-competition-four-images`，安装并启用。
2. 退出并重启 DSH（宿主半边的技能桥在启动时注册）。
3. 安装插件**不会**把技能放进任何工作区，需要按下一节手动添加。

### 方式二：通过自定义插件市场安装

1. 开启「自定义插件市场」，添加索引源 URL：
   `https://rootandsource.github.io/dsh-plugin-dynamic-competition-four-images/plugin-index/index.json`
2. 搜索「动态竞争」或「四象」，点击卡片安装并启用，然后重启 DSH。

## ⬆️ 版本与「发布年龄」窗口

DSH 的 profile 默认启用 pnpm 的 `minimumReleaseAge`（1440 分钟 = 24 小时）：**发布不满 24 小时的版本默认不参与安装解析**。所以按包名安装时，刚发布的新版本可能被跳过，装到上一个满足条件的版本——插件页显示的版本号因此可能比刚发布的版本旧。

- **怎么看当前版本**：**设置 → 插件 → 四象模型** 页签标题下方会显示已装版本；若 npm 上已有更新的版本，会额外提示「有新版本 x.y.z」，并说明原因与处理方式。
- **想立刻用上新版本**：在插件页重新安装并选择该版本，或用「包名@版本号」安装：

  ```powershell
  dsh plugin --profile desktop add dsh-plugin-dynamic-competition-four-images@1.2.0
  # PATH 里没有 dsh 时，用 DSH 安装目录下的 resources\runtime\cli\bin\dsh.cmd
  ```

  若指定版本仍被拦截，在 profile 的 `pnpm-workspace.yaml` 里给该版本加一条豁免，再重装：

  ```yaml
  minimumReleaseAgeExclude:
    - dsh-plugin-dynamic-competition-four-images@1.2.0
  ```

- **不急的话**：等 24 小时后重新安装即可，不需要改任何配置。
- 无论哪种方式，装完都要**重启 DSH** 才会加载新版本代码。

## 🧩 把技能添加到工作区（UI）

打开 **设置 → 插件 → 四象模型** 页签：

1. 在「目标工作区」里选择一个已有工作区，或点「选择其他目录…」挑一个目录；
   - 状态徽标会显示：未安装 / 有更新可用 / 已是最新。
2. 点 **「添加到工作区」**。
3. 成功后会提示写入的文件数，以及安装位置：
   `<工作区>/.dsh/skills/dynamic-competition-analysis-four-images-model/`。

写入后由 DSH 原生 filesystem provider 以 source `project-dsh` 发现，即成为该工作区的工作区技能；其它工作区与全局技能列表都不受影响。

- **更新**：插件升级后再次点击「添加到工作区」，只会覆盖有变化的文件（内容一致的会跳过）。
- **移除**：删除该工作区里的 `.dsh/skills/dynamic-competition-analysis-four-images-model/` 目录即可。

## 🔁 从旧版（全局技能）迁移

1.1.x 及更早版本把技能复制到 `~/.dsh/skills/`，或按工作区路径自动提供技能。升级到 1.2.0 后：

- 删除旧全局副本（如果还在）：
  ```powershell
  Remove-Item -Recurse -Force "$env:USERPROFILE\.dsh\skills\dynamic-competition-analysis-four-images-model"
  ```
- 旧版 `workspaces` 配置项已废弃，`cordis.patch.yml` 里针对本插件的 `config.workspaces` 可以删掉。
- 需要在某个工作区使用技能时，用上面的 UI 重新添加。

## 🧪 校验与开发

```powershell
node test/skill-installer.test.mjs   # 受限沙箱下请直接运行单文件（node --test test/ 会因 spawn EPERM 失败）
npm pack --dry-run                   # 确认 index.js / client.js / skills / locale / icon 随包发布
```

测试覆盖：frontmatter 解析、技能发现（目录名与 name 一致）、工作区路径校验、文件复制/状态判定（缺失、过期、最新、保留工作区额外文件）、桥路由的 loopback 与只读校验、错误码、版本接口与最新版本查询的缓存/失败降级。

## 📁 目录结构

```
dsh-plugin-dynamic-competition-four-images/
├── index.js                  # 宿主：技能发现 + loopback 桥（describe / install / versions）
├── client.js                 # 客户端：设置 → 插件 → 四象模型 页签
├── cordis.patch.yml          # bundle 行
├── locale/{zh,en}.json       # 插件显示名与描述
├── icon.svg                  # 插件图标
├── package.json              # dsh.bundle.patch + dsh.client
├── test/skill-installer.test.mjs
├── release/                  # 打包产物（当前 + 历史版本 tarball）
├── plugin-index/             # 自定义插件市场索引
├── skills/dynamic-competition-analysis-four-images-model/
    ├── SKILL.md
    ├── reference/four-images-model-governance.md
    ├── references/full-spec.md
    ├── scripts/dynamic_competition_skill.py
    └── examples/example_a.json, example_b.json
```

## 许可

MIT，详见 [LICENSE](LICENSE)。
