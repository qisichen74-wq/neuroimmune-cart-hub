import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const internalPages = new Set(["login.html", "review.html", "candidates.html", "quality.html", "radar.html", "history.html"]);
const rootFiles = (await readdir(root)).filter((file) => file.endsWith(".html") && !internalPages.has(file));
await Promise.all(rootFiles.map((file) => cp(path.join(root, file), path.join(output, file))));
await cp(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });
await mkdir(path.join(output, "data"), { recursive: true });
const internalData = new Set(["candidate-report.json", "review-decisions.json", "review-workflow.json", "source-sync-report.json"]);
const publicDataFiles = (await readdir(path.join(root, "data"))).filter((file) => !internalData.has(file));
await Promise.all(publicDataFiles.map((file) => cp(path.join(root, "data", file), path.join(output, "data", file))));

const notFound = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>页面未找到 - 神经免疫 CAR-T 情报工作台</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6f4;color:#172019;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(560px,calc(100% - 40px));border-top:3px solid #176049;padding:28px 0}
    h1{margin:0 0 10px;font-size:28px}p{margin:0 0 22px;color:#465149;line-height:1.7}a{color:#176049;font-weight:700}
  </style>
</head>
<body><main><h1>页面未找到</h1><p>该地址可能已调整，返回首页可继续浏览最新情报。</p><a href="./index.html">返回首页</a></main></body>
</html>
`;
await writeFile(path.join(output, "404.html"), notFound);

console.log(`Site build: ${rootFiles.length} pages, assets and public data -> dist/`);
