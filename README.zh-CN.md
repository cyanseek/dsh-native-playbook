# dsh-native-playbook

**先用好 DeepSeek Harness 已经提供的能力，再考虑重复开发。**

[![CI](https://github.com/cyanseek/dsh-native-playbook/actions/workflows/ci.yml/badge.svg)](https://github.com/cyanseek/dsh-native-playbook/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`dsh-native-playbook` 把日常任务映射到
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 原生能力，并检查这些能力
在当前 DSH profile 中是否可用。

> 任务 → 原生能力 → 可用状态 → 推荐操作

[English](./README.md)

![终端查询把后台测试任务映射到原生 bash 与 job_output 能力。](./assets/demo.svg)

## 为什么需要它

DSH 已经包含文件、Shell、后台任务、代码搜索、Subagent、Workflow、Goal、Web、Session
等大量能力。真正困难的是判断当前任务该用哪个能力，以及当前 profile 是否已经具备完整条件。

```text
后台运行测试
→ bash(run_in_background=true) → job_output

查找符号的全部引用
→ lsp → LSP provider 未就绪时回退 grep

让另一个 Agent 调查，我继续工作
→ subagent → list_agents / send_message
```

## 亮点

- **原生优先**：安装新插件或编写 workaround 前，先检查 DSH 已有能力。
- **真实 profile 状态**：区分 ready、opt-in、disabled 和 provider 依赖。
- **DSH runtime plugin**：在 DSH profile 内提供 `native_capability` 工具。
- **Agent Skill**：为 Codex 和兼容 Agent 提供聚焦的任务配方。
- **CLI 与 Node API**：可在终端、脚本和集成中使用相同结果。
- **默认离线**：静态查询没有遥测，也不会在安装时主动访问外部服务。

## 安装

### DSH 插件

从 GitHub 直接安装到 DSH profile：

```bash
dsh plugin --profile web add github:cyanseek/dsh-native-playbook
```

确认插件已经进入 profile：

```bash
dsh --profile web --dump-config
```

卸载命令：

```bash
dsh plugin --profile web remove dsh-native-playbook
```

Git 安装会从源码构建 package。如果 pnpm 提示需要批准构建，请按它显示的命令处理后重新安装。

### Agent Skill

为 Codex 安装 Skill：

```bash
npx skills@latest add cyanseek/dsh-native-playbook \
  --skill dsh-native-playbook \
  --agent codex \
  --yes
```

如果要在项目或 DSH 用户目录共享 Skill，也可以使用 CLI：

```bash
pnpm dsh-native install --target project
pnpm dsh-native install --target dsh
```

### 从 checkout 运行 CLI

需要 Node.js 22 或 24，以及 pnpm 10 或更高版本。

```bash
git clone https://github.com/cyanseek/dsh-native-playbook.git
cd dsh-native-playbook
corepack enable
pnpm install --frozen-lockfile
pnpm build

pnpm dsh-native lookup "后台运行测试"
pnpm dsh-native status --profile web
```

当前尚未发布 npm package，请使用上面的 GitHub 或 checkout 安装方式。

## 使用

安装到 DSH profile 后，可以直接用自然语言询问：

```text
后台运行测试应该优先使用哪个 DSH 原生能力？
```

`native_capability` 工具会返回原生推荐与当前可用状态。

CLI 同时支持人类可读和 JSON 输出：

```text
dsh-native lookup "<task>" [--profile <name>] [--json]
dsh-native status --profile <name> [--json]
dsh-native list [--profile <name>] [--json]
dsh-native explain <capability> [--profile <name>] [--json]
dsh-native doctor [--json]
dsh-native install --target project|dsh [--json]
```

示例：

```bash
pnpm dsh-native lookup "查找全部符号引用" --json
pnpm dsh-native lookup "为后台任务开发自定义插件" --json
pnpm dsh-native explain subagent --profile headless
```

## 可用状态

| 状态 | 含义 |
| --- | --- |
| `ready` | 当前 profile 可以使用该能力。 |
| `platform-dependent` | 是否可用取决于操作系统。 |
| `opt-in` | DSH 已提供，但当前 profile 尚未启用。 |
| `requires-provider` | 工具存在，但仍需配置 provider。 |
| `disabled` | 能力已存在，但在当前 profile 中被禁用。 |

仅仅存在一个 package，不会被当成能力已经 ready 的证据。

## Node API

```ts
import {
  inspectDshProfile,
  lookupNativeCapability,
} from 'dsh-native-playbook'

const profile = await inspectDshProfile({ profile: 'web' })
const result = await lookupNativeCapability('后台运行一个耗时测试', { profile })
```

公开 API 包括 `lookupNativeCapability`、`listNativeCapabilities`、
`explainNativeCapability`、`inspectDshProfile` 和 `loadTaskMap`。

## 范围与兼容性

- 这是社区维护的 DSH 扩展，不是 DeepSeek 官方项目。
- 它解决原生能力选择问题，不是第三方插件市场。
- 静态查询不要求安装 DSH；profile 状态检查需要可用的 `dsh` 命令和已存在的 profile。
- 能力映射会针对 DSH 官方源码的固定版本进行验证。
- 所有 API 都不会主动询问用户、发送遥测或读取凭据。

## 开发

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

CI 在 Linux、macOS、Windows 的 Node.js 22 和 24 上运行同样的检查。

## 参与贡献

欢迎补充缺失的任务映射、更好的原生 fallback、profile 状态修正和简洁配方。详见
[CONTRIBUTING.md](./CONTRIBUTING.md)。

## 安全

请按照 [SECURITY.md](./SECURITY.md) 报告安全问题。不要在公开 Issue 中提交凭据或私有
profile dump。

## 许可证

[MIT](./LICENSE)
