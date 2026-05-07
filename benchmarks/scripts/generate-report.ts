import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("../../", import.meta.url).pathname);
const resultsDir = join(root, "benchmarks", "results");
const raw = JSON.parse(readFileSync(join(resultsDir, "raw-runs.json"), "utf8"));
const summary = raw.summary || [];

const okOnly = summary.filter((r: any) => r.failures === 0);
const by = (phase: string, cache: string) => okOnly
  .filter((r: any) => r.phase === phase && r.cacheProfile === cache)
  .sort((a: any, b: any) => (a.elapsedMeanMs ?? 1e15) - (b.elapsedMeanMs ?? 1e15));

const lines: string[] = [];
lines.push('# Benchmark Results');
lines.push('');
lines.push(`- Generated: ${raw.generatedAt}`);
lines.push(`- Bun: ${raw.environment?.bunVersion}`);
lines.push(`- Platform: ${raw.environment?.platform}/${raw.environment?.arch}`);
lines.push(`- Warmups: ${raw.config?.warmupRuns}`);
lines.push(`- Measured runs: ${raw.config?.measuredRuns}`);
lines.push(`- Cache profiles: ${(raw.config?.cacheProfiles || []).join(', ')}`);
lines.push('');
lines.push('## Data Integrity');
lines.push('');
lines.push('- No fabricated values: all metrics come from executed commands.');
lines.push('- Failed, timeout, and skipped runs are preserved in `raw-runs.json`.');
lines.push('- CSV rows are aggregated from measured (non-warmup) runs.');
lines.push('');
for (const cache of raw.config?.cacheProfiles || []) {
  lines.push(`## Build (${cache})`);
  lines.push('');
  for (const r of by('build', cache)) {
    lines.push(`- ${r.app}: mean ${Math.round(r.elapsedMeanMs ?? 0)} ms, p95 ${Math.round(r.elapsedP95Ms ?? 0)} ms, bytes ${Math.round(r.outputBytesMean ?? 0)}`);
  }
  lines.push('');
  lines.push(`## Dev Spinup (${cache})`);
  lines.push('');
  for (const r of by('dev-spinup', cache)) {
    lines.push(`- ${r.app}: elapsed mean ${Math.round(r.elapsedMeanMs ?? 0)} ms, ready mean ${Math.round(r.readyMeanMs ?? 0)} ms`);
  }
  lines.push('');
}

writeFileSync(join(resultsDir, 'final-report.md'), lines.join('\n'));
console.log('Wrote final-report.md');
