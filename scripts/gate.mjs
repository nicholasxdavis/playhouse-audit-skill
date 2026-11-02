#!/usr/bin/env node
/**
 * Playhouse deploy gate: copy lint → optional asset compress → Lighthouse audit.
 * Exit codes: 0 pass | 1 runner/tool error | 2 bad args | 3 scores short | 4 copy fail
 *
 * Examples:
 *   node gate.mjs --cwd ../tako-main --runs 3
 *   node gate.mjs --url https://example.com --skip-compress
 *   node gate.mjs --cwd . --copy-only
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (res.error) {
    console.error(res.error.message);
    return 1;
  }
  return res.status ?? 1;
}

function pythonCmd() {
  const candidates = [
    ['py', '-3'],
    ['python3'],
    ['python'],
  ];
  for (const argv of candidates) {
    const probe = spawnSync(argv[0], [...argv.slice(1), '--version'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if ((probe.status ?? 1) === 0) return argv;
  }
  return null;
}

function detectAssetDirs(cwd) {
  const candidates = [
    'public',
    'src/assets',
    'assets',
    'static',
    'dist',
    'out',
    'build',
  ];
  return candidates
    .map((rel) => path.resolve(cwd, rel))
    .filter((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
}

function main() {
  const { values } = parseArgs({
    options: {
      cwd: { type: 'string', default: process.cwd() },
      url: { type: 'string' },
      dir: { type: 'string' },
      runs: { type: 'string', default: '3' },
      form: { type: 'string', default: 'both' },
      out: { type: 'string', default: '.playhouse-audit' },
      port: { type: 'string', default: '4173' },
      'max-emoji': { type: 'string', default: '0' },
      'skip-compress': { type: 'boolean', default: false },
      'skip-copy': { type: 'boolean', default: false },
      'skip-audit': { type: 'boolean', default: false },
      'copy-only': { type: 'boolean', default: false },
      'compress-only': { type: 'boolean', default: false },
      'assets': { type: 'string' },
    },
    allowPositionals: false,
  });

  const cwd = path.resolve(values.cwd);
  const py = pythonCmd();
  if (!py && (!values['skip-copy'] || !values['skip-compress'])) {
    console.error('Python required for copy/compress gates. Install Python 3.');
    process.exit(1);
  }

  if (!values['skip-copy']) {
    console.log('\n== Playhouse copy gate ==');
    const code = run(py[0], [
      ...py.slice(1),
      path.join(__dirname, 'check_copy.py'),
      '--cwd',
      cwd,
      '--max-emoji',
      String(values['max-emoji']),
    ]);
    if (code !== 0) process.exit(code === 2 ? 2 : 4);
  }

  if (values['copy-only']) {
    console.log('\nCopy-only gate passed.');
    process.exit(0);
  }

  if (!values['skip-compress']) {
    const assetDirs = values.assets
      ? [path.resolve(cwd, values.assets)]
      : detectAssetDirs(cwd);
    if (assetDirs.length) {
      console.log('\n== Playhouse asset compress ==');
      for (const dir of assetDirs) {
        const code = run(py[0], [
          ...py.slice(1),
          path.join(__dirname, 'compress_assets.py'),
          dir,
        ]);
        if (code !== 0) process.exit(code);
      }
    } else {
      console.log('\n== Playhouse asset compress ==\nNo asset directories found; skipped.');
    }
  }

  if (values['compress-only']) {
    console.log('\nCompress-only gate passed.');
    process.exit(0);
  }

  if (values['skip-audit']) {
    console.log('\nAudit skipped.');
    process.exit(0);
  }

  console.log('\n== Playhouse Lighthouse audit ==');
  const auditArgs = [
    path.join(__dirname, 'audit.mjs'),
    '--cwd',
    cwd,
    '--runs',
    String(values.runs),
    '--form',
    values.form,
    '--out',
    values.out,
    '--port',
    values.port,
  ];
  if (values.url) auditArgs.push('--url', values.url);
  if (values.dir) auditArgs.push('--dir', values.dir);

  const auditCode = run(process.execPath, auditArgs, { shell: false });
  process.exit(auditCode);
}

main();
