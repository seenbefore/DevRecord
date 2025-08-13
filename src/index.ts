#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, extname, basename } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 工具参数验证 schemas
const GetTemplateListSchema = z.object({
  dummy: z.string().optional().describe("Dummy parameter for no-parameter tools")
});

const GetTemplateDetailSchema = z.object({
  templateName: z.string().describe("模板文件名（不包含扩展名），必须使用 get_template_list 返回的 templates 中的 templateName")
});

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

// 获取模板目录路径
function getTemplateDir(): string {
  // 如果在build目录中运行，需要回到上级目录找src/template
  const srcDir = __dirname.includes('build') ? join(__dirname, '..', 'src') : __dirname;
  return join(srcDir, "template");
}

// 获取记录目录路径
function getRecordDir(): string {
  // 如果在build目录中运行，需要回到上级目录找src/record
  const srcDir = __dirname.includes('build') ? join(__dirname, '..', 'src') : __dirname;
  return join(srcDir, "record");
}

// 确保记录目录存在
async function ensureRecordDir(): Promise<void> {
  const recordDir = getRecordDir();
  if (!existsSync(recordDir)) {
    await mkdir(recordDir, { recursive: true });
  }
}

// 根据模板名称获取描述
function getTemplateDescription(templateName: string): string {
  const descriptions: Record<string, string> = {
    "meeting-record": "会议记录模板 - 用于记录会议内容、决策和行动项",
    "project-summary": "项目总结模板 - 用于总结项目进展、问题和计划",
    "learning-notes": "学习笔记模板 - 用于记录学习内容和心得体会",
    "daily-standup": "每日站会模板 - 用于记录团队每日站会内容"
  };
  
  return descriptions[templateName] || "通用记录模板";
}

// Server setup
const server = new Server(
  {
    name: "devrecord-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// 工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_template_list",
        description:
          "获取可用的开发记录模板列表。返回包含模板名称、文件名和描述的结构化数据。" +
          "返回的 templates 数组中每个模板都有 templateName 字段，这是后续调用 get_template_detail 时必需的参数。" +
          "使用此工具来发现可用的模板，然后使用返回的 templateName 来获取具体模板内容。",
        inputSchema: zodToJsonSchema(GetTemplateListSchema) as ToolInput,
      },
      {
        name: "get_template_detail",
        description:
          "获取指定模板的详细内容。templateName 参数必须使用 get_template_list 返回的 templates 中的 templateName 值。" +
          "这确保了参数的准确性和一致性。返回模板的完整内容，可用于创建新的开发记录文档。" +
          "如果模板不存在，会返回明确的错误信息。",
        inputSchema: zodToJsonSchema(GetTemplateDetailSchema) as ToolInput,
      },
    ],
  };
});

// 工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_template_list": {
        const parsed = GetTemplateListSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for get_template_list: ${parsed.error}`);
        }

        try {
          const templateDir = getTemplateDir();
          const files = await readdir(templateDir);
          
          // 过滤出 .md 文件并构建模板信息
          const templates = files
            .filter((file: string) => extname(file) === ".md")
            .map((file: string) => {
              const templateName = basename(file, ".md");
              return {
                templateName,
                filename: file,
                description: getTemplateDescription(templateName)
              };
            });

          // 返回标准化格式，便于AI识别和使用
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  templates,
                  count: templates.length,
                  message: `Found ${templates.length} available templates`,
                  usage: "Use the 'templateName' field from any template to call get_template_detail"
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `Failed to get template list: ${errorMessage}`,
                  templates: []
                }, null, 2)
              }
            ],
            isError: true,
          };
        }
      }

      case "get_template_detail": {
        const parsed = GetTemplateDetailSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for get_template_detail: ${parsed.error}`);
        }

        try {
          const { templateName } = parsed.data;
          const templateDir = getTemplateDir();
          const templatePath = join(templateDir, `${templateName}.md`);
          
          if (!existsSync(templatePath)) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: `Template '${templateName}' does not exist`,
                    templateName,
                    suggestion: "Use get_template_list to see available templates"
                  }, null, 2)
                }
              ],
              isError: true,
            };
          }

          const content = await readFile(templatePath, "utf-8");
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  templateName,
                  content,
                  description: getTemplateDescription(templateName),
                  message: `Successfully retrieved template '${templateName}'`
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `Failed to get template detail: ${errorMessage}`,
                  templateName: parsed.data?.templateName || "unknown"
                }, null, 2)
              }
            ],
            isError: true,
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// 启动服务器
async function runServer() {
  try {
    // 确保记录目录存在
    await ensureRecordDir();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error("DevRecord MCP Server running on stdio");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
