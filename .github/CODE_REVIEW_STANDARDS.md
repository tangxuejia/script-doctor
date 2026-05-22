# Script Doctor 代码审查标准

> 审计日期：2026-05-22 | 审计范围：17 源文件 / 2,624 行

---

## 🔴 必须立即修复（P0）

| # | 文件:行 | 问题 | 后果 |
|---|---------|------|------|
| 1 | `analyze-client.ts:108` | **API 密钥硬编码在客户端** | 密钥泄露 = 盗刷 + 吊销 |
| 2 | `ReportViewer.tsx:112` | **XSS 漏洞** — `document.write(report)` | AI 生成内容可执行 JS |
| 3 | `route.ts:778` | **persist() 静默吞错** — 报告写入失败无提示 | 用户数据丢失不可见 |
| 4 | `route.ts:750` | **3 表写入无事务** — 部分成功部分失败 | 数据库脏数据 |

---

## 🟡 本周修复（P1）

### 重复代码消除

| 重复内容 | 位置 | 建议 |
|----------|------|------|
| `SYSTEM_PROMPT` + `MODULE_PROMPTS` | `route.ts` 和 `prompts.ts` 完全相同 | `route.ts` 从 `prompts.ts` import |
| `sha256` / `buildSysMsg` / 缓存 / 限流 / 流解析 / 持久化 | `route.ts` 和 `analyze-client.ts` 重复 ~200 行 | 提取到 `shared/` 或正确的分层架构 |
| 加载旋转器 SVG | `page.tsx` 3 处重复 | 提取 `<Spinner />` 组件 |
| 颜色方案 | `page.tsx` 和 `ReportViewer.tsx` 重复 | 提取到 `constants.ts` |

### 正确性修复

| # | 位置 | 问题 | 修复 |
|---|------|------|------|
| 5 | `ReportViewer.tsx:106` | `setTimeout(() => setCopied, 2000)` — 缺少参数 | `() => setCopied(false)` |
| 6 | `ReportViewer.tsx:84` | `useMemo` 用于副作用 | 改为 `useEffect` |
| 7 | `prompts.ts:337` | M7 模块尾部有字面文本 `markdown` — 语法错误 | 删除 |

### 类型安全

| 位置 | 修复 |
|------|------|
| `analyze-client.ts:144` | `response.body!` — 加 null 检查 |
| `page.tsx:76` | `VERSIONS.find(...)!` — 加兜底 |
| `route.ts:760-777` | 移除 4 处 `as any` — 使用 Supabase 生成的类型 |

---

## 💭 逐步改进（P2）

### 架构拆分

| 当前 | 建议 |
|------|------|
| `route.ts` 783 行（认证+验证+限流+缓存+AI+流+持久化） | 拆为 `auth.ts` / `gatekeeper.ts` / `llm.ts` / `stream.ts` / `persist.ts` |
| `analyzeScript()` 180 行 | 拆为 `buildRequest()` / `checkLimit()` / `streamChunks()` / `persistResult()` |
| `page.tsx` 262 行（4 步骤全在一个组件） | 拆为 `<StepUpload/>` / `<StepAnalyze/>` / `<StepRevise/>` / `<StepExport/>` |

### Prompt 拆分

```
prompts.ts 511 行 → 15 个模块一次性全加载
                 → 改为按需动态 import，减小初始包体积
```

### 防御性加固

- 文件上传：加 50MB 上限、多文件警告、空文件拒绝
- 编码：`.txt` 默认 UTF-8 → 支持 GBK/GB2312 检测
- Fetch：所有 API 调用加 60s 超时
- 状态：Zustand 加 `persist` 中间件防刷新丢失

---

## 📋 Code Review Checklist

每次 PR 必须检查：

```
□ 无硬编码密钥、token、密码
□ 无 `as any` / 非空断言 `!`
□ 错误 `.catch` 至少记录了日志
□ 异步操作有超时控制
□ 用户可见文案使用中文
□ 新增模块已同步 prompts.ts / route.ts / modules.ts
□ 无 `useMemo` 副作用 / 无 `useEffect` 缺 deps
□ Tailwind class 无内联超长字符串（用 clsx/cn）
□ 文件不超过 300 行（超过即拆分）
□ 页面刷新不会丢失未保存数据
```
