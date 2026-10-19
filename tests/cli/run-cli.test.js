import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_OUTPUT_DIRECTORY, DEFAULT_TIMEOUT_MS } from "../../src/config/defaults.js";

const CLI_PATH = fileURLToPath(new URL("../../bin/axios-scaffold-kit.js", import.meta.url));

async function createProject(t, manifest = '{"name":"test-app","type":"module"}\n') {
  const directory = await mkdtemp(join(tmpdir(), "axios-scaffold-kit-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  if (manifest !== undefined && manifest !== null) {
    await writeFile(join(directory, "package.json"), manifest);
  }

  return directory;
}

function runCli(directory, args = ["init"]) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: directory,
    encoding: "utf8",
  });
}

test("generates executable JavaScript syntax and preserves project data", async (t) => {
  const manifest = '{"name":"existing-app","dependencies":{"axios":"^1.0.0"},"type":"module"}\n';
  const directory = await createProject(t, manifest);
  await writeFile(join(directory, "notes.txt"), "keep this");

  const result = runCli(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created src[\\/]api[\\/]apiClient\.js/);
  assert.match(result.stdout, /npm install axios/);
  assert.match(result.stdout, /Axios was not installed/);
  assert.equal(await readFile(join(directory, "package.json"), "utf8"), manifest);
  assert.equal(await readFile(join(directory, "notes.txt"), "utf8"), "keep this");
  assert.deepEqual((await readdir(directory)).sort(), ["notes.txt", "package.json", "src"]);

  const output = join(directory, DEFAULT_OUTPUT_DIRECTORY);
  assert.deepEqual((await readdir(output)).sort(), ["apiClient.js", "exampleApi.js"]);
  const client = await readFile(join(output, "apiClient.js"), "utf8");
  assert.ok(client.includes(`timeout: ${DEFAULT_TIMEOUT_MS}`));
  assert.ok(!client.includes("__DEFAULT_TIMEOUT_MS__"));

  for (const filename of ["apiClient.js", "exampleApi.js"]) {
    const syntax = spawnSync(process.execPath, ["--check", join(output, filename)], {
      encoding: "utf8",
    });
    assert.equal(syntax.status, 0, syntax.stderr);
  }
});

test("requires a readable package.json in the current directory", async (t) => {
  const directory = await createProject(t, null);
  const result = runCli(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot read .*package\.json/);
  assert.deepEqual(await readdir(directory), []);
});

for (const manifest of ["{invalid", "null", "[]", '"string"']) {
  test(`rejects an invalid project manifest: ${manifest}`, async (t) => {
    const directory = await createProject(t, manifest);
    const result = runCli(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid JSON|must contain a JSON object/);
    assert.deepEqual(await readdir(directory), ["package.json"]);
  });
}

for (const filename of ["apiClient.js", "exampleApi.js"]) {
  test(`stops before writing either file when ${filename} exists`, async (t) => {
    const directory = await createProject(t);
    const output = join(directory, DEFAULT_OUTPUT_DIRECTORY);
    await mkdir(output, { recursive: true });
    await writeFile(join(output, filename), "existing user code");
    await writeFile(join(output, "unrelated.js"), "unrelated user code");

    const result = runCli(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing to overwrite/);
    assert.equal(await readFile(join(output, filename), "utf8"), "existing user code");
    assert.deepEqual((await readdir(output)).sort(), [filename, "unrelated.js"].sort());
  });
}

test("treats a dangling destination symlink as a conflict", async (t) => {
  const directory = await createProject(t);
  const output = join(directory, DEFAULT_OUTPUT_DIRECTORY);
  await mkdir(output, { recursive: true });
  await symlink(join(directory, "missing.js"), join(output, "exampleApi.js"));
  const result = runCli(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to overwrite/);
  assert.deepEqual(await readdir(output), ["exampleApi.js"]);
});

test("reports an unusable output path without overwriting it", async (t) => {
  const directory = await createProject(t);
  await writeFile(join(directory, "src"), "existing file");
  const result = runCli(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot inspect|Could not finish generation/);
  assert.equal(await readFile(join(directory, "src"), "utf8"), "existing file");
  assert.doesNotMatch(result.stdout, /Created/);
});

for (const args of [[], ["--help"]]) {
  test(`shows help without requiring a project: ${JSON.stringify(args)}`, async (t) => {
    const directory = await createProject(t, null);
    const result = runCli(directory, args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: axios-scaffold-kit init/);
    assert.deepEqual(await readdir(directory), []);
  });
}

for (const args of [["unknown"], ["init", "--typescript"], ["--help", "init"]]) {
  test(`rejects unsupported arguments: ${args.join(" ")}`, async (t) => {
    const directory = await createProject(t);
    const result = runCli(directory, args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unsupported command or arguments/);
    assert.deepEqual(await readdir(directory), ["package.json"]);
  });
}
