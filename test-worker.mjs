import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "./worker.mjs";

const index = JSON.parse(await readFile(new URL("./data/assistant-index.json", import.meta.url)));
const nativeFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
const env = {
  ASSISTANT_DISABLE_MODEL: "1",
  ASSETS: { async fetch(request) {
    if (new URL(request.url).pathname === "/data/assistant-index.json") return Response.json(index);
    return new Response("static-page");
  } }
};
try {
  const status = await worker.fetch(new Request("https://worker.test/api/assistant"), env);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).model_configured, false);
  const answer = await worker.fetch(new Request("https://worker.test/api/assistant", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "NCT07006805的入组人数？" })
  }), env);
  assert.equal(answer.status, 200);
  const body = await answer.json();
  assert.equal(body.mode, "retrieval-only");
  assert.ok(body.sources.some((record) => record.id === "cabaletta-resecel-ms-phase12"));
  assert.equal(await (await worker.fetch(new Request("https://worker.test/assistant.html"), env)).text(), "static-page");
  assert.equal((await worker.fetch(new Request("https://worker.test/api/assistant", { method: "DELETE" }), env)).status, 405);
  assert.equal((await worker.fetch(new Request("https://worker.test/api/unknown"), env)).status, 404);
  const broken = { ASSETS: { fetch: async () => new Response("missing", { status: 404 }) } };
  assert.equal((await worker.fetch(new Request("https://worker.test/api/assistant"), broken)).status, 503);
} finally { globalThis.fetch = nativeFetch; }
console.log("Worker routing: status, retrieval POST, asset binding, 404/405 and missing index passed without network");
