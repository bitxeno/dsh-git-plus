var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : Symbol.for("Symbol." + name);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name]() {
    return __privateGet(this, extra);
  }, set [name](x) {
    return __privateSet(this, extra, x);
  } }, name));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name) : __name(target, name);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name, desc), p ? k ^ 4 ? extra : desc : target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/host/index.ts
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import Schema from "@deepseek-ai/schemastery";
import { readFile as readFile3, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";

// src/host/git.ts
import { readFile } from "node:fs/promises";
function createGitRunner(subprocess, timeoutMs, maxBytes) {
  const spillMaxBytes = maxBytes * 16;
  return {
    async run(argv, opts) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? timeoutMs);
      try {
        const signal = opts.signal === void 0 ? controller.signal : AbortSignal.any([controller.signal, opts.signal]);
        const handle = subprocess.spawn({
          argv,
          cwd: opts.cwd,
          stdio: {
            stdin: opts.stdinData === void 0 ? "ignore" : { data: opts.stdinData },
            stdout: { collect: { maxBytes, spill: { maxBytes: spillMaxBytes } } },
            stderr: { collect: { maxBytes, spill: { maxBytes: spillMaxBytes } } }
          },
          graceMs: 200,
          signal
        });
        let outcome;
        try {
          outcome = await handle.done;
        } catch (error) {
          const cancelled2 = opts.signal?.aborted === true && !controller.signal.aborted;
          if (controller.signal.aborted || opts.signal?.aborted === true) {
            return { exitCode: null, stdout: "", stderr: "", timedOut: !cancelled2, cancelled: cancelled2, stdoutLossy: false };
          }
          throw error;
        }
        const stdout = handle.collected.stdout?.readFrom(0);
        const stderr = handle.collected.stderr?.readFrom(0);
        const resolved = await resolveStdout(stdout);
        const cancelled = opts.signal?.aborted === true && !controller.signal.aborted;
        return {
          exitCode: outcome.exitCode,
          stdout: resolved.text,
          stderr: stderr?.text ?? "",
          timedOut: controller.signal.aborted,
          cancelled,
          stdoutLossy: resolved.lossy
        };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
async function resolveStdout(read) {
  if (read === void 0) return { text: "", lossy: false };
  if (!read.lossy || read.spillPath === void 0) return { text: read.text, lossy: read.lossy };
  try {
    return { text: await readFile(read.spillPath, "utf8"), lossy: false };
  } catch {
    return { text: read.text, lossy: true };
  }
}

// src/host/core.ts
import { join } from "node:path";

// src/host/parser.ts
function statusOf(code) {
  switch (code) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "added";
    case "T":
      return "typechange";
    case "U":
      return "conflicted";
    case "?":
      return "untracked";
    default:
      return "modified";
  }
}
function parseStatus(stdout) {
  const out = [];
  const records = stdout.split("\0");
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec === void 0 || rec.length < 3) continue;
    const x = rec[0];
    const y = rec[1];
    let path = rec.slice(3);
    if (x === "R" || x === "C" || y === "R" || y === "C") {
      i++;
    }
    const isDirectory = path.endsWith("/");
    if (isDirectory) path = path.replace(/\/+$/, "");
    if (x === "?" && y === "?") {
      out.push({ path, status: "untracked", staged: false, isDirectory });
      continue;
    }
    if (x === "U" || y === "U" || x === "A" && y === "A" || x === "D" && y === "D") {
      out.push({ path, status: "conflicted", staged: false, isDirectory });
      continue;
    }
    if (x !== " " && x !== "?") {
      out.push({ path, status: statusOf(x), staged: true, isDirectory });
    }
    if (y !== " " && y !== "?") {
      out.push({ path, status: statusOf(y), staged: false, isDirectory });
    }
  }
  return out;
}
function parseGraphLog(stdout) {
  const out = [];
  for (const record of stdout.split("")) {
    const rec = record.replace(/^\n+/, "");
    if (rec.trim() === "") continue;
    const parts = rec.split("");
    if (parts.length < 8) continue;
    const [hash, shortHash, parentsRaw, author, authorEmail, dateIso, decoration] = parts;
    const subject = parts.slice(7).join("");
    const parents = (parentsRaw ?? "").trim() === "" ? [] : parentsRaw.trim().split(/\s+/);
    out.push({
      hash: hash ?? "",
      shortHash: shortHash ?? "",
      subject,
      author: author ?? "",
      authorEmail: authorEmail ?? "",
      dateIso: dateIso ?? "",
      parents,
      refs: parseRefs(decoration ?? "")
    });
  }
  return out;
}
function parseRefs(decoration) {
  const refs = [];
  for (const raw of decoration.split(",")) {
    let token = raw.trim();
    if (token === "") continue;
    let head = false;
    if (token.startsWith("HEAD -> ")) {
      head = true;
      token = token.slice("HEAD -> ".length).trim();
    } else if (token === "HEAD") {
      continue;
    }
    if (token.startsWith("tag: ")) {
      refs.push({ kind: "tag", name: token.slice("tag: ".length).trim(), head: false });
    } else if (token.startsWith("origin/") || token.includes("/")) {
      refs.push({ kind: "remote", name: token, head });
    } else {
      refs.push({ kind: "branch", name: token, head });
    }
  }
  return refs;
}
function parseBranches(stdout) {
  const out = [];
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    const [name, shortHash = "", track = "", upstream = ""] = line.split("\0");
    if (name === void 0 || name === "") continue;
    const branch = {
      name,
      shortHash: shortHash === "" ? null : shortHash
    };
    if (upstream !== "") branch.upstream = upstream;
    const ahead = /ahead (\d+)/.exec(track);
    const behind = /behind (\d+)/.exec(track);
    if (ahead) branch.ahead = Number(ahead[1]);
    if (behind) branch.behind = Number(behind[1]);
    out.push(branch);
  }
  return out;
}
function markRemotePresence(local, remote, remotes) {
  if (remotes.length === 0 || remote === null) return local.map((branch) => ({ ...branch }));
  const remoteSet = new Set(remotes);
  const remoteRefs = new Set(remote.map((branch) => branch.name));
  const remoteNames = /* @__PURE__ */ new Set();
  for (const branch of remote) {
    const slash = branch.name.indexOf("/");
    if (slash > 0 && slash < branch.name.length - 1) remoteNames.add(branch.name.slice(slash + 1));
  }
  return local.map((branch) => {
    const upstream = branch.upstream ?? "";
    const slash = upstream.indexOf("/");
    const isRemoteUpstream = slash > 0 && remoteSet.has(upstream.slice(0, slash));
    const onRemote = isRemoteUpstream ? remoteRefs.has(upstream) : remoteNames.has(branch.name);
    return { ...branch, onRemote };
  });
}
function parseTags(stdout) {
  const out = [];
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    const [name, shortHash = ""] = line.split("\0");
    if (name) out.push({ name, shortHash: shortHash === "" ? null : shortHash });
  }
  return out;
}
function parseNameStatus(stdout) {
  const out = [];
  const tokens = stdout.split("\0");
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === void 0 || tok === "") {
      i += 1;
      continue;
    }
    const code = tok[0];
    if (code === void 0 || !/[AMDRCTU]/.test(code)) break;
    if (code === "R" || code === "C") {
      const newPath = tokens[i + 2];
      if (newPath === void 0) break;
      out.push({ path: newPath, status: statusOf(code) });
      i += 3;
    } else {
      const path = tokens[i + 1];
      if (path === void 0) break;
      if (path !== "") out.push({ path, status: statusOf(code) });
      i += 2;
    }
  }
  return out;
}
function sumNumstat(stdout) {
  let insertions = 0;
  let deletions = 0;
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    const parts = line.split("	");
    if (parts.length < 2) continue;
    const add = Number(parts[0]);
    const del = Number(parts[1]);
    if (Number.isFinite(add)) insertions += add;
    if (Number.isFinite(del)) deletions += del;
  }
  return { insertions, deletions };
}
function parseStashList(stdout) {
  const out = [];
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    const [ref, msg = "", dateIso = "", parentHash = "", hash = ""] = line.split("\0");
    if (!ref) continue;
    const m = /^stash@\{(\d+)\}$/.exec(ref.trim());
    if (!m) continue;
    out.push({
      index: Number(m[1]),
      message: msg,
      dateIso,
      parentHash,
      hash
    });
  }
  return out;
}
function parseBranchHeader(field) {
  const label = field.startsWith("## ") ? field.slice(3) : field;
  if (label === "HEAD (no branch)" || label.startsWith("HEAD (no branch,")) {
    return { branch: null, ahead: 0, behind: 0 };
  }
  let name = label;
  let rest = "";
  const bracket = name.indexOf(" [");
  if (bracket >= 0) {
    rest = name.slice(bracket + 1);
    name = name.slice(0, bracket);
  }
  const noCommits = "No commits yet on ";
  if (name.startsWith(noCommits)) name = name.slice(noCommits.length);
  const dots = name.indexOf("...");
  if (dots >= 0) name = name.slice(0, dots);
  const ahead = /ahead (\d+)/.exec(rest);
  const behind = /behind (\d+)/.exec(rest);
  return {
    branch: name === "" ? null : name,
    ahead: ahead ? Number(ahead[1]) : 0,
    behind: behind ? Number(behind[1]) : 0
  };
}

// src/host/validate.ts
import { isAbsolute, normalize } from "node:path";
function isSafePath(path) {
  if (path === "" || isAbsolute(path)) return false;
  const norm = normalize(path);
  if (norm === ".." || norm.startsWith("../") || norm.startsWith("..\\")) return false;
  return true;
}
var REV_META = /[\x00-\x20\x7f~^:?*[\\]/;
function isSafeRev(input) {
  if (input === "" || input.startsWith("-")) return false;
  if (REV_META.test(input)) return false;
  if (input.includes("..") || input.includes("@{")) return false;
  return true;
}
function isSafeBranchName(name) {
  return isSafeRev(name) && !name.startsWith("/");
}
function isSafeIgnorePattern(pattern) {
  if (pattern === "" || pattern.length > 512) return false;
  if (/[\x00-\x1f\x7f]/.test(pattern)) return false;
  if (isAbsolute(pattern)) return false;
  const trimmed = pattern.trim();
  if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!")) return false;
  const segs = trimmed.split("/");
  return !segs.some((s) => s === "..");
}

// src/host/core.ts
var DEFAULT_CONFIG = {
  timeoutMs: 8e3,
  networkTimeoutMs: 3e5,
  maxBytes: 4 * 1024 * 1024,
  maxChanges: 1e3,
  refreshIntervalMs: 3e4,
  showInputPill: true,
  defaultDiffView: "unified"
};
function normalizeConfig(raw) {
  const c = raw ?? {};
  const num = (v, d) => typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.floor(v) : d;
  return {
    timeoutMs: num(c.timeoutMs, DEFAULT_CONFIG.timeoutMs),
    networkTimeoutMs: num(c.networkTimeoutMs, DEFAULT_CONFIG.networkTimeoutMs),
    maxBytes: num(c.maxBytes, DEFAULT_CONFIG.maxBytes),
    maxChanges: num(c.maxChanges, DEFAULT_CONFIG.maxChanges),
    refreshIntervalMs: num(c.refreshIntervalMs, DEFAULT_CONFIG.refreshIntervalMs),
    showInputPill: readBool(c.showInputPill, DEFAULT_CONFIG.showInputPill),
    defaultDiffView: readDiffView(c.defaultDiffView, DEFAULT_CONFIG.defaultDiffView)
  };
}
function unwrapVolatile(value) {
  return value !== null && typeof value === "object" && "get" in value && typeof value.get === "function" ? value.get() : value;
}
function readDiffView(value, fallback) {
  const raw = unwrapVolatile(value);
  return raw === "unified" || raw === "split" ? raw : fallback;
}
function readBool(value, fallback) {
  const raw = unwrapVolatile(value);
  return typeof raw === "boolean" ? raw : fallback;
}
var NEG_CACHE_MS = 15e3;
async function resolveBrowseRoot(deps, sessionId) {
  const ws = await resolveWorkspace(deps, sessionId);
  if (ws.ok) return { ok: true, root: ws.root, isGitRepo: true };
  const err = ws.failure.error;
  if (err.code === "not-a-git-repo" && err.cwd !== void 0 && err.cwd !== "") {
    try {
      return { ok: true, root: await deps.fs.realpath(err.cwd), isGitRepo: false };
    } catch {
      return { ok: false, error: { code: "git-error" } };
    }
  }
  return { ok: false, error: mapWorkspaceFailure(ws.failure) };
}
async function resolveWorkspace(deps, sessionId) {
  let cwd = deps.sessions.liveCwd(sessionId);
  if (cwd === void 0 || cwd === "") {
    const meta = await deps.sessions.persistedMeta(sessionId);
    cwd = meta?.cwd;
  }
  if (cwd === void 0 || cwd === "") {
    return { ok: false, failure: { ok: false, error: { code: "cwd-unavailable", sessionId } } };
  }
  const cached = deps.rootCache?.get(cwd);
  if (cached !== void 0) return { ok: true, root: cached };
  const negAt = deps.rootNegCache?.get(cwd);
  if (negAt !== void 0) {
    if (Date.now() < negAt) return { ok: false, failure: { ok: false, error: { code: "not-a-git-repo", cwd } } };
    deps.rootNegCache?.delete(cwd);
  }
  const top = await runCommand(deps.run, ["git", "rev-parse", "--show-toplevel"], cwd, "toplevel", deps.signal);
  if ("failure" in top) {
    return { ok: false, failure: { ok: false, error: mapRunFailure(top.failure) } };
  }
  if (top.run.cancelled) return { ok: false, failure: { ok: false, error: { code: "cancelled" } } };
  if (top.run.timedOut) return { ok: false, failure: { ok: false, error: { code: "timeout" } } };
  if (top.run.exitCode !== 0) {
    deps.rootNegCache?.set(cwd, Date.now() + NEG_CACHE_MS);
    return { ok: false, failure: { ok: false, error: { code: "not-a-git-repo", cwd } } };
  }
  const raw = top.run.stdout.trim();
  if (raw === "") {
    deps.rootNegCache?.set(cwd, Date.now() + NEG_CACHE_MS);
    return { ok: false, failure: { ok: false, error: { code: "not-a-git-repo", cwd } } };
  }
  let root = raw;
  try {
    root = await deps.fs.realpath(raw);
  } catch {
    root = raw;
  }
  deps.rootCache?.set(cwd, root);
  return { ok: true, root };
}
async function runCommand(runner, argv, cwd, _label, signal, stdinData, timeoutMs) {
  try {
    const run = await runner.run(argv, {
      cwd,
      ...signal ? { signal } : {},
      ...stdinData !== void 0 ? { stdinData } : {},
      ...timeoutMs !== void 0 ? { timeoutMs } : {}
    });
    return { run };
  } catch (error) {
    return { failure: error };
  }
}
function mapRunFailure(failure) {
  const message = failure instanceof Error ? failure.message : String(failure);
  return { code: "git-unavailable", detail: message };
}
function mapWorkspaceFailure(failure) {
  const error = failure.error;
  const message = "detail" in error ? error.detail : void 0;
  return { code: error.code, ...message !== void 0 ? { message } : {} };
}
async function snapshotForSession(deps, config, sessionId) {
  const workspace = await resolveWorkspace(deps, sessionId);
  if (!workspace.ok) {
    const failure = workspace.failure;
    if (failure.error.code === "not-a-git-repo") {
      return { ok: false, error: { ...failure.error, showInputPill: config.showInputPill } };
    }
    return failure;
  }
  const root = workspace.root;
  const [branchRes, headRes, statusRes, aheadBehindRes, lastCommitRes, worktreeNumRes, stagedNumRes, conflictRes, stashRes, gitDirRes] = await Promise.all([
    runCommand(deps.run, ["git", "symbolic-ref", "--quiet", "--short", "HEAD"], root, "branch", deps.signal),
    runCommand(deps.run, ["git", "rev-parse", "--short", "HEAD"], root, "head", deps.signal),
    runCommand(deps.run, ["git", "status", "--porcelain=v1", "-z"], root, "status", deps.signal),
    runCommand(deps.run, ["git", "rev-list", "--count", "--left-right", "@{upstream}...HEAD"], root, "aheadBehind", deps.signal),
    runCommand(deps.run, ["git", "log", "-1", "--format=%H%x1f%h%x1f%s%x1f%an%x1f%ae%x1f%aI"], root, "lastCommit", deps.signal),
    runCommand(deps.run, ["git", "diff", "--numstat"], root, "numstat-worktree", deps.signal),
    runCommand(deps.run, ["git", "diff", "--numstat", "--cached"], root, "numstat-staged", deps.signal),
    runCommand(deps.run, ["git", "diff", "--name-only", "--diff-filter=U"], root, "conflicts", deps.signal),
    runCommand(deps.run, ["git", "stash", "list", "--format=%gd%00%gs%00%aI%00%P%00%H"], root, "stash-list", deps.signal),
    runCommand(deps.run, ["git", "rev-parse", "--absolute-git-dir"], root, "git-dir", deps.signal)
  ]);
  const branch = "run" in branchRes && branchRes.run.exitCode === 0 ? branchRes.run.stdout.trim() || null : null;
  const unborn = "run" in headRes && headRes.run.exitCode !== 0;
  const head = "run" in headRes && headRes.run.exitCode === 0 ? headRes.run.stdout.trim() || null : null;
  let allChanges = [];
  let statusLossy = false;
  if ("run" in statusRes && !statusRes.run.timedOut && statusRes.run.exitCode === 0) {
    allChanges = parseStatus(statusRes.run.stdout);
    statusLossy = statusRes.run.stdoutLossy;
  }
  const truncated = allChanges.length > config.maxChanges || statusLossy;
  const changes = allChanges.length > config.maxChanges ? allChanges.slice(0, config.maxChanges) : allChanges;
  let staged = 0;
  let modified = 0;
  let untracked = 0;
  for (const c of allChanges) {
    if (c.status === "untracked") untracked++;
    else if (c.staged) staged++;
    else modified++;
  }
  let ahead = 0;
  let behind = 0;
  if ("run" in aheadBehindRes && aheadBehindRes.run.exitCode === 0) {
    const parts = aheadBehindRes.run.stdout.trim().split(/\s+/);
    behind = Number(parts[0]) || 0;
    ahead = Number(parts[1]) || 0;
  }
  let lastCommit = null;
  if ("run" in lastCommitRes && lastCommitRes.run.exitCode === 0) {
    const parts = lastCommitRes.run.stdout.trim().split("");
    if (parts.length >= 6 && parts[0]) {
      lastCommit = {
        hash: parts[0],
        shortHash: parts[1] ?? "",
        subject: parts[2] ?? "",
        author: parts[3] ?? "",
        authorEmail: parts[4] ?? "",
        dateIso: parts[5] ?? ""
      };
    }
  }
  const wt = "run" in worktreeNumRes && worktreeNumRes.run.exitCode === 0 ? sumNumstat(worktreeNumRes.run.stdout) : { insertions: 0, deletions: 0 };
  const stg = "run" in stagedNumRes && stagedNumRes.run.exitCode === 0 ? sumNumstat(stagedNumRes.run.stdout) : { insertions: 0, deletions: 0 };
  let untrackedInsertions = 0;
  const untrackedPaths = allChanges.filter((c) => c.status === "untracked" && !c.isDirectory).map((c) => c.path);
  const safeUntracked = untrackedPaths.filter(isSafePath).slice(0, 200);
  if (safeUntracked.length > 0) {
    const perFile = await Promise.all(
      safeUntracked.map((p) => runCommand(deps.run, ["git", "diff", "--numstat", "--no-index", "--", "/dev/null", p], root, "numstat-untracked", deps.signal))
    );
    for (const r of perFile) if ("run" in r) untrackedInsertions += sumNumstat(r.run.stdout).insertions;
  }
  const lastChangeAt = await maxChangeMtime(deps, root, allChanges);
  const distinct = new Set(allChanges.map((c) => c.path));
  const stats = {
    fileCount: distinct.size,
    staged,
    modified,
    untracked,
    insertions: wt.insertions + stg.insertions + untrackedInsertions,
    deletions: wt.deletions + stg.deletions,
    lastChangeAt,
    headCommittedAt: lastCommit?.dateIso ?? null
  };
  const conflictFiles = "run" in conflictRes && conflictRes.run.exitCode === 0 ? conflictRes.run.stdout.split("\n").map((s) => s.trim()).filter((s) => s !== "") : [];
  const stashCount = "run" in stashRes && stashRes.run.exitCode === 0 ? parseStashList(stashRes.run.stdout).length : 0;
  const operation = await detectSnapshotOperation(deps, root, gitDirRes, conflictFiles);
  const snapshot = {
    root,
    branch,
    head,
    unborn,
    dirty: allChanges.length > 0,
    staged,
    modified,
    untracked,
    ahead,
    behind,
    lastCommit,
    changes,
    stats,
    truncated,
    refreshIntervalMs: config.refreshIntervalMs,
    showInputPill: config.showInputPill,
    defaultDiffView: config.defaultDiffView,
    checkedAt: Date.now(),
    conflictFiles,
    operation,
    stashCount
  };
  return { ok: true, value: snapshot };
}
async function maxChangeMtime(deps, root, changes, cap = 200) {
  let max = null;
  const slice = changes.slice(0, cap);
  await Promise.all(slice.map(async (c) => {
    if (c.isDirectory) return;
    try {
      const info = await deps.fs.stat(join(root, c.path));
      if (typeof info.mtimeMs === "number" && Number.isFinite(info.mtimeMs)) {
        max = max === null ? info.mtimeMs : Math.max(max, info.mtimeMs);
      }
    } catch {
    }
  }));
  return max;
}
async function detectSnapshotOperation(deps, root, gitDirRes, conflictFiles) {
  const files = conflictFiles.map((path) => ({ path, resolved: false }));
  let gitDir = "";
  if ("run" in gitDirRes && gitDirRes.run.exitCode === 0) gitDir = gitDirRes.run.stdout.trim();
  if (!gitDir) return files.length > 0 ? { kind: "merge", files } : null;
  const base = gitDir.startsWith("/") ? gitDir : join(root, gitDir);
  const exists = async (rel) => {
    try {
      const st = await deps.fs.stat(join(base, rel));
      return st.size >= 0;
    } catch {
      return false;
    }
  };
  if (await exists("MERGE_HEAD")) return { kind: "merge", files };
  if (await exists("CHERRY_PICK_HEAD")) return { kind: "cherry-pick", files };
  if (await exists("REVERT_HEAD")) return { kind: "revert", files };
  if (await exists("rebase-merge") || await exists("rebase-apply")) return { kind: "rebase", files };
  return files.length > 0 ? { kind: "merge", files } : null;
}

// src/host/actions.ts
import { join as join2, sep } from "node:path";
function withPaths(prefixes, paths) {
  if (paths.length === 0) return { error: "invalid-path", message: "no paths given" };
  for (const path of paths) {
    if (!isSafePath(path)) return { error: "invalid-path", message: `unsafe path: ${path}` };
  }
  return { argv: prefixes.map((prefix) => [...prefix, ...paths]) };
}
function safeBranch(name) {
  if (!isSafeBranchName(name)) return { error: "invalid-name", message: `unsafe branch name: ${name}` };
  return null;
}
function isNetworkCommand(argv) {
  return argv[0] === "git" && (argv[1] === "fetch" || argv[1] === "pull" || argv[1] === "push");
}
function planAction(action, unborn) {
  switch (action.kind) {
    case "stage":
      return withPaths([["git", "add", "--"]], action.paths);
    case "stage-all":
      return { argv: [["git", "add", "-A"]] };
    case "unstage":
      return unborn ? withPaths([["git", "rm", "--cached", "-r", "--"]], action.paths) : withPaths([["git", "restore", "--staged", "--"]], action.paths);
    case "unstage-all":
      return unborn ? { argv: [["git", "rm", "--cached", "-r", "--", "."]] } : { argv: [["git", "restore", "--staged", "--", "."]] };
    case "discard":
      return withPaths([["git", "restore", "--"]], action.paths);
    case "commit": {
      const message = action.message.trim();
      const amend = action.amend === true;
      if (message === "" && !amend) return { error: "empty-message" };
      const amendFlag = amend ? ["--amend"] : [];
      const msgArgs = message === "" ? ["--no-edit"] : ["-m", message];
      if (action.paths === void 0 || action.paths.length === 0) {
        return { argv: [["git", "commit", ...amendFlag, ...msgArgs]] };
      }
      const staged = withPaths([["git", "add", "--"]], action.paths);
      if ("error" in staged) return staged;
      const commitCmd = ["git", "commit", ...amendFlag, ...msgArgs, "--", ...action.paths];
      return { argv: [...staged.argv, commitCmd] };
    }
    case "branch-checkout": {
      const bad = safeBranch(action.name);
      if (bad) return bad;
      return { argv: [["git", "checkout", "--end-of-options", action.name]] };
    }
    case "fetch": {
      const args = ["git", "fetch"];
      if (action.remote !== void 0 && action.remote !== "") {
        const bad = safeBranch(action.remote);
        if (bad) return bad;
        args.push("--end-of-options", action.remote);
      } else {
        args.push("--all");
      }
      if (action.prune !== false) args.push("--prune");
      return { argv: [args] };
    }
    case "pull": {
      if (!isSafeRev(action.remote)) return { error: "invalid-name", message: `unsafe remote: ${action.remote}` };
      if (action.branch !== void 0 && action.branch !== "" && !isSafeBranchName(action.branch)) {
        return { error: "invalid-name", message: `unsafe branch: ${action.branch}` };
      }
      const args = ["git", "pull"];
      if (action.rebase === true) args.push("--rebase");
      if (action.autostash === true) args.push("--autostash");
      args.push("--end-of-options", action.remote);
      if (action.branch !== void 0 && action.branch !== "") args.push(action.branch);
      return { argv: [args] };
    }
    case "push": {
      if (!isSafeRev(action.remote)) return { error: "invalid-name", message: `unsafe remote: ${action.remote}` };
      if (action.tag !== void 0) {
        if (!isSafeRev(action.tag) || action.tag.startsWith("/")) return { error: "invalid-name", message: `unsafe tag name: ${action.tag}` };
        return { argv: [["git", "push", ...action.force === true ? ["--force"] : [], "--end-of-options", action.remote, action.tag]] };
      }
      if (!isSafeBranchName(action.branch)) return { error: "invalid-name", message: `unsafe branch: ${action.branch}` };
      const to = action.toBranch ?? action.branch;
      if (!isSafeBranchName(to)) return { error: "invalid-name", message: `unsafe branch: ${to}` };
      const args = ["git", "push"];
      if (action.setUpstream === true) args.push("--set-upstream");
      if (action.tags === true) args.push("--tags");
      if (action.force === true) args.push("--force");
      args.push("--end-of-options", action.remote, `refs/heads/${action.branch}:refs/heads/${to}`);
      return { argv: [args] };
    }
    case "create-branch": {
      const bad = safeBranch(action.name);
      if (bad) return bad;
      if (action.startPoint !== void 0 && action.startPoint !== "" && !isSafeRev(action.startPoint)) {
        return { error: "invalid-name", message: `unsafe start point: ${action.startPoint}` };
      }
      if (action.checkout === true) {
        const args2 = ["git", "checkout", "-b", action.name];
        if (action.startPoint) args2.push("--end-of-options", action.startPoint);
        return { argv: [args2] };
      }
      const args = ["git", "branch", action.name];
      if (action.startPoint) args.push(action.startPoint);
      return { argv: [args] };
    }
    case "delete-branch": {
      const bad = safeBranch(action.name);
      if (bad) return bad;
      return { argv: [["git", "branch", action.force === true ? "-D" : "-d", "--end-of-options", action.name]] };
    }
    case "rename-branch": {
      if (!isSafeBranchName(action.oldName)) return { error: "invalid-name", message: `unsafe branch name: ${action.oldName}` };
      if (!isSafeBranchName(action.newName)) return { error: "invalid-name", message: `unsafe branch name: ${action.newName}` };
      if (action.oldName === action.newName) return { error: "invalid-name", message: "branch name unchanged" };
      return { argv: [["git", "branch", "-m", "--end-of-options", action.oldName, action.newName]] };
    }
    case "create-tag": {
      if (!isSafeRev(action.name) || action.name.startsWith("/")) return { error: "invalid-name", message: `unsafe tag name: ${action.name}` };
      if (action.ref !== void 0 && action.ref !== "" && !isSafeRev(action.ref)) {
        return { error: "invalid-name", message: `unsafe ref: ${action.ref}` };
      }
      const args = ["git", "tag"];
      if (action.message !== void 0 && action.message !== "") {
        args.push("-a", action.name, "-m", action.message);
      } else {
        args.push(action.name);
      }
      if (action.ref) args.push(action.ref);
      const argv = [args];
      if (action.push === true) {
        const remote = action.pushRemote ?? "";
        if (remote === "") return { error: "no-remote", message: "no push remote resolved" };
        if (!isSafeRev(remote)) return { error: "invalid-name", message: `unsafe push remote: ${remote}` };
        argv.push(["git", "push", "--end-of-options", remote, `refs/tags/${action.name}`]);
      }
      return { argv };
    }
    case "delete-tag": {
      if (!isSafeRev(action.name)) return { error: "invalid-name", message: `unsafe tag name: ${action.name}` };
      return { argv: [["git", "tag", "-d", "--end-of-options", action.name]] };
    }
    case "merge": {
      if (!isSafeRev(action.branch)) return { error: "invalid-name", message: `unsafe branch: ${action.branch}` };
      const args = ["git", "merge", "--end-of-options", action.branch];
      if (action.ffOnly === true) args.splice(2, 0, "--ff-only");
      else if (action.squash === true) args.splice(2, 0, "--squash");
      else if (action.noFf === true) args.splice(2, 0, "--no-ff");
      const argv = [args];
      if (action.squash === true) argv.push(["git", "commit", "--no-edit"]);
      return { argv };
    }
    case "merge-abort":
      return { argv: [["git", "merge", "--abort"]] };
    case "merge-continue": {
      return { argv: [["git", "add", "-A"], ["git", "commit", "--no-edit"]] };
    }
    case "stash-save": {
      const args = ["git", "stash", "push"];
      if (action.message !== void 0 && action.message !== "") args.push("-m", action.message);
      if (action.includeUntracked === true) args.push("--include-untracked");
      if (action.keepIndex === true) args.push("--keep-index");
      if (action.paths !== void 0 && action.paths.length > 0) {
        for (const path of action.paths) {
          if (!isSafePath(path)) return { error: "invalid-path", message: `unsafe path: ${path}` };
        }
        args.push("--", ...action.paths);
      }
      return { argv: [args] };
    }
    case "stash-apply":
    case "stash-pop":
    case "stash-drop": {
      if (!Number.isInteger(action.index) || action.index < 0) return { error: "invalid-name", message: `bad stash index: ${action.index}` };
      const verb = action.kind === "stash-apply" ? "apply" : action.kind === "stash-pop" ? "pop" : "drop";
      return { argv: [["git", "stash", verb, `stash@{${action.index}}`]] };
    }
    case "ignore":
      return { error: "git-error", message: "ignore has no command plan" };
    case "rebase":
    case "worktree-add":
      return { error: "not-implemented", message: `${action.kind} is planned for V2` };
  }
}
function pickDefaultRemote(names) {
  if (names.length === 0) return null;
  return names.includes("origin") ? "origin" : names[0] ?? null;
}
async function resolvePushRemote(deps, root) {
  const res = await runCommand(deps.run, ["git", "remote"], root, "remotes", deps.signal);
  if (!("run" in res) || res.run.exitCode !== 0) return null;
  return pickDefaultRemote(res.run.stdout.split("\n").map((s) => s.trim()).filter((s) => s !== ""));
}
async function runAction(deps, config, request) {
  const workspace = await resolveWorkspace(deps, request.sessionId);
  if (!workspace.ok) return { ok: false, error: mapWorkspaceFailure(workspace.failure) };
  const root = workspace.root;
  const headProbe = await runCommand(deps.run, ["git", "rev-parse", "--verify", "HEAD"], root, "head-probe", deps.signal);
  const unborn = !("run" in headProbe) || headProbe.run.exitCode !== 0;
  if (request.action.kind === "discard") {
    const removed = await discardUntracked(deps, config, root, request.sessionId, request.action.paths);
    if (removed !== null) {
      if (!removed.ok) return removed.result;
      if (removed.remainingTracked.length === 0) {
        const snapshot2 = await snapshotForSession(deps, config, request.sessionId);
        if (!snapshot2.ok) return { ok: false, error: { code: "git-error", message: "snapshot after action failed" } };
        return { ok: true, snapshot: snapshot2.value, output: "" };
      }
      request = { ...request, action: { kind: "discard", paths: removed.remainingTracked } };
    }
  }
  let action = request.action;
  if (action.kind === "ignore") {
    return await appendGitignore(deps, config, root, request.sessionId, action.patterns);
  }
  if (action.kind === "create-tag" && action.push === true && action.pushRemote === void 0) {
    const remote = await resolvePushRemote(deps, root);
    if (remote === null) {
      return { ok: false, error: { code: "no-remote", message: "no git remote configured" } };
    }
    action = { ...action, pushRemote: remote };
  }
  const plan = planAction(action, unborn);
  if ("error" in plan) return { ok: false, error: { code: plan.error, ...plan.message ? { message: plan.message } : {} } };
  let lastOutput = "";
  for (let step = 0; step < plan.argv.length; step += 1) {
    const argv = plan.argv[step];
    const outcome = await runCommand(
      deps.run,
      argv,
      root,
      "action",
      deps.signal,
      void 0,
      isNetworkCommand(argv) ? config.networkTimeoutMs : void 0
    );
    const where = plan.argv.length > 1 ? ` (step ${step + 1}/${plan.argv.length}: ${argv.join(" ")})` : "";
    if ("failure" in outcome) {
      const message = outcome.failure instanceof Error ? outcome.failure.message : String(outcome.failure);
      return { ok: false, error: { code: "git-unavailable", message: message + where } };
    }
    if (outcome.run.cancelled) return { ok: false, error: { code: "cancelled" } };
    if (outcome.run.timedOut) return { ok: false, error: { code: "timeout" } };
    lastOutput = outcome.run.stdout || outcome.run.stderr;
    if (outcome.run.exitCode !== 0) {
      const stderr = outcome.run.stderr;
      if (action.kind === "create-tag" && action.push === true && step > 0) {
        return { ok: false, error: { code: "git-error", message: `tag created locally, but push failed: ${stderr.trim() || `git exited ${outcome.run.exitCode}`}` } };
      }
      if (request.action.kind === "merge" || request.action.kind === "pull" || request.action.kind === "stash-apply" || request.action.kind === "stash-pop") {
        const files = await readConflictFiles(deps, root);
        if (files.length > 0 || /conflict|CONFLICT|needs merge|already exists/i.test(stderr + lastOutput)) {
          const snapshot2 = await snapshotForSession(deps, config, request.sessionId);
          if (snapshot2.ok) {
            return { ok: true, snapshot: snapshot2.value, output: lastOutput.trim(), conflicted: true, conflictFiles: files };
          }
          return { ok: false, error: { code: "conflicted", message: (stderr.trim() || "merge conflict") + where, conflictFiles: files } };
        }
      }
      if (/nothing to commit|no changes added/i.test(stderr + lastOutput)) {
        return { ok: false, error: { code: "git-error", message: (stderr.trim() || "nothing to commit") + where } };
      }
      if (/would be overwritten by checkout|local changes/i.test(stderr)) {
        return { ok: false, error: { code: "local-changes-block", message: stderr.trim() + where } };
      }
      return { ok: false, error: { code: "git-error", message: (stderr.trim() || `git exited ${outcome.run.exitCode}`) + where } };
    }
  }
  const snapshot = await snapshotForSession(deps, config, request.sessionId);
  if (!snapshot.ok) {
    return { ok: false, error: { code: "git-error", message: "snapshot after action failed" } };
  }
  return { ok: true, snapshot: snapshot.value, output: lastOutput.trim() };
}
async function readConflictFiles(deps, root) {
  const res = await runCommand(deps.run, ["git", "diff", "--name-only", "--diff-filter=U"], root, "conflicts", deps.signal);
  if (!("run" in res) || res.run.exitCode !== 0) return [];
  return res.run.stdout.split("\n").map((s) => s.trim()).filter((s) => s !== "");
}
async function appendGitignore(deps, config, root, sessionId, patterns) {
  const trimmed = patterns.map((p) => p.trim()).filter((p) => p !== "");
  if (trimmed.length === 0) return { ok: false, error: { code: "invalid-path", message: "no patterns given" } };
  const unique = [...new Set(trimmed)];
  for (const pattern of unique) {
    if (!isSafeIgnorePattern(pattern)) return { ok: false, error: { code: "invalid-path", message: `unsafe pattern: ${pattern}` } };
  }
  const ignorePath = join2(root, ".gitignore");
  let current = "";
  try {
    current = (await deps.fs.readFile(ignorePath)).toString("utf8");
  } catch {
    current = "";
  }
  const existing = new Set(current.split("\n").map((line) => line.trim()).filter((line) => line !== ""));
  const fresh = unique.filter((p) => !existing.has(p));
  if (fresh.length === 0) {
    const snapshot2 = await snapshotForSession(deps, config, sessionId);
    if (!snapshot2.ok) return { ok: false, error: { code: "git-error", message: "snapshot after action failed" } };
    return { ok: true, snapshot: snapshot2.value, output: "" };
  }
  const prefix = current === "" || current.endsWith("\n") ? "" : "\n";
  try {
    await deps.fs.writeFile(ignorePath, `${current}${prefix}${fresh.join("\n")}
`);
  } catch (error) {
    return { ok: false, error: { code: "git-error", message: error instanceof Error ? error.message : "write .gitignore failed" } };
  }
  const snapshot = await snapshotForSession(deps, config, sessionId);
  if (!snapshot.ok) return { ok: false, error: { code: "git-error", message: "snapshot after action failed" } };
  return { ok: true, snapshot: snapshot.value, output: fresh.join("\n") };
}
async function discardUntracked(deps, config, root, sessionId, paths) {
  const snap = await snapshotForSession(deps, config, sessionId);
  if (!snap.ok) return null;
  const untrackedSet = new Set(snap.value.changes.filter((c) => c.status === "untracked").map((c) => c.path));
  const untracked = paths.filter((p) => untrackedSet.has(p));
  if (untracked.length === 0) return null;
  const tracked = paths.filter((p) => !untrackedSet.has(p));
  let rootReal;
  try {
    rootReal = await deps.fs.realpath(root);
  } catch {
    return { ok: false, result: { ok: false, error: { code: "git-error", message: "repository root unavailable" } } };
  }
  for (const path of untracked) {
    if (!isSafePath(path)) return { ok: false, result: { ok: false, error: { code: "invalid-path", message: `unsafe path: ${path}` } } };
    const target = join2(root, path);
    let targetReal;
    try {
      targetReal = await deps.fs.realpath(target);
    } catch {
      continue;
    }
    if (targetReal !== rootReal && !targetReal.startsWith(rootReal + sep)) {
      return { ok: false, result: { ok: false, error: { code: "invalid-path", message: `path escapes repository: ${path}` } } };
    }
    await deps.fs.remove(target).catch(() => {
    });
  }
  return { ok: true, remainingTracked: tracked };
}

// src/host/queries.ts
import { join as join3, sep as sep2 } from "node:path";

// src/host/github.ts
function isGhPathName(name) {
  return /^[A-Za-z0-9_.-]+$/.test(name);
}
function extractRepoAvatars(payload) {
  if (!Array.isArray(payload)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of payload) {
    if (typeof c?.sha !== "string" || c.sha === "") continue;
    const url = c?.author?.avatar_url;
    if (typeof url !== "string" || url === "" || seen.has(c.sha)) continue;
    seen.add(c.sha);
    out.push({ sha: c.sha, url });
  }
  return out;
}
var CACHE_TTL_MS = 10 * 60 * 1e3;
var cache = /* @__PURE__ */ new Map();
function getCachedAvatars(owner, repo) {
  const hit = cache.get(`${owner}/${repo}`);
  if (!hit || Date.now() - hit.at >= CACHE_TTL_MS) return null;
  return hit.avatars;
}
function setCachedAvatars(owner, repo, avatars) {
  cache.set(`${owner}/${repo}`, { at: Date.now(), avatars });
}

// src/host/types.ts
var IMAGE_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff"
};
function imageMimeFor(path) {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return null;
  return IMAGE_MIME[path.slice(dot + 1).toLowerCase()] ?? null;
}

// src/host/queries.ts
var GRAPH_FORMAT = "--format=%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%s%x1e";
function isHexLike(text) {
  return /^[0-9a-fA-F]{7,40}$/.test(text.trim());
}
async function runQuery(deps, config, request) {
  const q = request.query;
  if (q.kind === "dir-list" || q.kind === "file-content") {
    const browse = await resolveBrowseRoot(deps, request.sessionId);
    if (!browse.ok) return { ok: false, error: browse.error };
    try {
      return q.kind === "dir-list" ? await queryDirList(deps, browse.root, q, browse.isGitRepo) : await queryFileContent(deps, config, browse.root, q);
    } catch (error) {
      return { ok: false, error: { code: "git-error", message: error instanceof Error ? error.message : String(error) } };
    }
  }
  const workspace = await resolveWorkspace(deps, request.sessionId);
  if (!workspace.ok) return { ok: false, error: mapWorkspaceFailure(workspace.failure) };
  const root = workspace.root;
  try {
    switch (q.kind) {
      case "history":
        return await queryHistory(deps, root, q);
      case "diff":
        return await queryDiff(deps, root, q);
      case "file-lines":
        return await queryFileLines(deps, root, q);
      case "image-diff":
        return await queryImageDiff(deps, config, root, q);
      case "show":
        return await queryShow(deps, root, q.ref);
      case "branches":
        return await queryBranches(deps, root);
      case "tags":
        return await queryTags(deps, root);
      case "authors":
        return await queryAuthors(deps, root);
      case "last-commit-message":
        return await queryLastCommitMessage(deps, root);
      case "worktree-stats":
        return await queryWorktreeStats(deps, config, request.sessionId);
      case "stash-list":
        return await queryStashList(deps, root);
      case "conflicts":
        return await queryConflicts(deps, root);
      case "operation-state":
        return await queryOperationState(deps, root);
      case "remote-url":
        return await queryRemoteUrl(deps, root);
      case "patch":
        return await queryPatch(deps, root, q);
      case "quick-status":
        return await queryQuickStatus(deps, root);
      case "github-avatars":
        return await queryGithubAvatars(deps, root, q);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { code: "git-error", message } };
  }
}
async function queryHistory(deps, root, q) {
  const limit = Number.isFinite(q.limit) ? Math.min(500, Math.max(1, Math.trunc(q.limit))) : 100;
  const skip = Number.isFinite(q.skip) ? Math.max(0, Math.trunc(q.skip)) : 0;
  const args = ["git", "log", GRAPH_FORMAT, `--max-count=${limit}`, `--skip=${skip}`];
  const search = q.search?.trim() ?? "";
  const hexJump = search !== "" && isHexLike(search);
  const countArgs = ["git", "rev-list", "--count"];
  if (!hexJump) {
    const filters = [];
    if (search !== "") filters.push("-i", "-E", `--grep=${search}`);
    if (q.author !== void 0 && q.author !== "") filters.push(`--author=${q.author}`);
    if (q.since !== void 0 && q.since !== "") filters.push(`--since=${q.since}`);
    if (q.ref !== void 0 && q.ref !== "") {
      if (!isSafeRev(q.ref)) return { ok: false, error: { code: "invalid-name", message: `unsafe ref: ${q.ref}` } };
      filters.push("--end-of-options", q.ref);
    } else {
      filters.push("--all");
    }
    args.push(...filters);
    countArgs.push(...filters);
  } else {
    args.push("--end-of-options", search);
  }
  const [res, countRes] = await Promise.all([
    runCommand(deps.run, args, root, "history", deps.signal),
    hexJump ? Promise.resolve(null) : runCommand(deps.run, countArgs, root, "history-count", deps.signal)
  ]);
  if (!("run" in res)) return { ok: false, error: { code: "git-unavailable" } };
  if (res.run.cancelled) return { ok: false, error: { code: "cancelled" } };
  if (res.run.timedOut) return { ok: false, error: { code: "timeout" } };
  if (res.run.exitCode !== 0) {
    const stderr = res.run.stderr.trim();
    if (hexJump || /unknown revision|bad revision|does not have any commits|ambiguous argument/i.test(stderr)) {
      return { ok: true, value: { kind: "history", commits: [], total: 0 } };
    }
    return { ok: false, error: { code: "git-error", message: stderr || `git exited ${res.run.exitCode}` } };
  }
  const commits = parseGraphLog(res.run.stdout);
  let total = -1;
  if (!hexJump && countRes !== null && "run" in countRes && countRes.run.exitCode === 0) {
    const n = Number(countRes.run.stdout.trim());
    if (Number.isFinite(n)) total = n;
  }
  return { ok: true, value: { kind: "history", commits, total } };
}
async function queryDiff(deps, root, q) {
  if (!isSafePath(q.path)) return { ok: false, error: { code: "invalid-path", message: q.path } };
  const ctx = q.context !== void 0 && Number.isFinite(q.context) ? Math.max(0, Math.min(1e5, Math.floor(q.context))) : 3;
  const unified = `-U${ctx}`;
  let args;
  if (q.base === "staged") {
    args = ["git", "diff", unified, "--cached", "--", q.path];
  } else if (q.base === "commit") {
    if (!isSafeRev(q.commit)) return { ok: false, error: { code: "invalid-name", message: `unsafe commit: ${q.commit}` } };
    args = ["git", "show", unified, "--end-of-options", q.commit, "--", q.path];
  } else {
    args = ["git", "diff", unified, "--", q.path];
  }
  const res = await runCommand(deps.run, args, root, "diff", deps.signal);
  if (!("run" in res)) return { ok: false, error: { code: "git-unavailable" } };
  if (res.run.cancelled) return { ok: false, error: { code: "cancelled" } };
  if (res.run.timedOut) return { ok: false, error: { code: "timeout" } };
  let text = res.run.stdout;
  if (q.base === "worktree" && text.trim() === "") {
    const tracked = await runCommand(deps.run, ["git", "ls-files", "--error-unmatch", "--", q.path], root, "diff-tracked-probe", deps.signal);
    const isUntracked = !("run" in tracked) || tracked.run.exitCode !== 0;
    if (isUntracked) {
      const noIndex = await runCommand(deps.run, ["git", "diff", unified, "--no-index", "--", "/dev/null", q.path], root, "diff-untracked", deps.signal);
      if ("run" in noIndex) text = noIndex.run.stdout;
    }
  }
  return { ok: true, value: { kind: "diff", path: q.path, text } };
}
async function queryFileLines(deps, root, q) {
  if (!isSafePath(q.path)) return { ok: false, error: { code: "invalid-path", message: q.path } };
  const start = Number.isFinite(q.start) ? Math.max(1, Math.floor(q.start)) : 1;
  const end = Number.isFinite(q.end) ? Math.max(start, Math.floor(q.end)) : start;
  let args;
  if (q.base === "commit") {
    if (!isSafeRev(q.commit)) return { ok: false, error: { code: "invalid-name", message: `unsafe commit: ${q.commit}` } };
    args = ["git", "show", "--end-of-options", `${q.commit}:${q.path}`];
  } else {
    args = ["git", "show", `--end-of-options`, `:${q.path}`];
    if (q.base === "worktree") args = ["git", "cat-file", "-p", `:${q.path}`];
  }
  const res = await runCommand(deps.run, args, root, "file-lines", deps.signal);
  if (!("run" in res)) return { ok: false, error: { code: "git-unavailable" } };
  if (res.run.cancelled) return { ok: false, error: { code: "cancelled" } };
  if (res.run.timedOut) return { ok: false, error: { code: "timeout" } };
  if (res.run.exitCode !== 0) {
    if (q.base === "worktree") {
      const wt = await readWorktreeText(deps, root, q.path);
      if (wt !== null) return sliceLines(q.path, wt, start, end);
    }
    return { ok: false, error: { code: "git-error", message: res.run.stderr.trim() || "no such blob" } };
  }
  return sliceLines(q.path, res.run.stdout, start, end);
}
async function readWorktreeText(deps, root, path) {
  try {
    const file = join3(root, path);
    const real = await deps.fs.realpath(file);
    const rootReal = await deps.fs.realpath(root);
    if (real !== rootReal && !real.startsWith(rootReal + sep2)) return null;
    const buf = await deps.fs.readFile(file);
    return buf.toString("utf8");
  } catch {
    return null;
  }
}
function sliceLines(path, content, start, end) {
  const all = content.split("\n");
  if (all.length > 0 && all[all.length - 1] === "") all.pop();
  const from = Math.min(start, all.length + 1);
  const to = Math.min(end, all.length);
  const lines = from <= to ? all.slice(from - 1, to) : [];
  const eof = to >= all.length;
  return { ok: true, value: { kind: "file-lines", path, start: from, lines, eof } };
}
async function queryImageDiff(deps, config, root, q) {
  if (!isSafePath(q.path)) return { ok: false, error: { code: "invalid-path", message: q.path } };
  if (q.base === "commit" && !isSafeRev(q.commit)) return { ok: false, error: { code: "invalid-name", message: `unsafe commit: ${q.commit}` } };
  const mime = imageMimeFor(q.path);
  if (mime === null) return { ok: true, value: { kind: "image-diff", path: q.path, mime } };
  const oldSpec = q.base === "staged" ? `HEAD:${q.path}` : q.base === "commit" ? `${q.commit}^1:${q.path}` : `:${q.path}`;
  const newSpec = q.base === "staged" ? `:${q.path}` : q.base === "commit" ? `${q.commit}:${q.path}` : null;
  const [oldOid, newOid] = await Promise.all([
    resolveOid(deps, root, oldSpec),
    newSpec === null ? Promise.resolve(void 0) : resolveOid(deps, root, newSpec)
  ]);
  const cap = config.maxBytes;
  const gitDir = oldOid !== void 0 || newOid !== void 0 ? await absoluteGitDir(deps, root) : "";
  const [oldSide, newSide] = await Promise.all([
    oldOid === void 0 ? Promise.resolve(void 0) : blobSide(deps, gitDir, oldOid, cap),
    newOid !== void 0 ? blobSide(deps, gitDir, newOid, cap) : q.base === "worktree" ? worktreeSide(deps, root, q.path, cap) : Promise.resolve(void 0)
  ]);
  const sides = [oldSide, newSide];
  if (sides.some((s) => s !== void 0 && "tooLarge" in s)) {
    return { ok: true, value: { kind: "image-diff", path: q.path, mime, tooLarge: true } };
  }
  const old64 = sides[0] !== void 0 && !("tooLarge" in sides[0]) ? sides[0].data : void 0;
  const new64 = sides[1] !== void 0 && !("tooLarge" in sides[1]) ? sides[1].data : void 0;
  return {
    ok: true,
    value: {
      kind: "image-diff",
      path: q.path,
      mime,
      ...old64 !== void 0 ? { old: `data:${mime};base64,${old64}` } : {},
      ...new64 !== void 0 ? { new: `data:${mime};base64,${new64}` } : {}
    }
  };
}
async function resolveOid(deps, root, spec) {
  const res = await runCommand(deps.run, ["git", "rev-parse", "--verify", "--quiet", spec], root, "image-oid", deps.signal);
  if (!("run" in res) || res.run.exitCode !== 0) return void 0;
  const oid = res.run.stdout.trim();
  return /^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(oid) ? oid : void 0;
}
async function absoluteGitDir(deps, root) {
  const res = await runCommand(deps.run, ["git", "rev-parse", "--absolute-git-dir"], root, "git-dir", deps.signal);
  if (!("run" in res) || res.run.exitCode !== 0) throw new Error("git dir unavailable");
  return res.run.stdout.trim();
}
async function blobSide(deps, gitDir, oid, cap) {
  const sizeRes = await runCommand(deps.run, ["git", "cat-file", "-s", oid], gitDir, "image-size", deps.signal);
  if (!("run" in sizeRes) || sizeRes.run.exitCode !== 0) return void 0;
  const size = Number(sizeRes.run.stdout.trim());
  if (!Number.isFinite(size)) return void 0;
  if (size > cap) return { tooLarge: true };
  const nameRes = await runCommand(deps.run, ["git", "unpack-file", oid], gitDir, "image-unpack", deps.signal);
  if (!("run" in nameRes) || nameRes.run.exitCode !== 0) return void 0;
  const name = nameRes.run.stdout.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return void 0;
  const file = join3(gitDir, name);
  try {
    const buf = await deps.fs.readFile(file);
    if (buf.length > cap) return { tooLarge: true };
    return { data: buf.toString("base64") };
  } catch {
    return void 0;
  } finally {
    await deps.fs.remove(file).catch(() => {
    });
  }
}
async function worktreeSide(deps, root, path, cap) {
  try {
    const file = join3(root, path);
    const real = await deps.fs.realpath(file);
    const rootReal = await deps.fs.realpath(root);
    if (real !== rootReal && !real.startsWith(rootReal + sep2)) return void 0;
    const info = await deps.fs.stat(file);
    if (info.size > cap) return { tooLarge: true };
    const buf = await deps.fs.readFile(file);
    if (buf.length > cap) return { tooLarge: true };
    return { data: buf.toString("base64") };
  } catch {
    return void 0;
  }
}
var DIR_ENTRY_CAP = 2e3;
async function queryDirList(deps, root, q, isGitRepo) {
  const rel = q.path;
  if (rel !== "" && !isSafePath(rel) || hasGitSegment(rel)) return { ok: false, error: { code: "invalid-path", message: rel } };
  const dir = rel === "" ? root : join3(root, rel);
  const inside = await isInsideRoot(deps, root, dir, true);
  if (!inside) return { ok: false, error: { code: "invalid-path", message: rel } };
  let raw;
  try {
    raw = await deps.fs.readdir(dir);
  } catch (error) {
    return { ok: false, error: { code: "git-error", message: error instanceof Error ? error.message : "readdir failed" } };
  }
  const filtered = raw.filter((e) => e.name !== ".git");
  filtered.sort((a, b) => a.isDirectory !== b.isDirectory ? a.isDirectory ? -1 : 1 : a.name.localeCompare(b.name));
  const truncated = filtered.length > DIR_ENTRY_CAP;
  const slice = truncated ? filtered.slice(0, DIR_ENTRY_CAP) : filtered;
  const ignored = isGitRepo ? await ignoredEntries(deps, root, rel, slice.map((e) => e.name)) : /* @__PURE__ */ new Set();
  const entries = await Promise.all(slice.map(async (e) => {
    const ignoreFlag = ignored.has(e.name) ? { ignored: true } : {};
    if (e.isDirectory) return { name: e.name, dir: true, ...ignoreFlag };
    let size;
    try {
      size = (await deps.fs.stat(join3(dir, e.name))).size;
    } catch {
      size = void 0;
    }
    return { name: e.name, dir: false, ...size !== void 0 ? { size } : {}, ...ignoreFlag };
  }));
  const path = rel === "" ? "" : rel.replace(/\/+$/, "");
  return { ok: true, value: { kind: "dir-list", path, entries, truncated } };
}
async function ignoredEntries(deps, root, parent, names) {
  const ignored = /* @__PURE__ */ new Set();
  const paths = names.map((name) => parent === "" ? name : `${parent}/${name}`);
  for (let index = 0; index < paths.length; ) {
    const batch = [];
    let bytes = 0;
    while (index < paths.length && batch.length < 128) {
      const candidate = paths[index];
      const size = Buffer.byteLength(candidate) + 1;
      if (batch.length > 0 && bytes + size > 32 * 1024) break;
      batch.push(candidate);
      bytes += size;
      index++;
    }
    const result = await runCommand(deps.run, ["git", "check-ignore", "-z", "--stdin"], root, "dir-ignore", deps.signal, `${batch.join("\0")}\0`);
    if ("failure" in result || result.run.timedOut || result.run.cancelled || result.run.stdoutLossy || ![0, 1].includes(result.run.exitCode ?? -1)) continue;
    const matches = new Set(result.run.stdout.split("\0"));
    for (const path of batch) if (matches.has(path)) ignored.add(parent === "" ? path : path.slice(parent.length + 1));
  }
  return ignored;
}
async function queryFileContent(deps, config, root, q) {
  if (!isSafePath(q.path) || hasGitSegment(q.path)) return { ok: false, error: { code: "invalid-path", message: q.path } };
  const file = join3(root, q.path);
  const inside = await isInsideRoot(deps, root, file, true);
  if (!inside) return { ok: false, error: { code: "invalid-path", message: q.path } };
  const cap = config.maxBytes;
  let info;
  try {
    info = await deps.fs.stat(file);
  } catch (error) {
    return { ok: false, error: { code: "git-error", message: error instanceof Error ? error.message : "stat failed" } };
  }
  const mime = imageMimeFor(q.path);
  const tooLarge = { ok: true, value: { kind: "file-content", path: q.path, variant: mime !== null ? "image" : "text", tooLarge: true } };
  if (info.size > cap) return tooLarge;
  let buf;
  try {
    buf = await deps.fs.readFile(file);
  } catch (error) {
    return { ok: false, error: { code: "git-error", message: error instanceof Error ? error.message : "read failed" } };
  }
  if (buf.length > cap) return tooLarge;
  if (mime !== null) {
    return { ok: true, value: { kind: "file-content", path: q.path, variant: "image", dataUrl: `data:${mime};base64,${buf.toString("base64")}` } };
  }
  if (isBinaryBuffer(buf)) return { ok: true, value: { kind: "file-content", path: q.path, variant: "binary" } };
  const content = buf.toString("utf8");
  const lines = content === "" ? 0 : content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
  return { ok: true, value: { kind: "file-content", path: q.path, variant: "text", content, lines } };
}
function hasGitSegment(path) {
  return path.split(/[\\/]/).includes(".git");
}
async function isInsideRoot(deps, root, path, hideGit = false) {
  try {
    const real = await deps.fs.realpath(path);
    const rootReal = await deps.fs.realpath(root);
    if (real !== rootReal && !real.startsWith(rootReal + sep2)) return false;
    return !hideGit || !hasGitSegment(real.slice(rootReal.length + 1));
  } catch {
    return false;
  }
}
function isBinaryBuffer(buf) {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}
async function queryShow(deps, root, ref) {
  if (!isSafeRev(ref)) return { ok: false, error: { code: "invalid-name", message: `unsafe ref: ${ref}` } };
  const metaFormat = "--format=%H%x1f%h%x1f%s%x1f%an%x1f%ae%x1f%aI%x1f%b";
  const [metaRes, statRes] = await Promise.all([
    runCommand(deps.run, ["git", "show", "-s", metaFormat, "--end-of-options", ref], root, "show-meta", deps.signal),
    runCommand(deps.run, ["git", "show", "--name-status", "-z", "--format=", "--end-of-options", ref], root, "show-stat", deps.signal)
  ]);
  if (!("run" in metaRes)) return { ok: false, error: { code: "git-unavailable" } };
  if (metaRes.run.cancelled) return { ok: false, error: { code: "cancelled" } };
  if (metaRes.run.timedOut) return { ok: false, error: { code: "timeout" } };
  if (metaRes.run.exitCode !== 0) {
    return { ok: false, error: { code: "git-error", message: metaRes.run.stderr.trim() || "unknown ref" } };
  }
  const parts = metaRes.run.stdout.split("");
  let commit = null;
  let body = "";
  if (parts.length >= 6 && parts[0]) {
    commit = {
      hash: parts[0],
      shortHash: parts[1] ?? "",
      subject: parts[2] ?? "",
      author: parts[3] ?? "",
      authorEmail: parts[4] ?? "",
      dateIso: parts[5] ?? ""
    };
    body = parts.slice(6).join("").trim();
  }
  const stats = "run" in statRes && statRes.run.exitCode === 0 ? parseNameStatus(statRes.run.stdout) : [];
  return { ok: true, value: { kind: "show", ref, commit, body, stats } };
}
async function queryBranches(deps, root) {
  const fmt = "--format=%(refname:short)%00%(objectname:short)%00%(upstream:track)%00%(upstream:short)";
  const [localRes, remoteRes, currentRes, defaultRes, remotesRes] = await Promise.all([
    runCommand(deps.run, ["git", "for-each-ref", "--sort=-committerdate", fmt, "refs/heads"], root, "branches-local", deps.signal),
    runCommand(deps.run, ["git", "for-each-ref", "--sort=-committerdate", fmt, "refs/remotes"], root, "branches-remote", deps.signal),
    runCommand(deps.run, ["git", "symbolic-ref", "--quiet", "--short", "HEAD"], root, "branch-current", deps.signal),
    runCommand(deps.run, ["git", "symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], root, "branch-default", deps.signal),
    runCommand(deps.run, ["git", "remote"], root, "remotes", deps.signal)
  ]);
  const localRaw = "run" in localRes && localRes.run.exitCode === 0 ? parseBranches(localRes.run.stdout) : [];
  const remote = "run" in remoteRes && remoteRes.run.exitCode === 0 ? parseBranches(remoteRes.run.stdout).filter((b) => !b.name.endsWith("/HEAD")) : null;
  const remotes = "run" in remotesRes && remotesRes.run.exitCode === 0 ? remotesRes.run.stdout.split("\n").map((s) => s.trim()).filter((s) => s !== "") : [];
  const local = markRemotePresence(localRaw, remote, remotes);
  const current = "run" in currentRes && currentRes.run.exitCode === 0 ? currentRes.run.stdout.trim() || null : null;
  let defaultBranch = null;
  if ("run" in defaultRes && defaultRes.run.exitCode === 0) {
    const raw = defaultRes.run.stdout.trim();
    defaultBranch = raw.replace(/^origin\//, "") || null;
  }
  return { ok: true, value: { kind: "branches", current, defaultBranch, local, remote: remote ?? [], remotes } };
}
async function queryTags(deps, root) {
  const res = await runCommand(deps.run, ["git", "for-each-ref", "--sort=-creatordate", "--format=%(refname:short)%00%(objectname:short)", "refs/tags"], root, "tags", deps.signal);
  const tags = "run" in res && res.run.exitCode === 0 ? parseTags(res.run.stdout) : [];
  return { ok: true, value: { kind: "tags", tags } };
}
async function queryAuthors(deps, root) {
  const res = await runCommand(deps.run, ["git", "log", "--all", "--format=%an", "--max-count=2000"], root, "authors", deps.signal);
  const authors = "run" in res && res.run.exitCode === 0 ? [...new Set(res.run.stdout.split("\n").map((s) => s.trim()).filter((s) => s !== ""))].sort((a, b) => a.localeCompare(b)) : [];
  return { ok: true, value: { kind: "authors", authors } };
}
async function queryLastCommitMessage(deps, root) {
  const res = await runCommand(deps.run, ["git", "log", "-1", "--format=%B"], root, "last-message", deps.signal);
  const message = "run" in res && res.run.exitCode === 0 ? res.run.stdout.replace(/\n+$/, "") : "";
  return { ok: true, value: { kind: "last-commit-message", message } };
}
async function queryWorktreeStats(deps, config, sessionId) {
  const snapshot = await snapshotForSession(deps, config, sessionId);
  if (!snapshot.ok) return { ok: false, error: { code: "git-error", message: "snapshot failed" } };
  return { ok: true, value: { kind: "worktree-stats", stats: snapshot.value.stats } };
}
async function queryStashList(deps, root) {
  const res = await runCommand(
    deps.run,
    ["git", "stash", "list", "--format=%gd%00%gs%00%aI%00%P%00%H"],
    root,
    "stash-list",
    deps.signal
  );
  if (!("run" in res)) return { ok: false, error: { code: "git-unavailable" } };
  if (res.run.cancelled) return { ok: false, error: { code: "cancelled" } };
  if (res.run.timedOut) return { ok: false, error: { code: "timeout" } };
  if (res.run.exitCode !== 0) return { ok: true, value: { kind: "stash-list", stashes: [] } };
  return { ok: true, value: { kind: "stash-list", stashes: parseStashList(res.run.stdout) } };
}
async function queryConflicts(deps, root) {
  const res = await runCommand(deps.run, ["git", "diff", "--name-only", "--diff-filter=U"], root, "conflicts", deps.signal);
  if (!("run" in res)) return { ok: false, error: { code: "git-unavailable" } };
  if (res.run.cancelled) return { ok: false, error: { code: "cancelled" } };
  if (res.run.timedOut) return { ok: false, error: { code: "timeout" } };
  const files = res.run.exitCode === 0 ? res.run.stdout.split("\n").map((s) => s.trim()).filter((s) => s !== "") : [];
  return { ok: true, value: { kind: "conflicts", files } };
}
async function queryOperationState(deps, root) {
  const operation = await detectOperation(deps, root);
  return { ok: true, value: { kind: "operation-state", operation } };
}
async function queryRemoteUrl(deps, root) {
  const res = await runCommand(deps.run, ["git", "remote", "get-url", "origin"], root, "remote-url", deps.signal);
  if (!("run" in res)) return { ok: false, error: { code: "git-unavailable" } };
  if (res.run.cancelled) return { ok: false, error: { code: "cancelled" } };
  if (res.run.timedOut) return { ok: false, error: { code: "timeout" } };
  const url = res.run.exitCode === 0 ? res.run.stdout.trim() : "";
  return { ok: true, value: { kind: "remote-url", url } };
}
var MAX_PATCH_FILES = 200;
var MAX_PATCH_BYTES = 512 * 1024;
async function queryPatch(deps, root, q) {
  const paths = [...new Set(q.paths)].filter((p) => p !== "");
  if (paths.length === 0 || paths.length > MAX_PATCH_FILES) {
    return { ok: false, error: { code: "invalid-path", message: "bad path count" } };
  }
  for (const path of paths) {
    if (!isSafePath(path)) return { ok: false, error: { code: "invalid-path", message: `unsafe path: ${path}` } };
  }
  const parts = [];
  let bytes = 0;
  let truncated = false;
  const push = (text) => {
    if (text === "" || truncated) return;
    if (bytes + text.length > MAX_PATCH_BYTES) {
      truncated = true;
      return;
    }
    parts.push(text);
    bytes += text.length;
  };
  const tracked = await runCommand(deps.run, ["git", "diff", "HEAD", "--", ...paths], root, "patch-tracked", deps.signal);
  if (!("run" in tracked)) return { ok: false, error: { code: "git-unavailable" } };
  if (tracked.run.cancelled) return { ok: false, error: { code: "cancelled" } };
  if (tracked.run.timedOut) return { ok: false, error: { code: "timeout" } };
  if (tracked.run.exitCode === 0) push(tracked.run.stdout);
  const others = await runCommand(
    deps.run,
    ["git", "ls-files", "--others", "--exclude-standard", "-z", "--", ...paths],
    root,
    "patch-untracked",
    deps.signal
  );
  if ("run" in others && others.run.exitCode === 0) {
    const files = others.run.stdout.split("\0").map((s) => s.trim()).filter((s) => s !== "").slice(0, MAX_PATCH_FILES);
    for (const file of files) {
      if (truncated) break;
      const one = await runCommand(deps.run, ["git", "diff", "--no-index", "--", "/dev/null", file], root, "patch-new-file", deps.signal);
      if ("run" in one && (one.run.exitCode === 0 || one.run.exitCode === 1)) push(one.run.stdout);
    }
  }
  return { ok: true, value: { kind: "patch", text: parts.join(""), truncated } };
}
async function queryGithubAvatars(deps, root, q) {
  if (!isGhPathName(q.owner) || !isGhPathName(q.repo)) {
    return { ok: false, error: { code: "invalid-name", message: "unsafe owner/repo" } };
  }
  const cached = getCachedAvatars(q.owner, q.repo);
  if (cached !== null) return { ok: true, value: { kind: "github-avatars", avatars: cached } };
  const res = await runCommand(
    deps.run,
    // NOTE: no `-f` fields here — they flip gh to POST, which this endpoint
    // rejects; the query string keeps it a GET.
    ["gh", "api", `repos/${q.owner}/${q.repo}/commits?per_page=100`],
    root,
    "github-avatars",
    deps.signal,
    void 0,
    3e4
  );
  if (!("run" in res)) return { ok: true, value: { kind: "github-avatars", avatars: [] } };
  if (res.run.cancelled) return { ok: false, error: { code: "cancelled" } };
  if (res.run.timedOut || res.run.exitCode !== 0) {
    return { ok: true, value: { kind: "github-avatars", avatars: [] } };
  }
  let payload = null;
  try {
    payload = JSON.parse(res.run.stdout);
  } catch {
    return { ok: true, value: { kind: "github-avatars", avatars: [] } };
  }
  const avatars = extractRepoAvatars(payload);
  setCachedAvatars(q.owner, q.repo, avatars);
  return { ok: true, value: { kind: "github-avatars", avatars } };
}
async function queryQuickStatus(deps, root) {
  const [headRes, statusRes] = await Promise.all([
    runCommand(deps.run, ["git", "rev-parse", "HEAD"], root, "quick-head", deps.signal),
    runCommand(deps.run, ["git", "status", "-b", "--porcelain=v1", "-z"], root, "quick-status", deps.signal)
  ]);
  for (const r of [headRes, statusRes]) {
    if (!("run" in r)) return { ok: false, error: { code: "git-unavailable" } };
    if (r.run.cancelled) return { ok: false, error: { code: "cancelled" } };
    if (r.run.timedOut) return { ok: false, error: { code: "timeout" } };
  }
  const head = "run" in headRes && headRes.run.exitCode === 0 ? headRes.run.stdout.trim() || null : null;
  let branch = null;
  let ahead = 0;
  let behind = 0;
  let rest = "";
  if ("run" in statusRes && statusRes.run.exitCode === 0) {
    const out = statusRes.run.stdout;
    const nul = out.indexOf("\0");
    if (nul >= 0) {
      const header = parseBranchHeader(out.slice(0, nul));
      branch = header.branch;
      ahead = header.ahead;
      behind = header.behind;
      rest = out.slice(nul + 1);
    } else {
      rest = out;
    }
  }
  let staged = 0;
  let modified = 0;
  let untracked = 0;
  for (const c of parseStatus(rest)) {
    if (c.status === "untracked") untracked++;
    else if (c.staged) staged++;
    else modified++;
  }
  return { ok: true, value: { kind: "quick-status", branch, head, staged, modified, untracked, ahead, behind } };
}
async function detectOperation(deps, root) {
  const dirRes = await runCommand(deps.run, ["git", "rev-parse", "--absolute-git-dir"], root, "git-dir", deps.signal);
  if (!("run" in dirRes) || dirRes.run.exitCode !== 0) return null;
  const gitDir = dirRes.run.stdout.trim();
  if (!gitDir) return null;
  const exists = async (rel) => {
    try {
      const st = await deps.fs.stat(join3(gitDir.startsWith("/") ? gitDir : join3(root, gitDir), rel));
      return st.size >= 0;
    } catch {
      return false;
    }
  };
  const conflictRes = await runCommand(deps.run, ["git", "diff", "--name-only", "--diff-filter=U"], root, "op-conflicts", deps.signal);
  const rawFiles = "run" in conflictRes && conflictRes.run.exitCode === 0 ? conflictRes.run.stdout.split("\n").map((s) => s.trim()).filter((s) => s !== "") : [];
  const files = rawFiles.map((path) => ({ path, resolved: false }));
  if (await exists("MERGE_HEAD")) return { kind: "merge", files };
  if (await exists("CHERRY_PICK_HEAD")) return { kind: "cherry-pick", files };
  if (await exists("REVERT_HEAD")) return { kind: "revert", files };
  if (await exists("rebase-merge") || await exists("rebase-apply")) return { kind: "rebase", files };
  return files.length > 0 ? { kind: "merge", files } : null;
}

// src/host/version.ts
import { readFile as readFile2 } from "node:fs/promises";
import { dirname, join as join4 } from "node:path";
import { fileURLToPath } from "node:url";
function manifestPath() {
  return join4(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");
}
function stringField(value) {
  return typeof value === "string" && value !== "" ? value : void 0;
}
function parseRepository(repository) {
  const raw = typeof repository === "string" ? repository : typeof repository === "object" && repository !== null ? stringField(repository.url) : void 0;
  if (raw === void 0) return void 0;
  const fromHost = raw.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:$|[/#?])/i);
  if (fromHost !== null) return { owner: fromHost[1], repo: fromHost[2] };
  const shorthand = raw.match(/^(?:github:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
  if (shorthand !== null) return { owner: shorthand[1], repo: shorthand[2] };
  return void 0;
}
function compareVersions(a, b) {
  const split = (value) => {
    const trimmed = value.trim().replace(/^v/i, "");
    const [core, ...rest] = trimmed.split("-");
    const preRaw = rest.join("-");
    return {
      core: core.split(".").map((part) => Number.parseInt(part, 10)).filter((part) => Number.isFinite(part)),
      pre: preRaw === "" ? [] : preRaw.split(".")
    };
  };
  const left = split(a);
  const right = split(b);
  const length = Math.max(left.core.length, right.core.length);
  for (let index = 0; index < length; index += 1) {
    const l = left.core[index] ?? 0;
    const r = right.core[index] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  if (left.pre.length === 0 && right.pre.length === 0) return 0;
  if (left.pre.length === 0) return 1;
  if (right.pre.length === 0) return -1;
  const preLen = Math.max(left.pre.length, right.pre.length);
  for (let i = 0; i < preLen; i += 1) {
    const lp = left.pre[i];
    const rp = right.pre[i];
    if (lp === void 0) return -1;
    if (rp === void 0) return 1;
    const ln = Number.parseInt(lp, 10);
    const rn = Number.parseInt(rp, 10);
    const lNum = Number.isFinite(ln) && String(ln) === lp;
    const rNum = Number.isFinite(rn) && String(rn) === rp;
    if (lNum && rNum) {
      if (ln !== rn) return ln > rn ? 1 : -1;
    } else if (lp !== rp) return lp > rp ? 1 : -1;
  }
  return 0;
}
var manifestCache;
async function readManifest(path) {
  const raw = await readFile2(path, "utf8");
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) throw new Error("package.json is not an object");
  return parsed;
}
async function loadManifest(path) {
  if (path !== void 0) return readManifest(path);
  if (manifestCache === void 0) manifestCache = await readManifest(manifestPath());
  return manifestCache;
}
async function readVersionInfo(options = {}) {
  const manifest = await loadManifest(options.manifestPath);
  const current = stringField(manifest.version) ?? "0.0.0";
  const repo = parseRepository(manifest.repository);
  const repositoryUrl = repo === void 0 ? void 0 : `https://github.com/${repo.owner}/${repo.repo}`;
  return {
    current,
    ...repositoryUrl ? { repositoryUrl } : {},
    updateAvailable: false,
    checkedRemote: false
  };
}
function safeReleaseUrl(url) {
  if (url === void 0) return void 0;
  return /^https:\/\/github\.com\//i.test(url) ? url : void 0;
}
var REMOTE_CACHE_MS = 10 * 60 * 1e3;
var remoteCache;
async function checkLatestVersion(options = {}) {
  if (options.manifestPath === void 0 && options.fetchFn === void 0 && remoteCache !== void 0 && Date.now() - remoteCache.at < REMOTE_CACHE_MS) {
    return remoteCache.info;
  }
  const base = await readVersionInfo({ manifestPath: options.manifestPath });
  const repo = parseRepository((await loadManifest(options.manifestPath)).repository);
  if (repo === void 0) {
    return { ...base, checkedRemote: false, error: "repository is not configured" };
  }
  const fetchFn = options.fetchFn ?? fetch;
  try {
    const response = await fetchFn(`https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "dsh-git-panel" },
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) {
      return { ...base, checkedRemote: true, error: `GitHub responded with ${response.status}` };
    }
    const body = await response.json();
    const tag = typeof body === "object" && body !== null ? stringField(body.tag_name) : void 0;
    const htmlUrl = typeof body === "object" && body !== null ? stringField(body.html_url) : void 0;
    if (tag === void 0) {
      return { ...base, checkedRemote: true, error: "GitHub response did not include a release tag" };
    }
    const latest = tag.replace(/^v/i, "");
    const info = {
      ...base,
      checkedRemote: true,
      latest,
      updateAvailable: compareVersions(latest, base.current) > 0,
      releaseUrl: safeReleaseUrl(htmlUrl) ?? (base.repositoryUrl !== void 0 ? `${base.repositoryUrl}/releases/latest` : void 0)
    };
    if (options.manifestPath === void 0 && options.fetchFn === void 0) remoteCache = { at: Date.now(), info };
    return info;
  } catch (error) {
    return { ...base, checkedRemote: true, error: error instanceof Error ? error.message : "Unable to reach GitHub" };
  }
}

// src/host/index.ts
var _version_dec, _query_dec, _run_dec, _snapshot_dec, _a, _init;
var GitPanelService = class extends (_a = TypertRemoteService, _snapshot_dec = [Remote("snapshot")], _run_dec = [Remote("run")], _query_dec = [Remote("query")], _version_dec = [Remote("version")], _a) {
  constructor(ctx, config) {
    super(ctx, "gitPlus");
    __runInitializers(_init, 5, this);
    __publicField(this, "deps");
    __publicField(this, "config");
    __publicField(this, "rawConfig");
    this.rawConfig = config;
    this.config = normalizeConfig(config);
    this.deps = this.buildDeps(ctx, this.config);
  }
  buildDeps(ctx, config) {
    const rootCache = /* @__PURE__ */ new Map();
    const rootNegCache = /* @__PURE__ */ new Map();
    const get = (key) => ctx.get(key);
    const fs = {
      realpath,
      stat: async (p) => stat(p),
      readFile: readFile3,
      readdir: async (p) => (await readdir(p, { withFileTypes: true })).map((e) => ({ name: e.name, isDirectory: e.isDirectory() })),
      // Recursive so discarding an untracked directory removes the whole tree.
      remove: async (p) => {
        await rm(p, { force: true, recursive: true });
      },
      writeFile: async (p, content) => {
        await writeFile(p, content, "utf8");
      }
    };
    const subprocess = get("subprocess");
    const run = subprocess === void 0 ? { run: async () => {
      throw new Error("subprocess service unavailable");
    } } : createGitRunner(subprocess, config.timeoutMs, config.maxBytes);
    const sessions = get("sessions");
    const persistence = get("sessionPersistence");
    return {
      run,
      fs,
      sessions: {
        liveCwd: (id) => sessions?.get(id)?.header?.cwd,
        persistedMeta: async (id) => {
          if (persistence === void 0) return void 0;
          try {
            const snap = await persistence.stat(id);
            return snap?.header?.cwd === void 0 ? void 0 : { cwd: snap.header.cwd };
          } catch {
            return void 0;
          }
        }
      },
      rootCache,
      rootNegCache
    };
  }
  async snapshot(request, signal) {
    return snapshotForSession(this.withSignal(signal), this.liveConfig(), request.sessionId);
  }
  async run(request, signal) {
    return runAction(this.withSignal(signal), this.liveConfig(), request);
  }
  async query(request, signal) {
    return runQuery(this.withSignal(signal), this.liveConfig(), request);
  }
  async version(request) {
    try {
      return request.check === true ? await checkLatestVersion() : await readVersionInfo();
    } catch (error) {
      return { current: "0.0.0", updateAvailable: false, checkedRemote: false, error: error instanceof Error ? error.message : "version unavailable" };
    }
  }
  /** Re-read config so a live-edited volatile field (showInputPill) is current. */
  liveConfig() {
    this.config = normalizeConfig(this.rawConfig);
    return this.config;
  }
  withSignal(signal) {
    if (signal === void 0) return this.deps;
    return { ...this.deps, signal };
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "snapshot", _snapshot_dec, GitPanelService);
__decorateElement(_init, 1, "run", _run_dec, GitPanelService);
__decorateElement(_init, 1, "query", _query_dec, GitPanelService);
__decorateElement(_init, 1, "version", _version_dec, GitPanelService);
__decoratorMetadata(_init, GitPanelService);
__publicField(GitPanelService, "inject", ["subprocess", "sessions", "sessionPersistence"]);
/**
 * Config schema surfaced on the plugin detail page. `showInputPill` and
 * `defaultDiffView` are `.volatile()`, so the settings host renders them as
 * live-editable controls; the operational limits stay profile-only and out
 * of the UI form.
 */
__publicField(GitPanelService, "Config", Schema.object({
  showInputPill: Schema.boolean().default(true).volatile().description("\u663E\u793A\u8F93\u5165\u6846\u7684 Git \u5206\u652F\u6807\u8BB0"),
  defaultDiffView: Schema.union([
    Schema.const("unified").description("\u7EDF\u4E00\u89C6\u56FE\uFF08\u5355\u680F\u884C\u5185\u5BF9\u6BD4\uFF09"),
    Schema.const("split").description("\u5E76\u6392\u89C6\u56FE\uFF08\u5DE6\u53F3\u5206\u680F\u5BF9\u6BD4\uFF09")
  ]).default("unified").volatile().description("\u5DEE\u5F02\u5BF9\u6BD4\u9ED8\u8BA4\u89C6\u56FE")
}));
var index_default = GitPanelService;
export {
  DEFAULT_CONFIG,
  GitPanelService,
  checkLatestVersion,
  compareVersions,
  createGitRunner,
  index_default as default,
  detectOperation,
  extractRepoAvatars,
  isGhPathName,
  isNetworkCommand,
  isSafePath,
  normalizeConfig,
  parseBranches,
  parseGraphLog,
  parseNameStatus,
  parseRepository,
  parseStashList,
  parseStatus,
  planAction,
  readVersionInfo,
  resolveWorkspace,
  runAction,
  runQuery,
  snapshotForSession,
  sumNumstat
};
