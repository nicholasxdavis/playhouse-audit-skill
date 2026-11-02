#!/usr/bin/env node
/**
 * Playhouse audit runner
 * - Audits a live URL, or serves a local production build with gzip
 * - Mobile + desktop
 * - Optional median of N runs (default 3) to tame Performance variance
 * - Compact JSON summary: category scores + failing audits
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const BUILD_CANDIDATES = ['dist', 'out', 'build', 'public'];

function score100(score) {
  if (score == null) return null;
  return Math.round(score * 100);
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function detectBuildDir(cwd) {
  for (const candidate of BUILD_CANDIDATES) {
    const full = path.resolve(cwd, candidate);
    if (fs.existsSync(path.join(full, 'index.html'))) return full;
  }
  return null;
}

function startGzipServer(serveDir, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (reqPath === '/' || reqPath.endsWith('/')) reqPath += 'index.html';

      let filePath = path.join(serveDir, reqPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(serveDir, 'index.html');
      }
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const compressible = !['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.woff', '.woff2'].includes(ext);
      const raw = fs.createReadStream(filePath);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      raw.on('error', () => {
        res.writeHead(500);
        res.end('Read error');
      });

      if (compressible && /\bgzip\b/.test(acceptEncoding)) {
        res.writeHead(200, { 'Content-Encoding': 'gzip' });
        raw.pipe(zlib.createGzip()).pipe(res);
      } else {
        res.writeHead(200);
        raw.pipe(res);
      }
    });

    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

function failingAudits(lhr, limit = 25) {
  return Object.values(lhr.audits)
    .filter(
      (a) =>
        a.score !== null &&
        a.score < 1 &&
        a.scoreDisplayMode !== 'notApplicable' &&
        a.scoreDisplayMode !== 'informative'
    )
    .map((a) => ({
      id: a.id,
      title: a.title,
      score: score100(a.score),
      displayValue: a.displayValue || null,
      description: (a.description || '').replace(/<[^>]+>/g, '').slice(0, 220),
    }))
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, limit);
}

function vitals(lhr) {
  const pick = (id) => {
    const a = lhr.audits[id];
    if (!a) return null;
    return {
      id,
      displayValue: a.displayValue || null,
      numericValue: a.numericValue ?? null,
      score: score100(a.score),
    };
  };
  return {
    lcp: pick('largest-contentful-paint'),
    cls: pick('cumulative-layout-shift'),
    tbt: pick('total-blocking-time'),
    fcp: pick('first-contentful-paint'),
    si: pick('speed-index'),
    ttfb: pick('server-response-time'),
  };
}

function categoryScores(lhr) {
  return {
    performance: score100(lhr.categories.performance?.score),
    accessibility: score100(lhr.categories.accessibility?.score),
    bestPractices: score100(lhr.categories['best-practices']?.score),
    seo: score100(lhr.categories.seo?.score),
  };
}

async function runOnce(lighthouse, url, chromePort, formFactor) {
  const isMobile = formFactor === 'mobile';
  const flags = {
    port: chromePort,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor,
    screenEmulation: isMobile
      ? { disabled: false, width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
      : { disabled: false, width: 1350, height: 940, deviceScaleFactor: 1, mobile: false },
    throttling: isMobile
      ? { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 }
      : { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
  };

  const result = await lighthouse(url, flags);
  return result.lhr;
}

function medianSummary(runs) {
  const keys = ['performance', 'accessibility', 'bestPractices', 'seo'];
  const med = {};
  for (const k of keys) {
    med[k] = Math.round(median(runs.map((r) => r.scores[k] ?? 0)));
  }
  // Prefer the run whose performance is closest to the median for audit detail
  const targetPerf = med.performance;
  let best = runs[0];
  let bestDist = Infinity;
  for (const r of runs) {
    const d = Math.abs((r.scores.performance ?? 0) - targetPerf);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return {
    scores: med,
    vitals: best.vitals,
    failing: best.failing,
    representativeRun: best.index,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      dir: { type: 'string' },
      port: { type: 'string', default: '4173' },
      runs: { type: 'string', default: '3' },
      form: { type: 'string', default: 'both' }, // mobile | desktop | both
      out: { type: 'string', default: '.playhouse-audit' },
      cwd: { type: 'string', default: process.cwd() },
      'keep-lhr': { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  const cwd = path.resolve(values.cwd);
  const outDir = path.resolve(cwd, values.out);
  const runsN = Math.max(1, Number(values.runs) || 3);
  const port = Number(values.port) || 4173;
  const keepLhr = Boolean(values['keep-lhr']);
  const forms =
    values.form === 'both'
      ? ['desktop', 'mobile']
      : values.form === 'mobile' || values.form === 'desktop'
        ? [values.form]
        : ['desktop', 'mobile'];

  let targetUrl = values.url || null;
  let server = null;
  let serveDir = null;

  if (!targetUrl) {
    serveDir = values.dir
      ? path.resolve(cwd, values.dir)
      : detectBuildDir(cwd);
    if (!serveDir || !fs.existsSync(path.join(serveDir, 'index.html'))) {
      console.error(
        'No URL and no production build with index.html found. Pass --url or build first (dist/out/build).'
      );
      process.exit(2);
    }
    server = await startGzipServer(serveDir, port);
    targetUrl = `http://127.0.0.1:${port}/`;
  }

  let chromeLauncher;
  let lighthouse;
  try {
    chromeLauncher = await import('chrome-launcher');
    const mod = await import('lighthouse');
    lighthouse = mod.default || mod;
  } catch {
    console.error(
      'Missing deps. From playhouse-audit/scripts run: npm install'
    );
    if (server) server.close();
    process.exit(1);
  }

  // Lean by default: wipe prior audit junk so only the new summary remains.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--disable-gpu', '--no-sandbox'],
  });

  const report = {
    url: targetUrl,
    servedFrom: serveDir,
    generatedAt: new Date().toISOString(),
    runsRequested: runsN,
    forms: {},
  };

  try {
    for (const formFactor of forms) {
      const runResults = [];
      for (let i = 0; i < runsN; i++) {
        process.stderr.write(`Auditing ${formFactor} run ${i + 1}/${runsN}...\n`);
        const lhr = await runOnce(lighthouse, targetUrl, chrome.port, formFactor);
        const scores = categoryScores(lhr);
        const entry = {
          index: i + 1,
          scores,
          vitals: vitals(lhr),
          failing: failingAudits(lhr),
        };
        runResults.push(entry);
        if (keepLhr) {
          fs.writeFileSync(
            path.join(outDir, `lhr-${formFactor}-run${i + 1}.json`),
            JSON.stringify(lhr)
          );
        }
      }

      const summary = medianSummary(runResults);
      report.forms[formFactor] = {
        runs: runResults.map((r) => r.scores),
        median: summary.scores,
        vitals: summary.vitals,
        failing: summary.failing,
      };

      console.log(`\n[${formFactor.toUpperCase()}] median of ${runsN}`);
      console.log(
        `  Performance ${summary.scores.performance} | Accessibility ${summary.scores.accessibility} | Best Practices ${summary.scores.bestPractices} | SEO ${summary.scores.seo}`
      );
      if (summary.failing.length) {
        console.log('  Top failing audits:');
        for (const f of summary.failing.slice(0, 10)) {
          console.log(`    - [${f.id}] ${f.title}${f.displayValue ? ` (${f.displayValue})` : ''}`);
        }
      }
    }
  } finally {
    await chrome.kill();
    if (server) server.close();
  }

  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${summaryPath}`);

  const allHundred = forms.every((f) => {
    const s = report.forms[f].median;
    return (
      s.performance === 100 &&
      s.accessibility === 100 &&
      s.bestPractices === 100 &&
      s.seo === 100
    );
  });
  process.exit(allHundred ? 0 : 3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
