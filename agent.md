# agent.md — Electron 智能 PDF 阅读器（MinerU + OpenAI API + Agent + MCP）
作者：若鸿  
用途：供 Codex CLI 直接读取并生成完整可运行项目（以 **MVP 端到端闭环** 为第一目标）。

---

## 0. 项目一句话
构建一个 **桌面端（Electron）PDF 智能阅读器/后处理器**：导入 PDF → 本地用 MinerU 解析为结构化文档 → Agent 规划并调用工具与模型完成用户指定的“后处理任务”（任务类型可扩展）→ 左侧文档预览（Markdown/结构化视图），右侧对话框驱动 → 结果可回放、可导出多格式 → 兼容 MCP 工具协议。

---

## 1. 总目标与设计原则（必须遵守）
1. **任务可扩展**：后处理任务是“插件化能力”，不要把某个示例任务写死在代码结构里。
2. **本地优先**：MinerU 解析、索引、缓存默认全部本地；仅在必要时将“最小片段”发给模型。
3. **可复现与可回放**：每次任务运行都生成 artifacts（plan、steps、日志、输出文件），支持断点续跑。
4. **稳定性优先**：支持大文档（例如 300+ 页）。必须分块、缓存、可中断、可恢复。
5. **UI 简洁可用**：左侧阅读/预览 + 结构树；右侧对话与任务状态；可点击结果定位到原文位置。
6. **MCP 兼容**：工具调用层必须抽象为 Tool interface；内置工具先实现，后续可替换为 MCP client。
7. **严格结构化输出**：LLM 输出必须 JSON，并做 schema 校验；失败要重试并可读报错。

---

## 2. MVP 功能范围（必须实现）
### 2.1 文档导入与解析
- 选择本地 PDF 文件导入
- 计算 sha256，生成 docId
- 调用 MinerU（本地 CLI）解析 PDF
- 将 MinerU 输出标准化为本项目定义的 `DocJSON`
- 将所有产物落盘到 workspace（详见第 4 节）

### 2.2 阅读与预览（Electron UI）
- 左侧：
  - TOC/结构树（按标题层级 + 页）
  - Markdown/结构化文本预览（可折叠、可搜索）
  - 点击结构项/搜索结果：滚动定位并短暂闪烁
- 右侧：
  - 对话框：用户输入自然语言任务（例如“把第 3 章转成提纲并导出成 docx”）
  - 任务执行状态：plan 展示、step 进度条、耗时、可中断/继续

### 2.3 Agent：Planner + Runner + Executors（必须有）
- Planner：根据用户任务 + 文档信息生成 `PlanJSON`
- Runner：执行 plan 的 steps，产出 step artifacts 与最终输出
- Executors（MVP 至少提供 4 个基础能力，具体任务由 plan 组合）：
  1) **Locator**：定位相关内容（结构+关键词+可选 embedding）
  2) **Transformer**：将定位内容按任务要求处理（例如重排、结构化、提取、格式化等）
  3) **Verifier**：一致性/覆盖度/去重/格式校验
  4) **Exporter**：导出为指定格式（md/json/html/docx/pdf 等）

> 注意：Transformer 不等于“总结器”，它是通用处理器。具体任务逻辑由 plan 的参数决定。

### 2.4 导出（MVP 必做）
- Markdown（必做）
- JSON（必做）
- HTML（建议）
- DOCX（建议做；若时间不够可作为 V1.1）
- PDF 导出（可后置；V2）

---

## 3. 非目标（MVP 不做）
- 不做多用户协作
- 不做复杂 PDF 原始渲染（MVP 优先文本/结构预览；V2 可加 PDF.js 视图）
- 不做复杂权限系统
- 不做云端存储（除非用户明确开启）

---

## 4. Workspace 规范（必须）
每个导入 PDF 对应一个 workspace 目录：
```
workspace/
  <docId>/
    source.pdf
    meta.json                 # sha256、导入时间、页数等
    mineru/
      raw/                    # MinerU 原始输出（原封不动）
    doc/
      doc.json                # DocJSON（标准化输出）
      index.json              # 结构索引（toc/标题->nodeId）
      chunks.json             # 分块（用于断点续跑/检索）
      search_index.json       # 可选：关键词索引
      embeddings.json         # 可选：语义索引
    runs/
      <runId>/
        request.json          # 用户原始请求 + 解析
        plan.json
        steps/
          001_locator.json
          002_transformer.json
          003_verifier.json
          004_exporter.json
        output/
          result.md
          result.json
          result.html
          result.docx
          result.pdf
        logs.txt
    exports/
      ...                     # UI 里点“导出”产生的文件（可按时间分）
```

---

## 5. 数据结构（必须遵守）
### 5.1 DocJSON（doc/doc.json）
目标：统一 MinerU 版本差异；后续模块只依赖 DocJSON。

```json
{
  "docId": "string",
  "title": "string",
  "source": {
    "path": "string",
    "sha256": "string",
    "pages": 123
  },
  "nodes": [
    {
      "id": "n_000001",
      "type": "page|heading|paragraph|table|figure|list_item|footnote",
      "page": 1,
      "readingOrder": 1234,
      "text": "string",
      "bbox": [0, 0, 0, 0],
      "meta": {
        "level": 1,
        "style": "title|h1|h2|body|caption|note",
        "confidence": 0.98,
        "sourceRef": "mineru_ref"
      }
    }
  ],
  "structure": {
    "toc": [
      { "nodeId": "n_000010", "title": "Chapter 1", "level": 1 },
      { "nodeId": "n_000045", "title": "1.1 ...", "level": 2 }
    ]
  }
}
```

### 5.2 PlanJSON（runs/<runId>/plan.json）
Planner 必须只输出 JSON，不要夹带解释文字。

```json
{
  "runId": "string",
  "docId": "string",
  "userIntent": "string",
  "constraints": {
    "scope": { "type": "all|pages|section", "pages": [1, 50], "sectionNodeId": null },
    "outputFormats": ["md", "json", "html"],
    "maxOutputSize": 200000,
    "language": "zh|en|auto"
  },
  "steps": [
    { "id": "s1", "type": "locator", "input": { "topK": 200, "query": "string" } },
    { "id": "s2", "type": "transformer", "input": { "taskType": "string", "params": {} } },
    { "id": "s3", "type": "verifier", "input": { "checks": ["schema", "coverage", "dedupe"] } },
    { "id": "s4", "type": "exporter", "input": { "formats": ["md", "json", "html"] } }
  ]
}
```

### 5.3 Step Artifact（runs/<runId>/steps/*.json）
每一步必须记录：
- input 摘要
- output（或 outputPath）
- start/end 时间
- token/成本（若可得）
- 错误与重试信息

---

## 6. Agent 运行流程（必须实现）
1. Import PDF → 计算 sha256 → 生成 docId → 建 workspace
2. Run MinerU CLI → 保存 mineru/raw
3. Normalize → 生成 doc/doc.json
4. Build Index → 生成 doc/index.json、chunks.json（分块）
5. UI 输入自然语言请求 → 保存 request.json
6. Planner → plan.json（JSON 校验）
7. Runner 执行 steps（每步落盘，可中断/恢复）
8. UI 展示结果与可定位引用（基于 nodeId/page/bbox）
9. Export 输出到 runs/<runId>/output 与 exports/

---

## 7. UI 需求（必须）
### 7.1 左侧阅读区
- TOC 树 + 页码
- Markdown/结构化文本渲染（从 DocJSON 转换）
- 搜索框（至少关键词搜索）
- 定位：任何结果条目点击后，滚动到对应 node 并闪烁

### 7.2 右侧对话区
- Chat 输入框（支持回车发送）
- 显示 planner 生成的 plan（可折叠）
- 显示执行进度（step/总 step）、当前 step、耗时
- 中断/继续按钮（继续必须从上次成功 step 之后开始）

---

## 8. MCP 兼容层（必须预留）
实现抽象 Tool 接口（先内置实现，后续可接 MCP server）：

```ts
interface ToolCall {
  name: string;
  args: Record<string, any>;
}
interface ToolResult {
  ok: boolean;
  data?: any;
  error?: string;
}
interface Tool {
  name: string;
  description: string;
  run(call: ToolCall): Promise<ToolResult>;
}
```

MVP 内置 tools（至少）
- `fs.readFile`
- `fs.writeFile`
- `workspace.listDocs`
- `workspace.readDocJSON`
- `export.markdown`
- `export.json`
- `export.html`
- `mineru.run`（可选：若希望从 app 内触发 MinerU；否则提供检测与提示）

---

## 9. 模型调用与安全（必须）
- 所有 LLM 调用集中在 `src/main/llm/`
- 支持不同模型用于 planner/executor（配置切换）
- Key 从环境变量读取（不写死）
- 请求日志脱敏（不写入 key，不落盘原始敏感片段可配置）
- **上下文最小化**：默认只发送必要片段（Locator 候选段落列表 + 结构摘要），不发送整书

---

## 10. 配置文件（必须）
根目录 `config.json`：
```json
{
  "models": {
    "planner": "gpt-4.1-mini",
    "executor": "gpt-4.1-mini"
  },
  "runtime": {
    "workspaceDir": "./workspace",
    "maxConcurrency": 2
  },
  "mineru": {
    "cliPath": "mineru",
    "args": []
  },
  "export": {
    "defaultFormats": ["md", "json", "html"]
  }
}
```

---

## 11. 技术栈与目录结构（必须生成）
### 11.1 技术栈
- Electron + Vite + React + TypeScript
- Markdown：react-markdown + remark-gfm
- 状态管理：zustand 或 useReducer（轻量）
- IPC：Electron main <-> renderer
- 打包：electron-builder 或等价方案

### 11.2 目录结构（必须）
```
pdf-agent-reader/
  agent.md
  package.json
  config.json
  electron.vite.config.ts (或等价)
  src/
    main/
      index.ts
      ipc/
      workspace/
      mineru/
      normalize/
      agent/
        planner.ts
        runner.ts
        executors/
          locator.ts
          transformer.ts
          verifier.ts
          exporter.ts
        schemas/
      llm/
      tools/
    renderer/
      App.tsx
      components/
        SidebarToc.tsx
        MarkdownView.tsx
        ChatPanel.tsx
        ResultPanel.tsx
      state/
      styles/
  scripts/
  README.md
  workspace/ (gitignore)
```

---

## 12. 质量门槛（验收标准）
MVP 通过条件：
1. 导入任意 PDF（>= 50 页）可完成 MinerU→DocJSON→UI 渲染
2. 输入一个自然语言任务后可生成：
   - plan.json（可校验）
   - steps artifacts
   - result.md + result.json（至少）
3. 点击结果可定位到对应 node/page
4. 支持中断后继续（step 粒度恢复）
5. 所有 artifacts 落盘完整（runs/<runId>）

---

## 13. Milestones（Codex 执行顺序建议）
1) Electron 项目骨架 + workspace 管理  
2) MinerU 调用 + DocJSON 标准化 + TOC/index/chunks  
3) UI：TOC + Markdown 预览 + 定位 + 搜索  
4) Agent：planner（JSON）+ runner（steps）+ 4 executors  
5) 导出与打磨：md/json/html，进度、日志、失败重试  
6) V1.1：DOCX 导出；V2：PDF 回写/注释、PDF.js 视图、embedding 检索

---

## 14. README（必须生成）
说明：
- 依赖：Node、pnpm、MinerU 安装/路径
- 如何运行：dev/build
- workspace 结构
- 配置模型与 MinerU 路径
- 大文件常见问题：内存、分块、断点续跑

---

## 15. Codex 注意事项（强制）
- **先闭环**：哪怕 Locator 先用规则检索，也要尽快跑通端到端。
- 每一步输出都要落盘，便于调试与复现。
- 所有 LLM 输出必须 JSON + schema 校验；失败最多重试 2 次。
- 任何不可控长任务必须可中断、可恢复。
