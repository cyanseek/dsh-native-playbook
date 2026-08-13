# dsh-native-playbook

**先用好 DeepSeek Harness 官方已经自带的能力，再考虑重复造轮子。**

DeepSeek Harness 已经包含文件编辑、代码搜索、后台任务、Subagent、Workflow、Ralph、
Goal、Web Search、LSP seam、Session Query 等大量能力。本插件帮助人和 Coding Agent 判断：
**当前任务该优先使用哪个原生能力，以及它在当前 DSH profile 中是否真的可用。**

> 任务 → 原生能力 → 当前可用性 → 直接使用

[English](./README.md)

![终端查询把后台测试任务映射到原生 bash 与 job_output 能力。](./assets/demo.svg)

## 三个常见任务

```text
后台运行测试
→ bash(run_in_background=true) → job_output

查找符号的全部引用
→ lsp → 未配置 provider 时回退 grep

让另一个 Agent 调查，我继续工作
→ subagent → list_agents / send_message
```

不需要手写 PID 管理，不需要立刻安装 code-map 插件，也不需要自建多 Agent 脚本。

## 快速开始

### 作为 DSH 插件安装

通过 DSH 官方插件命令，把 GitHub 仓库安装到一个 DSH profile：

```bash
dsh plugin --profile web add github:cyanseek/dsh-native-playbook
```

如果使用本地 checkout，请在仓库根目录运行：

```bash
dsh plugin --profile web add .
```

本 package 通过 `package.json` 和 `cordis.patch.yml` 声明正式的 DSH bundle layer。挂载后，
它会在该 DSH profile 内注册一个模型可见工具 `native_capability`。这个工具复用 CLI/API
的同一个 resolver，并把调用 Agent 当前可见的能力标记为 `ready`，不会维护第二份 Catalog。

从 Git 安装时，package 会通过 `prepare` 构建 TypeScript 源码。pnpm 10 可能先要求在该
profile 的 `pnpm-workspace.yaml` 中允许构建；按 DSH/pnpm 打印的 key 配置后，重新执行命令即可。

### 为 Codex 安装 Agent Skill

```bash
npx skills@latest add cyanseek/dsh-native-playbook \
  --skill dsh-native-playbook \
  --agent codex \
  --yes
```

安装后正常使用 Coding Agent 即可，无须每次在提示词里提到本项目。

仓库同时提供当前官方 Codex skill-only plugin 入口 `.codex-plugin/plugin.json`。该 manifest
直接指向同一份 `skills/`，不会复制 resolver 或维护第二份能力表。格式说明见官方
[Codex 插件打包文档](https://developers.openai.com/plugins/build/plugins)。

### 从仓库运行 CLI

```bash
git clone https://github.com/cyanseek/dsh-native-playbook.git
cd dsh-native-playbook
corepack enable
pnpm install --frozen-lockfile
pnpm build

pnpm dsh-native lookup "后台运行测试"
pnpm dsh-native lookup "查找全部符号引用" --json
pnpm dsh-native status --profile web
```

npm package metadata 已准备好，但在 npm registry 首次发布完成前，本 README 不会声称
`npx dsh-native-playbook@latest` 已经可用。

### 安装到 DSH 会扫描的 Skill 根目录

安装到当前项目：

```bash
pnpm dsh-native install --target project
```

Skill 会复制到 `.agents/skills/dsh-native-playbook/`。

安装到当前用户的 DSH：

```bash
pnpm dsh-native install --target dsh
```

Skill 会复制到 `$DSH_HOME/skills/dsh-native-playbook/`；未设置 `DSH_HOME` 时使用
`~/.dsh/skills/`。

## 本项目增加了什么

DSH 官方 Catalog 是面向实现的权威事实来源。本仓库在它之上增加任务导向决策层：

- 人工维护的“任务 → 原生能力”映射；
- 固定到一个精确上游 commit 的自动生成快照；
- 通过 `dsh --profile <name> --dump-config` 实现的 profile 状态检查；
- DSH runtime 插件、CLI 和 Node API 共享的唯一 resolver；
- 一个短小的 Agent Skill，以及按需加载的 focused references 和真实配方。

它不是第三方插件市场，不替代 DSH 官方文档，也不是从第一章开始学习的通用教程。

## 与 DeepSeek Harness 的关系

这个仓库是树外 DSH 插件的分发仓库，不是 Harness fork，也不是用来替代 DSH 的独立
Harness。仓库单独分发，正是 DSH 官方
`dsh plugin --profile <name> add <package-or-git-spec>` 安装外部 bundle layer 的方式。
它与 DSH 的运行时联系是明确的：

- `dsh.bundle.patch` manifest 会在 profile 中激活 `dsh-native-playbook/plugin`；
- adapter 通过该 profile 的 `ctx.tools` 服务注册 `native_capability`；
- 当前可用性来自调用它的 DSH Agent 的实时工具视图；
- 自动生成的事实固定到 DSH 官方仓库的精确 commit。

## Native-first 原则

安装第三方 DSH 插件或编写 workaround 之前：

1. 先检查 DSH 是否已经提供原生能力；
2. 优先使用当前已经 ready 的最专用能力；
3. 区分 `ready`、`platform-dependent`、`opt-in`、`requires-provider` 和 `disabled`；
4. 对条件能力使用官方激活路径；
5. 原生路径确实不足时，再考虑外部实现。

仅仅存在一个 package，不能证明能力已经 ready。

## CLI

```text
dsh-native lookup "<task>" [--profile <name>] [--json]
dsh-native status --profile <name> [--json]
dsh-native list [--profile <name>] [--json]
dsh-native explain <capability> [--profile <name>] [--json]
dsh-native doctor [--json]
dsh-native install --target project|dsh [--json]
```

没有安装 DSH 时，静态 `lookup` 仍可使用随包数据。Profile 状态通过官方 config-dump 命令
推导，不会为了检查状态启动 Web UI。JSON 模式的 stdout 只包含 JSON，错误也使用结构化 JSON。

示例：

```bash
pnpm dsh-native lookup "为后台任务开发自定义插件" --json
```

结果会推荐原生 Shell Jobs，并把 `externalPluginNeeded` 设为 `false`。

## Node API

```ts
import {
  inspectDshProfile,
  lookupNativeCapability,
} from 'dsh-native-playbook'

const profile = await inspectDshProfile({ profile: 'web' })
const result = await lookupNativeCapability(
  '后台运行一个耗时测试',
  { profile },
)
```

公开 API：

- `listNativeCapabilities`
- `lookupNativeCapability`
- `explainNativeCapability`
- `inspectDshProfile`
- `loadTaskMap`

所有 API 都不会主动询问用户。

## 上游事实

`generated/upstream.json` 由官方
[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
仓库生成，并记录精确 commit 和源文件。人工维护的任务映射独立保存在
`catalog/task-map.yml`。

```bash
pnpm sync:upstream
pnpm verify:upstream
```

上游同步是显式开发操作；普通离线使用不会访问网络，也不需要 GitHub token。本项目没有遥测，
也没有 `postinstall` hook。

## 开发

需要 Node.js 22 或 24，以及 pnpm 10。

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm validate:skill
pnpm validate:plugin
pnpm validate:dsh-plugin
pnpm verify:upstream
pnpm smoke:json
```

CI 在 Linux、macOS、Windows 的 Node 22 和 24 上运行同样的检查。

## 参与贡献

最有价值的贡献包括缺失的任务映射、更准确的原生 fallback、修正 profile 状态，以及能避免
重复造轮子的真实 Recipe。详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 安全

详见 [SECURITY.md](./SECURITY.md)。请勿在 Issue 中提交凭据或私有 profile dump。

## 许可证

[MIT](./LICENSE)
