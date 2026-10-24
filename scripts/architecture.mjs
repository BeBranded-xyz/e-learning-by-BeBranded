import path from "node:path";
import { isBuiltin } from "node:module";
import ts from "typescript";

const allowed = {
  core: [],
  db: ["core"],
  video: ["core"],
  editor: ["core"],
  react: ["core"],
  server: ["core", "editor"],
  export: ["core", "editor"],
  admin: ["core", "editor", "react"],
  next: ["server"],
};
const packageOf = (file) => /^packages\/([^/]+)\//.exec(file)?.[1];
const serverPackage = /^(db|server|video|export|next)$/;

function typeOnlyImport(clause) {
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  const named = clause.namedBindings;
  return Boolean(
    !clause.name &&
    named &&
    ts.isNamedImports(named) &&
    named.elements.length > 0 &&
    named.elements.every((item) => item.isTypeOnly),
  );
}

function forbiddenClientImport({ specifier, target }) {
  if (specifier === null || isBuiltin(specifier) || specifier === "server-only") return true;
  return (
    serverPackage.test(target.owner ?? "") || target.file?.startsWith("packages/editor/src/server/")
  );
}

function manifestErrors(manifests) {
  const errors = [];
  for (const [name, manifest] of Object.entries(manifests)) {
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      const target = dependency.replace("@bebranded/elearning-", "");
      if (dependency.startsWith("@bebranded/elearning-") && !allowed[name]?.includes(target))
        errors.push(`${name}/package.json: forbidden dependency on ${target}`);
    }
  }
  return errors;
}

function imports(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const result = [];
  const add = (specifier, typeOnly = false) => {
    result.push({ specifier: ts.isStringLiteral(specifier) ? specifier.text : null, typeOnly });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      add(node.moduleSpecifier, typeOnlyImport(node.importClause));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      add(node.moduleSpecifier, node.isTypeOnly);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === "require")
    ) {
      if (node.arguments[0]) add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

function targetFor(file, specifier, manifests, files) {
  const match = /^@bebranded\/elearning-([^/]+)(.*)$/.exec(specifier);
  if (match) {
    const [, name, subpath] = match;
    const entry = manifests[name]?.exports[subpath ? `.${subpath}` : "."];
    const source = typeof entry === "object" ? entry["@bebranded/source"] : undefined;
    return {
      owner: name,
      public: entry !== undefined,
      file: source ? path.posix.join("packages", name, source) : undefined,
    };
  }
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return {};
  const base = specifier.startsWith("@/")
    ? `apps/demo/${specifier.slice(2)}`
    : path.posix.join(path.posix.dirname(file), specifier);
  const stem = base.replace(/\.js$/, "");
  const resolved = [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}/index.ts`,
    `${stem}/index.tsx`,
  ].find((candidate) => files.has(candidate));
  return { file: resolved, owner: packageOf(base), relative: true };
}

function coreImportErrors(file, edges) {
  if (packageOf(file) !== "core") return [];
  return edges
    .filter(
      ({ specifier }) =>
        specifier !== null &&
        !specifier.startsWith(".") &&
        specifier !== "zod" &&
        !specifier.startsWith("@bebranded/elearning-core"),
    )
    .map(({ specifier }) => `${file}: core must stay framework-independent (${specifier})`);
}

function clientEntry(file, text) {
  if (/^packages\/(react|admin)\/src\/index\.ts$/.test(file)) return true;
  const first = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true).statements[0];
  return (
    first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "use client"
  );
}

function boundaryErrors(file, edges, manifests) {
  const owner = packageOf(file);
  const errors = [];
  for (const edge of edges) {
    const { target, specifier } = edge;
    if (target.public === false)
      errors.push(`${file}: private or unknown package entry ${specifier}`);
    if (!owner || !target.owner || owner === target.owner) continue;
    if (target.relative) errors.push(`${file}: cross-package relative import ${specifier}`);
    if (!allowed[owner].includes(target.owner))
      errors.push(`${file}: forbidden dependency on ${target.owner}`);
    if (!Object.hasOwn(manifests[owner].dependencies ?? {}, `@bebranded/elearning-${target.owner}`))
      errors.push(`${file}: undeclared dependency on ${target.owner}`);
  }
  return errors;
}

function clientErrors(root, graph) {
  const errors = [];
  const visited = new Set();
  const walk = (file) => {
    if (visited.has(file)) return;
    visited.add(file);
    for (const edge of graph.get(file) ?? []) {
      if (edge.typeOnly) continue;
      const { specifier, target } = edge;
      if (forbiddenClientImport(edge))
        errors.push(`${root}: client reaches ${specifier ?? "a computed import"} through ${file}`);
      else if (target.file) walk(target.file);
    }
  };
  walk(root);
  return errors;
}

/** Static workspace graph; third-party internals are intentionally outside this check. */
export function checkArchitecture(files, manifests) {
  const graph = new Map();
  const errors = [];
  for (const [file, text] of files) {
    const edges = imports(file, text).map((edge) => ({
      ...edge,
      target: edge.specifier === null ? {} : targetFor(file, edge.specifier, manifests, files),
    }));
    graph.set(file, edges);
    errors.push(...boundaryErrors(file, edges, manifests), ...coreImportErrors(file, edges));
  }
  errors.push(...manifestErrors(manifests));
  for (const [file, text] of files) {
    if (clientEntry(file, text)) errors.push(...clientErrors(file, graph));
  }
  return [...new Set(errors)];
}
