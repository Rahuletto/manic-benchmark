import { appendFileSync, mkdirSync, readdirSync, statSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(new URL("../../", import.meta.url).pathname);
const appsDir = join(workspaceRoot, "apps");
const resultsDir = join(workspaceRoot, "benchmarks", "results");
const configPath = join(workspaceRoot, "benchmarks", "config", "framework-matrix.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
mkdirSync(resultsDir, { recursive: true });
const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const logsDir = join(resultsDir, "logs");
mkdirSync(logsDir, { recursive: true });
const runLogPath = join(logsDir, `benchmark-${runStamp}.log`);

const measuredRuns = Number(process.env.BENCH_RUNS || config.runProfiles.measuredRuns || 10);
const warmupRuns = Number(process.env.BENCH_WARMUPS || config.runProfiles.warmupRuns || 1);
const cacheProfiles = config.runProfiles.cacheProfiles || ["cold", "warm"];
const maxWorkers = Number(process.env.BENCH_WORKERS || 3);
const devReadyGraceMs = Number(process.env.BENCH_DEV_READY_GRACE_MS || 1200);
const scenarioFilter = process.env.BENCH_SCENARIO || "all";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const logLine = (message: string) => {
  const line = `[${now()}] ${message}`;
  console.log(line);
  appendFileSync(runLogPath, `${line}\n`);
};

const clearForColdRun = (appPath: string) => {
  const dirs = ["dist", "build", ".next", ".output", ".astro", ".nuxt", ".manic", ".cache"];
  for (const d of dirs) {
    const full = join(appPath, d);
    if (existsSync(full)) rmSync(full, { recursive: true, force: true });
  }
};

const runCommand = async (cwd: string, args: string[], timeoutMs = 300000, detectReady = false, env = process.env) => {
  const start = performance.now();
  logLine(`START command cwd=${cwd} cmd="${args.join(" ")}" timeoutMs=${timeoutMs}`);
  const proc = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe", env });
  const readyRegex = /(ready|localhost|listening|local:|running at|started)/i;
  let readyAt: number | null = null;
  let endedByReady = false;
  const outChunks: string[] = [];
  const errChunks: string[] = [];

  const readStream = async (reader: ReadableStreamDefaultReader<Uint8Array> | undefined, collect: string[]) => {
    if (!reader) return;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value).toString("utf8");
      collect.push(chunk);
      if (detectReady && readyAt === null && readyRegex.test(chunk)) readyAt = performance.now();
    }
  };

  const readers = [readStream(proc.stdout?.getReader(), outChunks), readStream(proc.stderr?.getReader(), errChunks)];
  const timeout = sleep(timeoutMs).then(() => "timeout");
  const exit = proc.exited.then(() => "exit");
  const ready = detectReady
    ? new Promise<string>((resolve) => {
        const timer = setInterval(() => {
          if (readyAt !== null) {
            clearInterval(timer);
            resolve("ready");
          }
        }, 50);
        const cleaner = setInterval(() => {
          if (proc.exitCode !== null) {
            clearInterval(timer);
            clearInterval(cleaner);
            resolve("exit");
          }
        }, 50);
      })
    : null;

  const race = await Promise.race(ready ? [timeout, exit, ready] : [timeout, exit]);
  if (race === "ready") {
    endedByReady = true;
    await sleep(devReadyGraceMs);
    proc.kill();
  } else if (race === "timeout") {
    proc.kill();
  }
  await Promise.allSettled(readers);

  return {
    elapsedMs: performance.now() - start,
    readyMs: readyAt ? readyAt - start : null,
    exitCode: proc.exitCode,
    timedOut: race === "timeout",
    endedByReady,
    stdout: outChunks.join("").slice(-4000),
    stderr: errChunks.join("").slice(-4000)
  };
};

const dirSize = (path: string): number => {
  if (!existsSync(path)) return 0;
  let total = 0;
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stat = statSync(full);
    total += stat.isDirectory() ? dirSize(full) : stat.size;
  }
  return total;
};

const buildOutDirs = ["dist", "build", ".next", ".output", ".astro", ".nuxt", ".manic"];
const getBuildBytes = (appPath: string) => buildOutDirs.reduce((sum, d) => sum + dirSize(join(appPath, d)), 0);

const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const median = (arr: number[]) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const stddev = (arr: number[]) => {
  if (arr.length < 2) return 0;
  const m = mean(arr) ?? 0;
  return Math.sqrt((mean(arr.map((x) => (x - m) ** 2)) ?? 0));
};
const percentile = (arr: number[], p: number) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * s.length) - 1;
  return s[Math.max(0, Math.min(s.length - 1, idx))];
};

const apps = readdirSync(appsDir)
  .map((name) => ({ name, path: join(appsDir, name) }))
  .filter((a) => statSync(a.path).isDirectory() && existsSync(join(a.path, "package.json")))
  .filter((a) => (scenarioFilter === "all" ? true : a.name.includes(scenarioFilter)))
  .sort((a, b) => a.name.localeCompare(b.name));

const rawRuns: any[] = [];
const totalRunCount = apps.length * cacheProfiles.length * (warmupRuns + measuredRuns) * 2;
let completedRuns = 0;
logLine(`Benchmark started: apps=${apps.length}, scenarioFilter=${scenarioFilter}, measuredRuns=${measuredRuns}, warmupRuns=${warmupRuns}, cacheProfiles=${cacheProfiles.join(",")}, workers=${maxWorkers}`);

const runApp = async (app: { name: string; path: string }) => {
  const pkg = JSON.parse(readFileSync(join(app.path, "package.json"), "utf8"));
  const scripts = pkg.scripts || {};
  const scenario = app.name.includes("dashboard") ? "dashboard" : "starter";
  const framework = app.name.split("-")[0];

  for (const cacheProfile of cacheProfiles) {
    for (let i = 0; i < warmupRuns + measuredRuns; i++) {
      const isWarmup = i < warmupRuns;
      logLine(`RUN app=${app.name} scenario=${scenario} cache=${cacheProfile} iteration=${i + 1}/${warmupRuns + measuredRuns} warmup=${isWarmup}`);
      if (cacheProfile === "cold") clearForColdRun(app.path);

      const benchPort = `${4200 + Math.floor(Math.random() * 1000)}`;
      const runEnv = { ...process.env, PORT: benchPort };

      if (scripts.build) {
        const res = await runCommand(app.path, ["bun", "run", "build"], 600000, false, runEnv);
        const buildStatus = res.timedOut ? "timeout" : (res.exitCode === 0 ? "ok" : "error");
        rawRuns.push({
          app: app.name, framework, scenario, phase: "build", cacheProfile,
          isWarmup, runIndex: i, elapsedMs: res.elapsedMs, readyMs: res.readyMs,
          outputBytes: getBuildBytes(app.path), exitCode: res.exitCode, timedOut: res.timedOut,
          status: buildStatus, stderrTail: res.stderr
        });
        completedRuns += 1;
        logLine(`DONE phase=build app=${app.name} status=${buildStatus} elapsedMs=${Math.round(res.elapsedMs)} progress=${completedRuns}/${totalRunCount}`);
      } else {
        rawRuns.push({ app: app.name, framework, scenario, phase: "build", cacheProfile, isWarmup, runIndex: i, status: "skipped", reason: "missing build script" });
        completedRuns += 1;
      }

      if (scripts.dev) {
        const res = await runCommand(app.path, ["bun", "run", "dev"], 45000, true, runEnv);
        const devStatus = res.timedOut ? "timeout" : ((res.endedByReady || res.exitCode === 0) ? "ok" : "error");
        rawRuns.push({
          app: app.name, framework, scenario, phase: "dev-spinup", cacheProfile,
          isWarmup, runIndex: i, elapsedMs: res.elapsedMs, readyMs: res.readyMs,
          outputBytes: null, exitCode: res.exitCode, timedOut: res.timedOut,
          status: devStatus, stderrTail: res.stderr
        });
        completedRuns += 1;
        logLine(`DONE phase=dev-spinup app=${app.name} status=${devStatus} elapsedMs=${Math.round(res.elapsedMs)} readyMs=${res.readyMs ? Math.round(res.readyMs) : "n/a"} progress=${completedRuns}/${totalRunCount}`);
      } else {
        rawRuns.push({ app: app.name, framework, scenario, phase: "dev-spinup", cacheProfile, isWarmup, runIndex: i, status: "skipped", reason: "missing dev script" });
        completedRuns += 1;
      }
    }
  }
};

const queue = [...apps];
const workers = Array.from({ length: Math.min(maxWorkers, apps.length) }, async () => {
  while (queue.length > 0) {
    const app = queue.shift();
    if (!app) return;
    await runApp(app);
  }
});
await Promise.all(workers);

const measured = rawRuns.filter((r) => !r.isWarmup && r.status !== "skipped");
const groups = new Map<string, any[]>();
for (const row of measured) {
  const key = `${row.framework}|${row.app}|${row.scenario}|${row.phase}|${row.cacheProfile}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(row);
}

const summary = [...groups.entries()].map(([k, rows]) => {
  const [framework, app, scenario, phase, cacheProfile] = k.split("|");
  const elapsed = rows.map((r) => r.elapsedMs).filter((x) => Number.isFinite(x));
  const ready = rows.map((r) => r.readyMs).filter((x) => Number.isFinite(x));
  const bytes = rows.map((r) => r.outputBytes).filter((x) => Number.isFinite(x));
  return {
    framework, app, scenario, phase, cacheProfile, runs: rows.length,
    elapsedMeanMs: Math.round(mean(elapsed) ?? 0), elapsedMedianMs: Math.round(median(elapsed) ?? 0), elapsedStdDevMs: Math.round(stddev(elapsed)),
    elapsedMinMs: elapsed.length ? Math.round(Math.min(...elapsed)) : null,
    elapsedMaxMs: elapsed.length ? Math.round(Math.max(...elapsed)) : null,
    elapsedP90Ms: elapsed.length ? Math.round(percentile(elapsed, 90) ?? 0) : null,
    elapsedP95Ms: elapsed.length ? Math.round(percentile(elapsed, 95) ?? 0) : null,
    readyMeanMs: ready.length ? Math.round(mean(ready) ?? 0) : null,
    readyP95Ms: ready.length ? Math.round(percentile(ready, 95) ?? 0) : null,
    outputBytesMean: bytes.length ? Math.round(mean(bytes) ?? 0) : null,
    outputBytesMedian: bytes.length ? Math.round(median(bytes) ?? 0) : null,
    failures: rows.filter((r) => r.status === "error").length,
    timeouts: rows.filter((r) => r.status === "timeout").length,
    successRatePct: Math.round((rows.filter((r) => r.status === "ok").length / rows.length) * 100)
  };
});

const csvHeaders = ["framework","app","scenario","phase","cacheProfile","runs","elapsedMeanMs","elapsedMedianMs","elapsedStdDevMs","elapsedMinMs","elapsedMaxMs","elapsedP90Ms","elapsedP95Ms","readyMeanMs","readyP95Ms","outputBytesMean","outputBytesMedian","failures","timeouts","successRatePct"];
const summaryCsv = [csvHeaders.join(","), ...summary.map((r) => [r.framework,r.app,r.scenario,r.phase,r.cacheProfile,r.runs,r.elapsedMeanMs??"",r.elapsedMedianMs??"",r.elapsedStdDevMs??"",r.elapsedMinMs??"",r.elapsedMaxMs??"",r.elapsedP90Ms??"",r.elapsedP95Ms??"",r.readyMeanMs??"",r.readyP95Ms??"",r.outputBytesMean??"",r.outputBytesMedian??"",r.failures,r.timeouts,r.successRatePct].join(","))].join("\n");

const rawCsvHeaders = ["framework","app","scenario","phase","cacheProfile","isWarmup","runIndex","status","elapsedMs","readyMs","outputBytes","exitCode","timedOut"];
const measuredRaw = rawRuns.filter((r) => !r.isWarmup && r.status !== "skipped");
const rawCsv = [rawCsvHeaders.join(","), ...measuredRaw.map((r) => [r.framework,r.app,r.scenario,r.phase,r.cacheProfile,r.isWarmup,r.runIndex,r.status,r.elapsedMs??"",r.readyMs??"",r.outputBytes??"",r.exitCode??"",r.timedOut??""].join(","))].join("\n");

const payload = {
  generatedAt: new Date().toISOString(),
  environment: { bunVersion: Bun.version, platform: process.platform, arch: process.arch },
  config: { measuredRuns, warmupRuns, cacheProfiles, scenarioFilter },
  note: "All values come from real command executions. Skipped/error/timeout runs are explicitly encoded.",
  rawRuns,
  summary
};

writeFileSync(join(resultsDir, "raw-runs.json"), JSON.stringify(payload, null, 2));
writeFileSync(join(resultsDir, "benchmark-summary.csv"), summaryCsv);
if (scenarioFilter === "all") writeFileSync(join(resultsDir, "benchmarks-all.csv"), rawCsv);

for (const scenarioName of ["starter", "dashboard"]) {
  const scenarioRaw = measuredRaw.filter((r) => r.scenario === scenarioName);
  const scenarioSummary = summary.filter((r) => r.scenario === scenarioName);
  if (!scenarioRaw.length && !scenarioSummary.length) continue;
  const scenarioRawCsv = [rawCsvHeaders.join(","), ...scenarioRaw.map((r) => [r.framework,r.app,r.scenario,r.phase,r.cacheProfile,r.isWarmup,r.runIndex,r.status,r.elapsedMs??"",r.readyMs??"",r.outputBytes??"",r.exitCode??"",r.timedOut??""].join(","))].join("\n");
  const scenarioSummaryCsv = [csvHeaders.join(","), ...scenarioSummary.map((r) => [r.framework,r.app,r.scenario,r.phase,r.cacheProfile,r.runs,r.elapsedMeanMs??"",r.elapsedMedianMs??"",r.elapsedStdDevMs??"",r.elapsedMinMs??"",r.elapsedMaxMs??"",r.elapsedP90Ms??"",r.elapsedP95Ms??"",r.readyMeanMs??"",r.readyP95Ms??"",r.outputBytesMean??"",r.outputBytesMedian??"",r.failures,r.timeouts,r.successRatePct].join(","))].join("\n");
  writeFileSync(join(resultsDir, `benchmarks-${scenarioName}.csv`), scenarioRawCsv);
  writeFileSync(join(resultsDir, `summary-${scenarioName}.csv`), scenarioSummaryCsv);
}

logLine(`Artifacts written: raw-runs.json, benchmark-summary.csv, scenario CSVs${scenarioFilter === "all" ? ", benchmarks-all.csv" : ""}, runLog=${runLogPath}`);
console.log(`Saved ${rawRuns.length} raw rows and ${summary.length} summary rows.`);
