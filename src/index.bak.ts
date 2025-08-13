import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, extname, basename } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 工具参数验证 schemas
const GetTemplateListSchema = z.object({});

const GetTemplateDetailSchema = z.object({
  templateName: z.string().describe("模板文件名（不包含扩展名）"),
});

// Create server instance
const server = new McpServer({
  name: "devrecord",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

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

// 注册工具
server.tool(
  "get_template_list",
  "获取可用的模板列表",
  {},
  async () => {
    try {
      const templateDir = getTemplateDir();
      const files = await readdir(templateDir);
      
      // 过滤出 .md 文件
      const templates = files
        .filter(file => extname(file) === ".md")
        .map(file => {
          const templateName = basename(file, ".md");
          return {
            templateName,
            filename: file,
            description: getTemplateDescription(templateName)
          };
        });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              templates,
              message: `找到 ${templates.length} 个可用模板`
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
              error: `获取模板列表失败: ${errorMessage}`
            }, null, 2)
          }
        ]
      };
    }
  }
);

server.tool(
  "get_template_detail",
  "需要使用 get_template_list 返回的 templates 中的 templateName 来获取模板内容",
  {
    templateName: {
      type: "string",
      description: "由 get_template_list 返回的 templates 中的 templateName，必须填写",
      required: true
    }
  },
  async ({ templateName }) => {
    try {
      const templateDir = getTemplateDir();
      const templatePath = join(templateDir, `${templateName}.md`);
      
      if (!existsSync(templatePath)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `模板 '${templateName}' 不存在`
              }, null, 2)
            }
          ]
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
              message: `成功获取模板 '${templateName}' 的内容`
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
              error: `获取模板详情失败: ${errorMessage}`
            }, null, 2)
          }
        ]
      };
    }
  }
);

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

// 启动服务器
async function main() {
  try {
    // 确保记录目录存在
    await ensureRecordDir();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error("DevRecord MCP 服务器已启动");
  } catch (error) {
    console.error("启动服务器失败:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("服务器运行错误:", error);
  process.exit(1);
});