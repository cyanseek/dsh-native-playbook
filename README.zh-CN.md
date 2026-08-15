# dsh-native-playbook

**把你已经安装的 DeepSeek Harness 真正用起来。**

[![CI](https://github.com/cyanseek/dsh-native-playbook/actions/workflows/ci.yml/badge.svg)](https://github.com/cyanseek/dsh-native-playbook/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> 先用好 DeepSeek Harness 已经提供的能力，再考虑重复开发。

`dsh-native-playbook` 是连接
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区插件，不是独立的
Agent runtime。它只增加一个 `native_capability` 工具：把任务路由到 DSH 官方能力，判断整条
能力链是否可运行，并在条件明确时安全激活经过审核的原生路径。

[English](./README.md)

## 快速开始

把预构建的 GitHub package 安装到 DSH profile：

```bash
dsh plugin --profile web add github:cyanseek/dsh-native-playbook
```

**到这里就结束了。之后正常使用 DSH。** 直接描述目标，不需要记 package 名：

```text
在后台运行测试，结束后告诉我结果。
查找这个符号的全部引用。
从历史会话里查找部署方案。
```

这条路径不需要 clone 仓库、本地构建、批准构建脚本、账号、本项目 API key、本项目配置文件、
守护进程、第二次安装或手工验证。npm package 名留给后续正式发布；在此之前，上面的 GitHub
命令是受支持的安装方式。

## 常见任务会发生什么

| 任务 | 优先使用的原生路径 | 实际行为 |
| --- | --- | --- |
| 长时间命令 | `bash(run_in_background=true)` → `job_output` | 在支持的类 Unix profile 中直接可用；Windows 使用 `pwsh`。 |
| 符号导航 | `lsp` | 只有 provider 真正就绪时才用 LSP，否则回退 `grep` 和 `glob`。 |
| 历史会话搜索 | `session_search` | 使用官方、受 workspace 授权的查询工具；在经过验证的 DSH 版本中可首次使用时自动激活，并明确报告是否需要重启 DSH。 |
| 委派调查 | `subagent` → `list_agents` / `send_message` | 使用 DSH 内置的子 Agent 生命周期。 |
| 固定多步骤任务 | `workflow` | 优先使用确定性的原生工作流引擎，而不是 Shell 编排。 |

插件不会把“package 存在”或“看到了工具名”误判为能力已经可用。

## 可相信的就绪判断

每条推荐会区分五个生命周期事实：

| 事实 | 回答的问题 |
| --- | --- |
| `shipped` | 经过验证的 DSH 目录是否包含它？ |
| `mounted` | 工具或服务是否进入有效 profile？ |
| `visible` | 当前调用 Agent 能否看到它？ |
| `providerReady` | provider 前置条件是否真的满足？ |
| `operational` | Agent 现在能否使用它？ |

汇总状态为 `ready`、`platform-dependent`、`opt-in`、`requires-provider`、
`disabled` 或 `unsupported`。条件变更还会报告 `immediate`、`next-turn`、
`new-session` 或 `restart` 的生效时机。

## 安全激活

激活能力被刻意限制在很小的范围：

- 只能执行仓库中已经审核的配方。
- 当前 DSH 版本必须通过明确的兼容性门禁。
- 凭据、安全策略、网络 provider 和任意命令不在激活范围内。
- 每次修改都交给 DSH 校验且可恢复；验证失败时保留原始 profile。
- 停用时恢复精确保存的内容；如果用户后来修改过文件，则拒绝覆盖新修改。

第一条 Tier-1 配方会启用 DSH 官方、受 workspace 授权的会话全文搜索，并使用延迟打开的
本地索引。当前已验证的激活目标是 DSH `0.1.0-rc.6`。其他版本仍可使用静态查询，但不会
执行未经验证的配置修改。

## Agent Skill

相同的原生优先指导也以 Agent Skill 提供：

```bash
npx skills@latest add cyanseek/dsh-native-playbook \
  --skill dsh-native-playbook \
  --agent codex \
  --yes
```

Skill 保持聚焦，只加载当前任务所需的参考资料。

## CLI

CLI 是面向高级检查与自动化的界面。下面标注的命令都支持稳定 JSON 输出：

```text
dsh-native lookup "<task>" [--profile <name>] [--json]
dsh-native status --profile <name> [--json]
dsh-native list [--profile <name>] [--json]
dsh-native explain <capability> [--profile <name>] [--json]
dsh-native doctor [--json]
dsh-native install --target project|dsh [--json]
dsh-native plan <capability> --profile <name> [--json]
dsh-native activate <capability> --profile <name> [--json]
dsh-native deactivate <capability> --profile <name> [--json]
dsh-native verify <capability> --profile <name> [--json]
```

在开发 checkout 中的示例：

```bash
pnpm dsh-native lookup "查找全部符号引用" --json
pnpm dsh-native status --profile web --json
pnpm dsh-native plan session_search --profile web --json
```

## Node API

```ts
import {
  inspectDshProfile,
  lookupNativeCapability,
  planNativeActivation,
} from 'dsh-native-playbook'

const profile = await inspectDshProfile({ profile: 'web' })
const result = await lookupNativeCapability('后台运行一个耗时测试', { profile })
const plan = await planNativeActivation('session_search', { profile: 'web' })
```

公开 API 还导出 `listNativeCapabilities`、`explainNativeCapability`、
`activateNativeCapability`、`deactivateNativeCapability` 和
`verifyNativeCapability`。公开 API 不会弹出交互式询问。

## 兼容性与隐私

- 需要 Node.js 22 或 24，以及 DeepSeek Harness。
- 能力事实固定到 DSH 官方源码的一个明确 revision。
- 静态查询不要求 DSH；实时就绪判断需要已存在的 DSH profile。
- 不收集遥测。
- API 不访问凭据存储或私有会话内容。
- 本项目是社区扩展，与 DeepSeek 不存在官方从属或背书关系。

## 卸载

```bash
dsh plugin --profile web remove dsh-native-playbook
```

## 开发

```bash
corepack enable
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
pnpm smoke:consumer
pnpm metrics
```

CI 会在 Linux、macOS、Windows 的 Node.js 22 和 24 上运行这些门禁，并额外执行干净的
GitHub 消费者安装检查。

另见 [CONTRIBUTING.md](./CONTRIBUTING.md)、[SECURITY.md](./SECURITY.md) 和
[CHANGELOG.md](./CHANGELOG.md)。

## 许可证

[MIT](./LICENSE)
