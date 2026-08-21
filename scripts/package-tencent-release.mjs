import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = path.join(root, "release", "tencent-mainland");

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(releaseRoot, { recursive: true });

await cp(path.join(root, "dist"), path.join(releaseRoot, "dist"), { recursive: true });
await cp(path.join(root, "deploy", "tencent"), path.join(releaseRoot, "deploy", "tencent"), { recursive: true });
await cp(path.join(root, "docs", "tencent-cloud-mainland-deployment.md"), path.join(releaseRoot, "README.md"));

const manifest = {
  generated_at: new Date().toISOString(),
  contents: [
    "dist/",
    "deploy/tencent/bootstrap-server.sh",
    "deploy/tencent/nginx-site.conf.template",
    "deploy/tencent/publish-dist.sh",
    "README.md"
  ]
};

await writeFile(path.join(releaseRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Tencent release package prepared at ${releaseRoot}`);
