// worker.test.mjs 的 mock 单测：Node 22 直跑，不依赖任何框架
// 用法：node test-worker.mjs
// 说明：worker.js 是浏览器/Worker 专用 ESM（.js 后缀 Node 不认），测试前自动 cp 为
//       worker.test.mjs 再动态 import——改 worker.js 后直接重跑本文件即可，不会失同步。
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
fs.copyFileSync(path.join(__dir, "worker.js"), path.join(__dir, "worker.test.mjs"));
const w = await import("./worker.test.mjs?t=" + Date.now());

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("FAIL  " + name + "\n      " + (e && e.message || e)); }
}
function section(s) { console.log("\n== " + s + " =="); }

// ---------- mock fetch ----------
let queue = [];
function setQueue(seq) { queue = seq.slice(); }
function installMock() {
  globalThis.fetch = async (url, opts) => {
    const expect = queue.shift();
    if (!expect) throw new Error("Unexpected fetch: " + url + " " + (opts && opts.method || "GET"));
    const u = String(url);
    if (expect.path && !u.includes(expect.path)) throw new Error("URL mismatch: want " + expect.path + " got " + u);
    if (expect.method && (!opts || opts.method !== expect.method)) throw new Error("METHOD mismatch: want " + expect.method + " got " + (opts && opts.method || "GET") + " for " + u);
    if (typeof expect === "function") return expect(u, opts);
    return new Response(JSON.stringify(expect.body), {
      status: expect.status || 200,
      headers: { "content-type": "application/json" },
    });
  };
}
const b64 = s => Buffer.from(s, "utf8").toString("base64");

// ============================================================
section("parseRepo");
await t("正常 owner/repo", () => assert.deepStrictEqual(w.parseRepo("guoxin/skill-collection"), { owner: "guoxin", repo: "skill-collection" }));
await t("含点/横线/下划线", () => assert.deepStrictEqual(w.parseRepo("a.b-c_d/repo-1"), { owner: "a.b-c_d", repo: "repo-1" }));
await t("三段路径 → null", () => assert.strictEqual(w.parseRepo("a/b/c"), null));
await t("空串 → null", () => assert.strictEqual(w.parseRepo("  "), null));
await t("URL → null", () => assert.strictEqual(w.parseRepo("https://github.com/x/y"), null));

// ============================================================
section("parseUrl");
await t("仓库根", () => assert.deepStrictEqual(w.parseUrl("https://github.com/owner/repo"), { owner: "owner", repo: "repo", ref: null, path: "" }));
await t("tree 分支", () => assert.deepStrictEqual(w.parseUrl("https://github.com/owner/repo/tree/main"), { owner: "owner", repo: "repo", ref: "main", path: "" }));
await t("tree 分支+子目录", () => assert.deepStrictEqual(w.parseUrl("https://github.com/owner/repo/tree/main/sub/dir"), { owner: "owner", repo: "repo", ref: "main/sub/dir", path: "" }));
await t("blob 文件", () => assert.deepStrictEqual(w.parseUrl("https://github.com/owner/repo/blob/main/SKILL.md"), { owner: "owner", repo: "repo", ref: "main/SKILL.md", path: "" }));
await t("raw 文件", () => assert.deepStrictEqual(w.parseUrl("https://github.com/owner/repo/raw/main/a.md"), { owner: "owner", repo: "repo", ref: "main/a.md", path: "" }));
await t(".git 后缀剥离", () => assert.deepStrictEqual(w.parseUrl("https://github.com/owner/repo.git"), { owner: "owner", repo: "repo", ref: null, path: "" }));
await t("非 github 域名 → null", () => assert.strictEqual(w.parseUrl("https://gitlab.com/a/b"), null));
await t("单段路径 → null", () => assert.strictEqual(w.parseUrl("https://github.com/repo"), null));
await t("非 URL 文本 → null", () => assert.strictEqual(w.parseUrl("owner/repo"), null));
await t("空串 → null", () => assert.strictEqual(w.parseUrl(""), null));

// ============================================================
section("slugify");
await t("英文+标点", () => assert.strictEqual(w.slugify("My Skill!"), "my-skill"));
await t("连续空格", () => assert.strictEqual(w.slugify("a  b"), "a-b"));
await t("全中文 → skill", () => assert.strictEqual(w.slugify("中文技能"), "skill"));
await t("空 → skill", () => assert.strictEqual(w.slugify(""), "skill"));

// ============================================================
section("parseFrontmatter");
await t("普通键值", () => assert.deepStrictEqual(
  w.parseFrontmatter("---\nname: hello\ndescription: world\n---\n正文"),
  { name: "hello", description: "world" }));
await t("引号剥离", () => assert.deepStrictEqual(
  w.parseFrontmatter("---\nname: \"quoted\"\ndescription: 'desc'\n---"),
  { name: "quoted", description: "desc" }));
await t("折叠块 |", () => assert.deepStrictEqual(
  w.parseFrontmatter("---\nname: test\ndescription: |\n  第一行\n  第二行\n---"),
  { name: "test", description: "第一行 第二行" }));
await t("折叠块 >", () => assert.deepStrictEqual(
  w.parseFrontmatter("---\ndescription: >\n  折叠\n  文本\n---"),
  { name: "", description: "折叠 文本" }));
await t("折叠块 |-", () => assert.deepStrictEqual(
  w.parseFrontmatter("---\ndescription: |-\n  a\n  b\n---"),
  { name: "", description: "a b" }));
await t("description 行内+后续缩进续行", () => assert.deepStrictEqual(
  w.parseFrontmatter("---\ndescription: 首行\n  续行\nname: x\n---"),
  { name: "x", description: "首行 续行" }));
await t("无 frontmatter → 空", () => assert.deepStrictEqual(
  w.parseFrontmatter("# 纯正文\n没有 frontmatter"), { name: "", description: "" }));
await t("空文本 → 空", () => assert.deepStrictEqual(w.parseFrontmatter(""), { name: "", description: "" }));
await t("缺少 description", () => assert.deepStrictEqual(
  w.parseFrontmatter("---\nname: only\n---"), { name: "only", description: "" }));

// ============================================================
section("injectMirrorMeta（镜像来源注入）");
const META_SRC = "https://github.com/jnMetaCode/superpowers-zh";
await t("无 metadata：frontmatter 后注入完整块", () => {
  const r = w.injectMirrorMeta("---\nname: test\n---\n正文", META_SRC, "jnMetaCode", "mirror");
  assert.ok(r.includes("metadata:\n  source: " + META_SRC + "\n  sourceOwner: jnMetaCode\n  mode: mirror"), r);
  assert.ok(r.includes("name: test") && r.includes("正文"));
  assert.ok(r.indexOf("name: test") < r.indexOf("metadata:"));
});
await t("已有 metadata：追加新块覆盖且保留原内容", () => {
  const r = w.injectMirrorMeta("---\nname: x\nmetadata:\n  old: 1\n---\nbody", META_SRC, "jnMetaCode", "mirror");
  assert.ok(r.includes("old: 1") && r.includes("body"));
  assert.ok(r.lastIndexOf("source: " + META_SRC) > r.indexOf("old: 1"), r);
});
await t("无 frontmatter：创建 frontmatter 包裹", () => {
  const r = w.injectMirrorMeta("plain text", META_SRC, "jnMetaCode", "mirror");
  assert.ok(r.startsWith("---\nmetadata:\n  source: " + META_SRC), r);
  assert.ok(r.includes("plain text"));
});
await t("空输入不崩", () => {
  const r = w.injectMirrorMeta("", META_SRC, "jnMetaCode", "mirror");
  assert.ok(r.includes("metadata:") && r.includes("sourceOwner: jnMetaCode"));
});
await t("注入后 frontmatter 可被 parseFrontmatter 识别", () => {
  const r = w.injectMirrorMeta("---\nname: keep\n---\nbody", META_SRC, "jnMetaCode", "mirror");
  const fm = w.parseFrontmatter(r);
  assert.strictEqual(fm.name, "keep"); // 原字段保留
});

// ============================================================
section("resolveRef（mock fetch）");
installMock();
await t("ref 即路径（直接命中默认分支）", async () => {
  setQueue([
    { path: "/repos/o/r", body: { default_branch: "main" } },
    { path: "/repos/o/r/contents/sub", body: [{ name: "SKILL.md" }] },
  ]);
  const r = await w.resolveRef("tok", "o", "r", "sub");
  assert.strictEqual(r.branch, "main"); assert.strictEqual(r.path, "sub");
  assert.strictEqual(r.list[0].name, "SKILL.md");
});
await t("ref 即路径失败 → 首段即分支", async () => {
  setQueue([
    { path: "/repos/o/r", body: { default_branch: "main" } },
    { path: "/repos/o/r/contents/dev/sub", status: 404, body: {} },
    { path: "/repos/o/r/contents/sub", body: [{ name: "a.md" }] },
  ]);
  const r = await w.resolveRef("tok", "o", "r", "dev/sub");
  assert.strictEqual(r.branch, "dev"); assert.strictEqual(r.path, "sub");
});
await t("ref 为空 → 仓库根", async () => {
  setQueue([
    { path: "/repos/o/r", body: { default_branch: "main" } },
    { path: "/repos/o/r/contents", body: [{ name: "SKILL.md" }] },
  ]);
  const r = await w.resolveRef("tok", "o", "r", null);
  assert.strictEqual(r.branch, "main"); assert.strictEqual(r.path, "");
});
await t("仓库不可访问 → error", async () => {
  setQueue([{ path: "/repos/o/r", status: 404, body: {} }]);
  const r = await w.resolveRef("tok", "o", "r", "x");
  assert.ok(r.error && r.error.includes("不存在"));
});
await t("目录定位失败 → error", async () => {
  setQueue([
    { path: "/repos/o/r", body: { default_branch: "main" } },
    { path: "/repos/o/r/contents/nope", status: 404, body: {} },
    { path: "/repos/o/r/contents/", status: 404, body: {} },
  ]);
  const r = await w.resolveRef("tok", "o", "r", "nope");
  assert.ok(r.error && r.error.includes("无法定位"));
});

// ============================================================
section("probeIcon（mock fetch）");
await t("探测到 _icon.png", async () => {
  setQueue([{ path: "/contents/dir/_icon.png", body: { encoding: "base64", content: b64("PNG") } }]);
  const r = await w.probeIcon("tok", "o", "r", "main", "dir", [{ name: "_icon.png" }, { name: "SKILL.md" }]);
  assert.deepStrictEqual(r, { name: "_icon.png", base64: b64("PNG"), mime: "image/png" });
});
await t("探测到 icon.svg → mime svg", async () => {
  setQueue([{ path: "/contents/icon.svg", body: { encoding: "base64", content: b64("<svg/>") } }]);
  const r = await w.probeIcon("tok", "o", "r", "main", "", [{ name: "icon.svg" }]);
  assert.strictEqual(r.mime, "image/svg+xml");
});
await t("无候选 → null", async () => {
  const r = await w.probeIcon("tok", "o", "r", "main", "", [{ name: "SKILL.md" }]);
  assert.strictEqual(r, null);
});

// ============================================================
section("putFile / delFile（sha 语义）");
await t("已存在文件：先 GET sha 再 PUT 带 sha", async () => {
  let putBody = null;
  setQueue([
    { path: "/contents/fav-x/SKILL.md", body: { sha: "abc123" } },
    { path: "/contents/fav-x/SKILL.md", method: "PUT", body: {} },
  ]);
  globalThis.fetch = async (url, opts) => {
    const expect = queue.shift();
    const u = String(url);
    if (expect.method && (!opts || opts.method !== expect.method)) throw new Error("method mismatch " + u);
    if (opts && opts.method === "PUT") putBody = JSON.parse(opts.body);
    return new Response(JSON.stringify(expect.body), { status: expect.status || 200, headers: { "content-type": "application/json" } });
  };
  const ok = await w.putFile("tok", "o", "r", "main", "fav-x/SKILL.md", b64("x"), "msg");
  assert.strictEqual(ok, true);
  assert.strictEqual(putBody.sha, "abc123", "PUT 应带 sha");
  assert.strictEqual(putBody.branch, "main");
  installMock();
});
await t("不存在文件：GET 404 → PUT 不带 sha", async () => {
  let putBody = null;
  setQueue([
    { path: "/contents/fav-x/SKILL.md", status: 404, body: {} },
    { path: "/contents/fav-x/SKILL.md", method: "PUT", body: {} },
  ]);
  globalThis.fetch = async (url, opts) => {
    const expect = queue.shift();
    const u = String(url);
    if (expect.method && (!opts || opts.method !== expect.method)) throw new Error("method mismatch " + u);
    if (opts && opts.method === "PUT") putBody = JSON.parse(opts.body);
    return new Response(JSON.stringify(expect.body), { status: expect.status || 200, headers: { "content-type": "application/json" } });
  };
  const ok = await w.putFile("tok", "o", "r", "main", "fav-x/SKILL.md", b64("x"), "msg");
  assert.strictEqual(ok, true);
  assert.ok(!("sha" in putBody), "PUT 不应带 sha");
  assert.strictEqual(putBody.content, b64("x"));
  installMock();
});

// ============================================================
section("collect proxy 全流程（模拟写队列）");
await t("proxy 收藏：解析→探测→写 SKILL.md+_icon.png", async () => {
  const pngB64 = b64("fake-png-bytes");
  const requests = [];
  setQueue([
    { path: "/repos/o/skill-repo", body: { default_branch: "main" } },
    { path: "/repos/o/skill-repo/contents/main", status: 404, body: {} },
    { path: "/repos/o/skill-repo/contents", body: [{ name: "SKILL.md" }, { name: "_icon.png" }] },
    { path: "/contents/SKILL.md", body: { encoding: "base64", content: b64("---\nname: Foo Skill\ndescription: |\n  好技能\n---\n") } },
    { path: "/contents/_icon.png", body: { encoding: "base64", content: pngB64 } },
    { path: "/repos/g/skill-collection/contents/fav-foo-skill", status: 404, body: {} },
    { path: "/contents/fav-foo-skill/SKILL.md", status: 404, body: {} },
    { path: "/contents/fav-foo-skill/SKILL.md", method: "PUT", body: {} },
    { path: "/contents/fav-foo-skill/_icon.png", status: 404, body: {} },
    { path: "/contents/fav-foo-skill/_icon.png", method: "PUT", body: {} },
  ]);
  globalThis.fetch = async (url, opts) => {
    const expect = queue.shift();
    if (!expect) throw new Error("Unexpected fetch: " + url);
    const u = String(url);
    if (expect.path && !u.includes(expect.path)) throw new Error("URL mismatch: want " + expect.path + " got " + u);
    if (expect.method && (!opts || opts.method !== expect.method)) throw new Error("METHOD mismatch for " + u);
    if (opts && opts.method === "PUT") requests.push(JSON.parse(opts.body));
    return new Response(JSON.stringify(expect.body), { status: expect.status || 200, headers: { "content-type": "application/json" } });
  };
  const r = await w.collect(
    { GH_TOKEN: "tok" },
    { owner: "g", repo: "skill-collection" },
    "main",
    { url: "https://github.com/o/skill-repo/tree/main", mode: "proxy" },
    {}
  );
  const out = await r.json();
  assert.strictEqual(r.status, 200);
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.dir, "fav-foo-skill");
  assert.strictEqual(out.mode, "proxy");
  assert.strictEqual(out.name, "Foo Skill");
  assert.strictEqual(out.description, "好技能");
  assert.strictEqual(out.icon, "_icon.png");
  assert.strictEqual(out.written, 2);
  assert.ok(out.source.includes("github.com/o/skill-repo"));
  const md = Buffer.from(requests[0].content, "base64").toString("utf8");
  assert.ok(md.includes("metadata:"));
  assert.ok(md.includes("source: https://github.com/o/skill-repo"));
  assert.ok(md.includes("mode: proxy"));
  assert.strictEqual(requests[1].content, pngB64);
  assert.ok(queue.length === 0, "fetch 队列应耗尽，剩余 " + queue.length);
  installMock();
});

await t("已收藏过 → 409", async () => {
  setQueue([
    { path: "/repos/o/r2", body: { default_branch: "main" } },
    { path: "/repos/o/r2/contents", body: [] },
    { path: "/repos/g/skill-collection/contents/fav-r2", body: [{ name: "SKILL.md" }] },
  ]);
  const r = await w.collect(
    { GH_TOKEN: "tok" },
    { owner: "g", repo: "skill-collection" },
    "main",
    { url: "https://github.com/o/r2" },
    {}
  );
  assert.strictEqual(r.status, 409);
  const out = await r.json();
  assert.ok(out.error.includes("已收藏"));
});

await t("收藏仓库自身 → 400", async () => {
  const r = await w.collect(
    { GH_TOKEN: "tok" },
    { owner: "g", repo: "skill-collection" },
    "main",
    { url: "https://github.com/g/skill-collection" },
    {}
  );
  assert.strictEqual(r.status, 400);
  const out = await r.json();
  assert.ok(out.error.includes("自身"));
});

await t("非法 URL → 400", async () => {
  const r = await w.collect({ GH_TOKEN: "tok" }, { owner: "g", repo: "skill-collection" }, "main", { url: "https://example.com/x" }, {});
  assert.strictEqual(r.status, 400);
});

// ============================================================
section("空仓库自动初始化（ensureRepoReady / putFileAuto）");
await t("非空仓库：直接可用，无多余请求", async () => {
  setQueue([{ path: "/repos/g/skill-collection", body: { size: 2048 } }]);
  const r = await w.ensureRepoReady("tok", "g", "skill-collection", "main");
  assert.deepStrictEqual(r, { ok: true, initialized: false });
  assert.ok(queue.length === 0, "不应有额外请求");
});
await t("空仓库：blob→tree→commit→ref 四步初始化", async () => {
  setQueue([
    { path: "/repos/g/skill-collection", body: { size: 0 } },
    { path: "/git/blobs", method: "POST", status: 201, body: { sha: "b1" } },
    { path: "/git/trees", method: "POST", status: 201, body: { sha: "t1" } },
    { path: "/git/commits", method: "POST", status: 201, body: { sha: "c1" } },
    { path: "/git/refs", method: "POST", status: 201, body: {} },
  ]);
  const r = await w.ensureRepoReady("tok", "g", "skill-collection", "main");
  assert.deepStrictEqual(r, { ok: true, initialized: true });
  assert.ok(queue.length === 0, "四步请求应恰好耗尽队列");
});
await t("空仓库 collect：PUT 409 → 自动初始化 → 重试成功", async () => {
  const requests = [];
  setQueue([
    // resolveRef 探测目标仓库（仓库根 → 仅 listDir 一次）
    { path: "/repos/o/skill-repo", body: { default_branch: "main" } },
    { path: "/repos/o/skill-repo/contents", body: [{ name: "SKILL.md" }] },
    { path: "/contents/SKILL.md", body: { encoding: "base64", content: b64("---\nname: Bar\n---\n") } },
    // 检查是否已收藏（收藏仓库空 → contents 404）
    { path: "/repos/g/skill-collection/contents/fav-bar", status: 404, body: {} },
    // putFileAuto 第一轮：GET 404 → PUT 409（空仓库）
    { path: "/contents/fav-bar/SKILL.md", status: 404, body: {} },
    { path: "/contents/fav-bar/SKILL.md", method: "PUT", status: 409, body: { message: "Git Repository is empty" } },
    // ensureRepoReady：repo 信息 size=0 → 四步初始化
    { path: "/repos/g/skill-collection", body: { size: 0 } },
    { path: "/git/blobs", method: "POST", status: 201, body: { sha: "b1" } },
    { path: "/git/trees", method: "POST", status: 201, body: { sha: "t1" } },
    { path: "/git/commits", method: "POST", status: 201, body: { sha: "c1" } },
    { path: "/git/refs", method: "POST", status: 201, body: {} },
    // 重试：GET 404 → PUT 201 成功
    { path: "/contents/fav-bar/SKILL.md", status: 404, body: {} },
    { path: "/contents/fav-bar/SKILL.md", method: "PUT", status: 201, body: {} },
  ]);
  globalThis.fetch = async (url, opts) => {
    const expect = queue.shift();
    if (!expect) throw new Error("Unexpected fetch: " + url);
    const u = String(url);
    if (expect.path && !u.includes(expect.path)) throw new Error("URL mismatch: want " + expect.path + " got " + u);
    if (expect.method && (!opts || opts.method !== expect.method)) throw new Error("METHOD mismatch: want " + expect.method + " got " + (opts && opts.method || "GET") + " for " + u);
    if (opts && opts.method === "PUT") requests.push(JSON.parse(opts.body));
    return new Response(JSON.stringify(expect.body), { status: expect.status || 200, headers: { "content-type": "application/json" } });
  };
  const r = await w.collect(
    { GH_TOKEN: "tok" },
    { owner: "g", repo: "skill-collection" },
    "main",
    { url: "https://github.com/o/skill-repo", mode: "proxy" },
    {}
  );
  const out = await r.json();
  assert.strictEqual(r.status, 200);
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.dir, "fav-bar");
  assert.strictEqual(out.written, 1);
  assert.ok(requests.length === 2, "应有两次 PUT（失败+重试），实际 " + requests.length);
  assert.ok(!("sha" in requests[1]), "重试 PUT 时仓库刚初始化，不应带 sha");
  assert.ok(queue.length === 0, "fetch 队列应耗尽，剩余 " + queue.length);
  installMock();
});
await t("非空仓库但写入仍失败：不初始化直接报错", async () => {
  setQueue([
    { path: "/repos/o/r3", body: { default_branch: "main" } },
    { path: "/repos/o/r3/contents", body: [{ name: "SKILL.md" }] },
    { path: "/contents/SKILL.md", body: { encoding: "base64", content: b64("---\nname: C\n---\n") } },
    { path: "/repos/g/skill-collection/contents/fav-c", status: 404, body: {} },
    { path: "/contents/fav-c/SKILL.md", status: 404, body: {} },
    { path: "/contents/fav-c/SKILL.md", method: "PUT", status: 403, body: {} },
    { path: "/repos/g/skill-collection", body: { size: 4096 } }, // 非空 → 不 init
  ]);
  const r = await w.collect(
    { GH_TOKEN: "tok" },
    { owner: "g", repo: "skill-collection" },
    "main",
    { url: "https://github.com/o/r3" },
    {}
  );
  assert.strictEqual(r.status, 500);
  const out = await r.json();
  assert.ok(out.error.includes("写入 SKILL.md 失败"));
});
await t("health 暴露空仓库标记", async () => {
  setQueue([{ path: "/repos/g/skill-collection", body: { default_branch: "main", size: 0, private: false, permissions: { push: true } } }]);
  let out = await (await w.health({ GH_TOKEN: "tok" }, { owner: "g", repo: "skill-collection" }, "main", {})).json();
  assert.strictEqual(out.empty, true);
  setQueue([{ path: "/repos/g/skill-collection", body: { default_branch: "main", size: 512, private: false, permissions: { push: true } } }]);
  out = await (await w.health({ GH_TOKEN: "tok" }, { owner: "g", repo: "skill-collection" }, "main", {})).json();
  assert.strictEqual(out.empty, false);
});

// ============================================================
section("remove（trees 枚举 + 逐个删除）");
await t("删除目录内全部文件", async () => {
  setQueue([
    { path: "/git/trees/main", body: { tree: [
      { type: "tree", path: "fav-x" },
      { type: "blob", path: "fav-x/SKILL.md" },
      { type: "blob", path: "fav-x/_icon.png" },
    ] } },
    { path: "/contents/fav-x/SKILL.md", body: { sha: "s1" } },
    { path: "/contents/fav-x/SKILL.md", method: "DELETE", body: {} },
    { path: "/contents/fav-x/_icon.png", body: { sha: "s2" } },
    { path: "/contents/fav-x/_icon.png", method: "DELETE", body: {} },
  ]);
  const r = await w.remove({ GH_TOKEN: "tok" }, { owner: "g", repo: "skill-collection" }, "main", { dir: "fav-x" }, {});
  assert.strictEqual(r.status, 200);
  const out = await r.json();
  assert.strictEqual(out.removed, 2);
});
await t("目录名不合法 → 400", async () => {
  const r = await w.remove({ GH_TOKEN: "tok" }, { owner: "g", repo: "c" }, "main", { dir: "../etc" }, {});
  assert.strictEqual(r.status, 400);
});

// ============================================================
section("health / 环境变量守卫");
await t("健康检查通过", async () => {
  setQueue([{ path: "/repos/g/skill-collection", body: { default_branch: "main", private: false, permissions: { push: true } } }]);
  const r = await w.health({ GH_TOKEN: "tok" }, { owner: "g", repo: "skill-collection" }, "main", {});
  const out = await r.json();
  assert.strictEqual(out.ok, true);
});
await t("token 无效 → ok:false", async () => {
  setQueue([{ path: "/repos/g/skill-collection", status: 401, body: {} }]);
  const r = await w.health({ GH_TOKEN: "bad" }, { owner: "g", repo: "skill-collection" }, "main", {});
  const out = await r.json();
  assert.strictEqual(out.ok, false);
});

// ============================================================
section("fetch handler 路由");
await t("缺环境变量 → 500", async () => {
  const resp = await w.default.fetch(new Request("https://x.workers.dev/api/health", { method: "GET" }), {});
  assert.strictEqual(resp.status, 500);
});
await t("OPTIONS preflight → 204 + CORS", async () => {
  const resp = await w.default.fetch(new Request("https://x.workers.dev/api/collect", { method: "OPTIONS" }), { GH_TOKEN: "t", COLLECT_REPO: "g/s" });
  assert.strictEqual(resp.status, 204);
  assert.strictEqual(resp.headers.get("Access-Control-Allow-Origin"), "*");
});
await t("COLLECT_KEY 校验失败 → 401", async () => {
  const resp = await w.default.fetch(new Request("https://x.workers.dev/api/health", { method: "GET" }), { GH_TOKEN: "t", COLLECT_REPO: "g/s", COLLECT_KEY: "secret" });
  assert.strictEqual(resp.status, 401);
});
await t("未知路径 → 404", async () => {
  const resp = await w.default.fetch(new Request("https://x.workers.dev/nope", { method: "GET" }), { GH_TOKEN: "t", COLLECT_REPO: "g/s" });
  assert.strictEqual(resp.status, 404);
});

// ============================================================
console.log("\n----------------------------");
console.log("passed: " + passed + "  failed: " + failed);
process.exit(failed ? 1 : 0);
