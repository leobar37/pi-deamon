#!/usr/bin/env bun
/**
 * pi-dev: run this fork of pi in development mode from any directory,
 * loading the vendored extensions from packages/extensions.
 */

import { realpathSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = realpathSync(join(import.meta.dirname, ".."));
const CLI_ENTRY = join(REPO_ROOT, "packages", "coding-agent", "src", "cli.ts");
const SUBAGENTS_DIR = join(REPO_ROOT, "packages", "subagents");
const SUBAGENTS_FRONTEND_DIR = join(SUBAGENTS_DIR, "frontend");
const EXT_DIR = join(REPO_ROOT, "packages", "extensions");

const args = process.argv.slice(2);

// Build subagents first because extensions keep @local/pi-subagents external.
const subagentsFrontendBuildProc = Bun.spawnSync(["bun", "run", "build"], {
  cwd: SUBAGENTS_FRONTEND_DIR,
  stdio: ["inherit", "inherit", "inherit"],
});
if (subagentsFrontendBuildProc.exitCode !== 0) {
  process.exit(subagentsFrontendBuildProc.exitCode ?? 1);
}

const subagentsBuildProc = Bun.spawnSync(["bun", "run", "build"], {
  cwd: SUBAGENTS_DIR,
  stdio: ["inherit", "inherit", "inherit"],
});
if (subagentsBuildProc.exitCode !== 0) {
  process.exit(subagentsBuildProc.exitCode ?? 1);
}

// Build extensions so external dependencies are bundled and imports resolve.
const buildProc = Bun.spawnSync(["bun", "run", "build"], {
  cwd: EXT_DIR,
  stdio: ["inherit", "inherit", "inherit"],
});
if (buildProc.exitCode !== 0) {
  process.exit(buildProc.exitCode ?? 1);
}

const extensionFlag = "-e";
const extensionPath = EXT_DIR;

// Prepend the extension path so user args still win for duplicates
const bunArgs = ["run", CLI_ENTRY, extensionFlag, extensionPath, ...args];

const proc = Bun.spawnSync(["bun", ...bunArgs], {
  stdio: ["inherit", "inherit", "inherit"],
  env: process.env,
});

process.exit(proc.exitCode ?? 0);
