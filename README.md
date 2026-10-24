# DBDCOMP 赛事简报档案

整理 B 站创作者「奥奥猫与拖把狗」发布的 DBDCOMP 赛事简报。本站保留作者署名、原文和动态链接；内容版权归原作者所有。

## 本地运行

```bash
npm install
npm run dev
```

## 导入新一期

从 B 站文章 URL `https://www.bilibili.com/read/cv53577928/` 取出数字 ID：

```bash
npm run import:bilibili -- 53577928
```

脚本会读取公开文章接口、下载文章内图片并更新 `src/data/issues.json`。请仅导入已获授权的内容，避免短时间批量请求。

## 发布

推送到 `main` 后，GitHub Actions 会构建并发布 GitHub Pages。
