#!/usr/bin/env node
/**
 * Design-token drift guard — per audit T-06.
 *
 * Scans the web app surface that pages and layouts live in for raw hex
 * colour literals and inline `var(--*)` strings. Both bypass the
 * `tokens.color.*` single-source-of-truth in `ds/tokens.ts` and tend to
 * drift the moment tokens.css gets a theme change. Exits non-zero on any
 * match so this can gate CI later.
 *
 * Scope: apps/web/src/pages, apps/web/src/app. The DS primitives in
 * apps/web/src/ds are exempt — they're the legitimate home for raw values,
 * with tokens.ts as the JS mirror.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOTS = ['apps/web/src/pages', 'apps/web/src/app'];
const EXTS = new Set(['.tsx', '.ts']);
const HEX_RE = /#[0-9a-fA-F]{6}\b/g;
const VAR_RE = /var\(--[a-z][a-z0-9-]*\)/g;

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (EXTS.has(full.slice(full.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

const findings = [];
for (const root of ROOTS) {
  let files;
  try {
    files = await walk(root);
  } catch {
    continue;
  }
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    src.split('\n').forEach((line, idx) => {
      const hex = line.match(HEX_RE);
      const cv = line.match(VAR_RE);
      if (hex || cv) {
        findings.push({ file, line: idx + 1, text: line.trim(), hex, cv });
      }
    });
  }
}

if (findings.length === 0) {
  console.log('design-token lint: clean');
  process.exit(0);
}

for (const f of findings) {
  const tag = [
    f.hex ? `hex:${f.hex.join(',')}` : null,
    f.cv ? `var:${f.cv.join(',')}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  console.error(`${f.file}:${f.line}  [${tag}]  ${f.text}`);
}
console.error(`\n${findings.length} finding(s). Route colour through tokens.color.*; add new tokens to tokens.css first.`);
process.exit(1);
