import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../../bin/axios-scaffold-kit.js", import.meta.url));
// Keep test hooks on Node 22 while checking CLI and generated syntax on the selected runtime.
export const CLI_NODE_BINARY = process.env.CLI_NODE_BINARY ?? process.execPath;

const FAKE_NPM_SOURCE = `
const fs = require("node:fs");
const path = require("node:path");
const cwd = process.cwd();
fs.writeFileSync(process.env.FAKE_NPM_CALL, JSON.stringify({
  args: process.argv.slice(2),
  cwd,
  outputExists: fs.existsSync(path.join(cwd, "src/api")),
}));
if (process.env.FAKE_NPM_MODE === "signal") {
  process.kill(process.pid, "SIGTERM");
} else {
  const manifestPath = path.join(cwd, "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.dependencies = { ...manifest.dependencies, axios: process.argv[3].slice(6) };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(path.join(cwd, "package-lock.json"), "fixture lockfile");
  if (process.env.FAKE_NPM_MODE === "fail") {
    process.exitCode = 7;
  }
  if (process.env.FAKE_NPM_MODE === "generation-failure") {
    fs.mkdirSync(path.join(cwd, "src/api"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "src/api/exampleApi.js"), "created during installation");
  }
}
`;

/** Create an isolated project and fake npm executable; no routine test reaches a registry. */
export async function createProject(t, manifest = '{"name":"test-app","type":"module"}\n') {
  const root = await mkdtemp(join(tmpdir(), "axios-scaffold-kit-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, "project with spaces");
  const bin = join(root, "bin");
  await mkdir(directory);
  await mkdir(bin);
  await writeFile(join(bin, "fake-npm.cjs"), FAKE_NPM_SOURCE);
  await writeFile(join(bin, "npm"), '#!/bin/sh\nexec "$FAKE_NPM_NODE" "$FAKE_NPM_SCRIPT" "$@"\n', {
    mode: 0o755,
  });
  await writeFile(join(bin, "npm.cmd"), '@echo off\r\n"%FAKE_NPM_NODE%" "%FAKE_NPM_SCRIPT%" %*\r\n');

  if (manifest !== undefined && manifest !== null) {
    await writeFile(join(directory, "package.json"), manifest);
  }

  return realpath(directory);
}

export function runCli(directory, args = ["init"], environment = {}) {
  const bin = join(directory, "..", "bin");
  return spawnSync(CLI_NODE_BINARY, [CLI_PATH, ...args], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_NPM_NODE: process.execPath,
      FAKE_NPM_SCRIPT: join(bin, "fake-npm.cjs"),
      FAKE_NPM_CALL: join(directory, "..", "npm-call.json"),
      FAKE_NPM_MODE: "success",
      ...environment,
    },
  });
}

export async function readNpmCall(directory) {
  return JSON.parse(await readFile(join(directory, "..", "npm-call.json"), "utf8"));
}
