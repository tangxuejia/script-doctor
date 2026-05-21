# 🚀 script-doctor Vercel 部署指南

## 一、前置检查 ✅ 全部通过

| 检查项 | 状态 |
|--------|------|
| `"build": "next build"` 在 package.json 中 | ✅ 已包含 |
| `.env.local` 在 .gitignore 中 | ✅ `.env*.local` 已覆盖 |
| 项目可本地运行 | ✅ `npm run dev` 正常 |

---

## 二、Vercel 环境变量清单

在 Vercel 项目设置页 **Settings → Environment Variables** 中添加以下变量：

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `DEEPSEEK_API_KEY` | `sk-xxxx` | DeepSeek API 密钥 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 地址 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL（前端可用） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_xxx` | Supabase Anon Key（前端可用） |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_xxx` | Supabase Service Role Key（仅后端） |
| `FREE_DAILY_LIMIT` | `3` | 免费用户每日分析次数上限 |

> **注意**：`NEXT_PUBLIC_*` 前缀的变量会被打包到浏览器 JS 中。`SUPABASE_SERVICE_ROLE_KEY` 不带 `NEXT_PUBLIC_` 前缀，仅服务器端可用，不会泄露。

---

## 三、部署步骤

### Step 1：推送到 GitHub

```bash
# 进入项目目录
cd C:/Users/User/Desktop/script-doctor

# 初始化 Git
git init
git add .
git commit -m "init: script-doctor 剧本多维分析工具"

# 在 GitHub 创建新仓库（如 script-doctor），然后：
git remote add origin https://github.com/你的用户名/script-doctor.git
git branch -M main
git push -u origin main
```

### Step 2：在 Vercel 导入仓库

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录
2. 点击 **Add New → Project**
3. 选择 GitHub 仓库 `script-doctor`
4. **Framework Preset** 选择 `Next.js`（Vercel 自动检测）
5. **Build Command** 保持默认 `next build`
6. **Output Directory** 保持默认 `.next`
7. 展开 **Environment Variables**，添加上方 6 个变量
8. 点击 **Deploy**

### Step 3：验证部署

部署完成后：
- 生产域名：`https://script-doctor.vercel.app`
- 可绑定自定义域名：**Settings → Domains**

---

## 四、注意事项

- `.env.local` 已在 `.gitignore` 中，不会被推送到 GitHub
- Vercel 每次 `git push` 到 `main` 分支会自动触发部署
- `src/app/api/analyze/route.ts` 使用 `export const runtime = 'nodejs'`，Vercel 会自动分配 Node.js 运行时
- 如果 DeepSeek API 超时，检查 Vercel Function 超时限制（默认 10s，可在 `vercel.json` 中调整）

```json
// vercel.json（如需增加 API 超时）
{
  "functions": {
    "src/app/api/analyze/route.ts": {
      "maxDuration": 60
    }
  }
}
```
