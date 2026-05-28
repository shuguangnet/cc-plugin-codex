# cc-plugin-codex

> **在 Codex CLI 中驱动 Claude Code** — 无需离开 Codex 即可委托任务、运行代码审查、管理 Claude Code 会话。

灵感来自 [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)（让 Claude Code 驱动 Codex），本插件做**反向**操作：让 Codex 驱动 Claude Code。

## 功能一览

| 命令 | 描述 |
| --- | --- |
| `/cc:setup` | 检查 Claude Code CLI 可用性和认证状态 |
| `/cc:task` | 将编码任务委托给 Claude Code |
| `/cc:review` | 通过 Claude Code 运行代码审查 |
| `/cc:adversarial-review` | 运行对抗性审查（专注找 Bug） |
| `/cc:status` | 显示活跃和历史作业 |
| `/cc:result` | 查看已完成作业的结果 |
| `/cc:cancel` | 取消运行中的作业 |
| `/cc:doctor` | 综合诊断环境和插件状态 |

## 工作原理

插件通过以下方式与 Claude Code CLI (`claude`) 通信：

- **`claude -p`（打印模式）**：单次提示 → 响应，适合审查和快速任务
- **`--resume`**：恢复之前的对话，用于多轮任务工作流
- **`--output-format json`**：结构化输出解析，确保可靠的结果提取

## 安装

```bash
# 克隆到 Codex 插件目录
git clone https://github.com/shuguangnet/cc-plugin-codex.git ~/.codex/plugins/cc

# 或者创建符号链接
ln -s /path/to/cc-plugin-codex/plugins/cc ~/.codex/plugins/cc
```

### 前置条件

- **Node.js** ≥ 18
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Codex CLI** (`npm install -g @openai/codex`)

## 使用示例

### 检查环境

```bash
/cc:setup
/cc:setup --json
/cc:doctor
```

### 启用停止审查门

```bash
/cc:setup --enable-review-gate
```

### 委托任务

```bash
# 只读模式（计划模式）
/cc:task 重构 src/utils.ts 中的错误处理

# 写入模式（全自动，允许修改文件）
/cc:task --write 为 UserService 添加单元测试

# 指定模型
/cc:task --model claude-sonnet-4 优化数据库查询性能

# 恢复上次对话
/cc:task --resume-last 继续之前的工作

# 限制工具
/cc:task --allowed-tools "Read,Grep,Glob" 分析项目结构

# 后台运行
/cc:task --background --write 实现新的 API 端点
```

### 代码审查

```bash
# 审查当前工作树变更
/cc:review

# 审查相对于某个分支的变更
/cc:review --base main

# 对抗性审查（专注找 Bug）
/cc:adversarial-review 重点检查安全漏洞

# 后台审查
/cc:review --background
```

### 管理作业

```bash
# 查看所有作业
/cc:status

# 查看特定作业
/cc:status task-abc123

# 查看作业结果
/cc:result task-abc123

# 取消运行中的作业
/cc:cancel task-abc123
```

## 架构

```
plugins/cc/
├── .claude-plugin/plugin.json    # 插件清单
├── hooks/hooks.json              # 会话生命周期钩子
├── commands/                     # 斜杠命令定义
│   ├── setup.md
│   ├── task.md
│   ├── review.md
│   ├── adversarial-review.md
│   ├── status.md
│   ├── result.md
│   ├── cancel.md
│   └── doctor.md
├── scripts/
│   ├── cc-companion.mjs          # 主入口
│   ├── session-lifecycle-hook.mjs
│   ├── stop-review-gate-hook.mjs
│   └── lib/
│       ├── claude-code.mjs       # Claude Code CLI 客户端
│       ├── state.mjs             # 作业状态持久化
│       ├── tracked-jobs.mjs      # 作业生命周期追踪
│       ├── job-control.mjs       # 作业查询与控制
│       ├── render.mjs            # 输出渲染
│       ├── git.mjs               # Git 上下文助手
│       ├── process.mjs           # 进程管理
│       ├── args.mjs              # 参数解析
│       ├── fs.mjs                # 文件系统工具
│       ├── prompts.mjs           # 模板插值
│       └── workspace.mjs         # 工作区解析
├── prompts/                      # 提示模板
│   ├── adversarial-review.md
│   └── stop-review-gate.md
└── schemas/                      # JSON 模式
    └── review-output.schema.json
```

## 开发

```bash
# 运行测试
node --test tests/*.test.mjs

# 检查语法
node --check plugins/cc/scripts/cc-companion.mjs
```

## 许可证

MIT
