# Changelog

## 0.2.0 (2026-05-29)

### 新增
- `/cc:doctor` 命令：综合诊断环境和插件状态
- `/cc:task` 支持 `--allowed-tools` 选项限制 Claude Code 可用工具
- `/cc:setup` 支持 `--enable-review-gate` / `--disable-review-gate` 选项
- 状态管理测试 (8 tests) 和作业控制测试 (6 tests)
- `.gitignore` 文件

### 改进
- Claude Code 输出解析器支持更多字段 (cost_usd, duration_ms, total_tokens)
- JSONL 流式输出解析改进
- stderr 错误检测
- 渲染器显示审查门状态
- README 中文文档完善

### 修复
- doctor 命令中 `require()` 在 ESM 模块中的兼容性问题

## 0.1.0 (2026-05-29)

### 初始发布
- 插件清单和钩子配置
- Claude Code CLI 客户端（打印模式 + 会话恢复）
- 核心命令: setup, task, review, adversarial-review, status, result, cancel
- 对抗性审查（结构化 JSON 输出）
- 作业状态持久化和追踪
- 会话生命周期钩子
- 47 个测试全部通过
