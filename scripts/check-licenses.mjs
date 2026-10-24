#!/usr/bin/env node
// License allowlist check (core/dependencies.mdc).
// Usage: pnpm licenses list --json | node scripts/check-licenses.mjs
// Exit 1 when any production dependency uses a license outside the allowlist.
// SPDX expressions are evaluated: OR needs one allowed option, AND needs every
// license allowed, AND binds tighter than OR, and malformed expressions fail.
// Extend ALLOWED or EXCEPTIONS in the project; every exception needs a reason.

import { readFileSync } from "node:fs";

const ALLOWED = new Set([
  "MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD",
  "CC0-1.0", "Unlicense", "MPL-2.0", "Python-2.0", "BlueOak-1.0.0", "CC-BY-4.0",
]);

// Package name -> reason. Keep this list short and reviewed.
const EXCEPTIONS = new Map([
  // ["some-package", "Vendor-approved commercial license, contract #123"],
  ["pako", "MIT AND Zlib: zlib port used by jszip (docx export); Zlib is permissive, notice-only (PROJECT.md)"],
]);

function tokenize(expression) {
  return expression.match(/\(|\)|[^\s()]+/g) ?? [];
}

// Grammar: or := and ("OR" and)* ; and := atom ("AND" atom)* ; atom := id | "(" or ")"
// "WITH" exceptions are kept as part of the license id, so they are never allowlisted.
function isAllowed(expression) {
  const tokens = tokenize(expression);
  let position = 0;
  const peekOperator = () => tokens[position]?.toUpperCase();
  const parseAtom = () => {
    const token = tokens[position++];
    if (token === undefined || token === ")" || ["AND", "OR"].includes(token.toUpperCase())) {
      throw new Error(`unexpected token "${token ?? "end of expression"}"`);
    }
    if (token === "(") {
      const value = parseOr();
      if (tokens[position++] !== ")") throw new Error("missing closing parenthesis");
      return value;
    }
    let id = token;
    while (peekOperator() === "WITH") {
      id += ` WITH ${tokens[position + 1] ?? ""}`;
      position += 2;
    }
    return ALLOWED.has(id);
  };
  const parseAnd = () => {
    let value = parseAtom();
    while (peekOperator() === "AND") {
      position++;
      value = parseAtom() && value;
    }
    return value;
  };
  const parseOr = () => {
    let value = parseAnd();
    while (peekOperator() === "OR") {
      position++;
      value = parseAnd() || value;
    }
    return value;
  };
  const value = parseOr();
  if (position !== tokens.length) throw new Error(`unexpected token "${tokens[position]}"`);
  return value;
}

function evaluate(expression) {
  try {
    return { allowed: isAllowed(expression) };
  } catch (error) {
    return { allowed: false, reason: `unparseable license expression: ${error.message}` };
  }
}

const raw = readFileSync(0, "utf8").trim();
if (!raw) {
  console.error("check-licenses: no input on stdin");
  process.exit(1);
}

// pnpm outputs { "<license>": [ { name, versions, ... }, ... ] }
const byLicense = JSON.parse(raw);
const violations = [];
for (const [license, packages] of Object.entries(byLicense)) {
  const { allowed, reason } = evaluate(license);
  if (allowed) continue;
  for (const pkg of packages) {
    if (EXCEPTIONS.has(pkg.name)) continue;
    const detail = reason ? ` (${reason})` : "";
    violations.push(`${pkg.name}@${(pkg.versions ?? []).join(",")} -> ${license || "<empty>"}${detail}`);
  }
}

if (violations.length > 0) {
  console.error("Disallowed licenses found:\n  " + violations.join("\n  "));
  console.error("\nAdd to ALLOWED (with team approval) or to EXCEPTIONS with a reason.");
  process.exit(1);
}
console.log(`check-licenses: ${Object.keys(byLicense).length} license type(s) checked, all allowed.`);
