# PDF Agent Reader

Electron-based PDF intelligent reader powered by MinerU and LLM agents. This repository currently provides the MVP project skeleton.

## Prerequisites
- Node.js 18+
- pnpm (recommended)
- MinerU CLI installed and reachable on `PATH`

## Getting Started
```bash
pnpm install
pnpm dev
```

## Build
```bash
pnpm build
```

## Build Windows EXE
> 建议在 Windows 环境执行，或在 macOS/Linux 上安装 Wine 以支持 cross-build。

```bash
pnpm build:win
```

构建产物会输出到 `release/` 目录。

## Workspace Layout
The application stores imported PDFs and run artifacts under `workspace/`.

```
workspace/
  <docId>/
    source.pdf
    meta.json
    mineru/raw/
    doc/doc.json
    doc/index.json
    doc/chunks.json
    runs/<runId>/
```

## Configuration
首次启动应用时会在用户数据目录自动生成 `config.json`，包含 MinerU 模型与 OpenAI API 订阅地址占位字段。你也可以手动更新根目录的 `config.json` 作为默认模板。

关键配置字段：
- `mineru.model.name` / `mineru.model.path`：MinerU 模型名称与本地路径
- `openai.subscriptionUrl`：第三方 OpenAI API 订阅链接（如代理服务地址）
- `openai.apiKeyEnv`：API Key 环境变量名称

## Notes
Large PDFs should be processed in chunks to avoid memory pressure and to support resumable runs.
