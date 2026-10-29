# 提示词优化（Prompt Optimizor）

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：输入框旁边多一个 ✦ 按钮，点一下用你选的模型把草稿改写成更紧凑的提示词，再点一下回到原文。

[English →](README.md)

## 功能

- 在输入框右侧那排控件里加一个 **✦** 按钮。
- **点一下** —— 当前草稿发给配置好的模型，返回的优化结果就地替换草稿，按钮变成「恢复」状态。
- **再点一下** —— 草稿恢复成第一次点击前的原文，一字不差。
- **请求进行中再点** —— 取消这次请求，草稿保持不动。
- 草稿里含附件或 `@` 引用占位符时不会替换，而是给出提示，避免把引用弄丢。
- 自带设置页：**插件 → 提示词优化**。

## 安装

```sh
dsh plugin add github:Grampusworld/dsh-prompt-optimizor
```

本地目录安装：

```text
plugin_manager action=install_bundle target=/你的绝对路径/dsh-PromptOptimizor
```

改过源码后，在插件页把本插件停用再启用（或刷新页面）即可生效。

## 设置项

| 字段 | 说明 | 默认 |
| --- | --- | --- |
| 模式 | 「DSH 内置模型」（用 Harness 已配置的模型，无需 API Key）或「自定义 OpenAI 兼容 API」 | 内置 |
| provider / model | 内置模式使用；列表来自 Harness 自己的模型目录 | `deepseek-official` / `deepseek-flash` |
| 推理等级 | `模型默认` / `off` / `low` / `high` / `max`；模型不支持时回退到该模型的默认等级 | `off` |
| Base URL / 模型名 / API Key | 自定义模式使用；任何接受 `POST {base}/chat/completions` 的服务都行 | 空 / `deepseek-chat` / 空 |
| 润色提示词 | 发给模型的 system 指令；留空保存会自动回落到默认提示词 | 内置「提示词精简优化专家」 |
| 单次最多字数 | 超过就不发请求，直接提示 | 8000 |
| 请求超时 | 毫秒 | 60000 |

**保存并测试** 会先保存配置，再用一句示例提示词实跑一次，把原文和结果都显示出来。

![设置面板](assets/screenshot-1.png)

## 实现

- **Host 侧**（`index.js`）注册 `/api/prompt-optimizor/{state,catalog,optimize,test}`：仅回环地址可访问，POST 要求 `application/json`，请求体上限 256 KiB。两条润色路径：
  - 内置模式走 `ctx.llm.stream`，直接使用 Harness 已配置的模型；
  - 自定义模式 fetch 任意 OpenAI 兼容的 `/chat/completions` 端点。
- **浏览器侧**（`client.js`）把按钮挂进 `conversation.input.right`（通过 `inputActions.setDraft` 改写草稿），把设置页挂进 `plugins.bundle.config`。
- 配置通过 `settings` 服务读写，命名空间 `dsh-prompt-optimizor`；schema 用 `schemastery` 声明，所以不用手工改 `package.json` / `cordis.patch.yml`。

## 隐私

API Key 只存在本机 Harness profile 的配置里，不会回传给页面 —— `GET /api/prompt-optimizor/state` 只回 `hasApiKey`。请求从你的机器直接发往你配置的服务商。

## 开发

```sh
node --check index.js && node --check client.js
```

## 许可证

MIT。
