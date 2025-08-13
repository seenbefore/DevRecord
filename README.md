# DevRecord MCP 服务器

一个专门用于记录和整理对话内容的 MCP (Model Context Protocol) 服务器，提供模板化的记录功能。

## 功能特性

- 🔧 **两个核心工具**：
  - `get_template_list`: 获取可用的记录模板列表
  - `get_template_detail`: 获取具体模板的详细内容

- 📝 **内置模板**：
  - **会议记录模板** (`meeting-record`): 用于记录会议内容、决策和行动项
  - **项目总结模板** (`project-summary`): 用于总结项目进展、问题和计划  
  - **学习笔记模板** (`learning-notes`): 用于记录学习内容和心得体会
  - **每日站会模板** (`daily-standup`): 用于记录团队每日站会内容

## 使用方式

### 1. 构建项目
```bash
npm run build
```

### 2. 启动服务器
```bash
npm start
# 或直接运行
node build/index.js
```

### 3. 在大模型中使用

当您对大模型说："帮我记录一下"，大模型会：

1. 调用 `get_template_list` 获取可用模板列表
2. 根据对话内容选择合适的模板
3. 调用 `get_template_detail` 获取模板详情
4. 按照模板规范总结对话内容
5. 生成 markdown 文档保存到 `src/record/` 目录

## 工具说明

### get_template_list
- **描述**: 获取所有可用的记录模板
- **参数**: 无
- **返回**: 模板列表，包含模板名称、文件名和描述

### get_template_detail
- **描述**: 获取指定模板的完整内容
- **参数**: 
  - `templateName` (string): 模板名称（不含扩展名）
- **返回**: 模板的完整markdown内容

## 目录结构

```
DevRecord/
├── src/
│   ├── index.ts          # MCP服务器主文件
│   ├── template/         # 模板目录
│   │   ├── meeting-record.md
│   │   ├── project-summary.md
│   │   ├── learning-notes.md
│   │   └── daily-standup.md
│   └── record/           # 生成的记录文档目录
├── build/                # 编译后的文件
├── package.json
└── tsconfig.json
```

## 添加自定义模板

1. 在 `src/template/` 目录下创建新的 `.md` 文件
2. 在 `src/index.ts` 的 `getTemplateDescription` 函数中添加描述
3. 重新构建项目

## 技术栈

- TypeScript
- Node.js
- MCP SDK (@modelcontextprotocol/sdk)
- Zod (参数验证)

## 开发说明

- 确保安装了 Node.js 和 npm
- 使用 TypeScript 进行开发
- 遵循 MCP 协议规范
- 支持跨平台运行（Windows/Linux/macOS） 