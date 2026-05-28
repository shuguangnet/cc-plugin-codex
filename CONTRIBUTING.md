# 贡献指南

感谢你对 cc-plugin-codex 的关注！

## 开发环境

```bash
git clone https://github.com/shuguangnet/cc-plugin-codex.git
cd cc-plugin-codex
```

### 前置条件

- Node.js ≥ 18
- Git

## 运行测试

```bash
node --test tests/*.test.mjs
```

## 代码风格

- 使用 ESM (`import`/`export`)
- 使用中文注释和提交信息
- 遵循现有代码风格

## 提交规范

使用中文提交信息，格式：

```
类型: 简短描述

详细说明（可选）
```

类型：
- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `test`: 测试
- `refactor`: 重构
- `chore`: 杂项

## 添加新命令

1. 在 `commands/` 目录创建 `.md` 文件定义命令
2. 在 `cc-companion.mjs` 添加处理函数
3. 在 `lib/render.mjs` 添加渲染函数
4. 在 `tests/` 添加测试
5. 更新 README.md

## 报告问题

请使用 GitHub Issues 报告问题，包含：
- 问题描述
- 复现步骤
- 期望行为
- 实际行为
- 环境信息
