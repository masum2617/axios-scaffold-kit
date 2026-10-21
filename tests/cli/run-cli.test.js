import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_OUTPUT_DIRECTORY, DEFAULT_TIMEOUT_MS } from "../../src/config/defaults.js";
import { CLI_NODE_BINARY, createProject, runCli } from "../helpers/project-fixture.js";

test("generates executable JavaScript syntax and preserves project data", async (t) => {
  const manifest = '{"name":"existing-app","dependencies":{"axios":"^1.0.0"},"type":"module"}\n';
  const directory = await createProject(t, manifest);
  await writeFile(join(directory, "notes.txt"), "keep this");

  const result = runCli(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created src[\\/]api[\\/]apiClient\.js/);
  assert.match(result.stdout, /Axios already declared; preserving it/);
  assert.doesNotMatch(result.stdout, /Installing Axios/);
  assert.equal(await readFile(join(directory, "package.json"), "utf8"), manifest);
  assert.equal(await readFile(join(directory, "notes.txt"), "utf8"), "keep this");
  assert.deepEqual((await readdir(directory)).sort(), ["notes.txt", "package.json", "src"]);

  const output = join(directory, DEFAULT_OUTPUT_DIRECTORY);
  assert.deepEqual((await readdir(output)).sort(), ["apiClient.js", "auth", "exampleApi.js"]);
  assert.deepEqual((await readdir(join(output, "auth"))).sort(), ["attachAuthInterceptors.js", "authConfig.js"]);
  const client = await readFile(join(output, "apiClient.js"), "utf8");
  assert.ok(client.includes(`timeout: ${DEFAULT_TIMEOUT_MS}`));
  assert.ok(!client.includes("__DEFAULT_TIMEOUT_MS__"));

  for (const filename of ["apiClient.js", "exampleApi.js", "auth/authConfig.js", "auth/attachAuthInterceptors.js"]) {
    const syntax = spawnSync(CLI_NODE_BINARY, ["--check", join(output, filename)], {
      encoding: "utf8",
    });
    assert.equal(syntax.status, 0, syntax.stderr);
  }
});

test("an existing authConfig.js stops setup before consent, npm, or other file writes", async (t) => {
  const directory = await createProject(t);
  const auth = join(directory, DEFAULT_OUTPUT_DIRECTORY, "auth");
  await mkdir(auth, { recursive: true });
  await writeFile(join(auth, "authConfig.js"), "user customization");
  const result = runCli(directory, ["init"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to overwrite/);
  assert.doesNotMatch(result.stdout, /Installing Axios|Install Axios/);
  assert.deepEqual(await readdir(join(auth, "..")), ["auth"]);
  assert.deepEqual(await readdir(auth), ["authConfig.js"]);
  assert.equal(await readFile(join(auth, "authConfig.js"), "utf8"), "user customization");
  await assert.rejects(readFile(join(directory, "../npm-call.json")), { code: "ENOENT" });
});

for (const args of [["init"], ["init", "-y"], ["init", "--yes"]]) {
  test(`guides project initialization without changes when package.json is missing: ${args.join(" ")}`, async (t) => {
    const directory = await createProject(t, null);
    await writeFile(join(directory, "notes.txt"), "keep this");
    const result = runCli(directory, args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No package\.json found/);
    assert.match(result.stderr, /existing project/);
    assert.match(result.stderr, /npm init -y\s+Then run:\s+npx axios-scaffold-kit init/);
    assert.doesNotMatch(result.stdout, /Install Axios|Installing Axios/);
    assert.deepEqual(await readdir(directory), ["notes.txt"]);
    assert.equal(await readFile(join(directory, "notes.txt"), "utf8"), "keep this");
    await assert.rejects(readFile(join(directory, "../npm-call.json")), { code: "ENOENT" });
  });
}

test("does not suggest creating a manifest when package.json exists but cannot be read as a file", async (t) => {
  const directory = await createProject(t, null);
  await mkdir(join(directory, "package.json"));
  const result = runCli(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot read .*package\.json/);
  assert.doesNotMatch(result.stderr, /npm init -y/);
  assert.deepEqual(await readdir(directory), ["package.json"]);
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

test("nested auth conflicts stop before prompting, installing, or writing root files", async (t) => {
  const directory = await createProject(t);
  const output = join(directory, DEFAULT_OUTPUT_DIRECTORY);
  await mkdir(join(output, "auth"), { recursive: true });
  await writeFile(join(output, "auth/attachAuthInterceptors.js"), "existing auth code");
  const result = runCli(directory, ["init"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to overwrite/);
  assert.doesNotMatch(result.stdout, /Install Axios|Installing Axios/);
  assert.deepEqual(await readdir(output), ["auth"]);
  assert.equal(await readFile(join(output, "auth/attachAuthInterceptors.js"), "utf8"), "existing auth code");
  await assert.rejects(readFile(join(directory, "../npm-call.json")), { code: "ENOENT" });
});

test("an existing file at the auth directory is preserved before installation", async (t) => {
  const directory = await createProject(t);
  const output = join(directory, DEFAULT_OUTPUT_DIRECTORY);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "auth"), "user file");
  const result = runCli(directory);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /Installing Axios/);
  assert.equal(await readFile(join(output, "auth"), "utf8"), "user file");
});

for (const dangling of [false, true]) {
  test(`refuses ${dangling ? "dangling" : "external"} nested directory symlinks before npm`, async (t) => {
    const directory = await createProject(t);
    const output = join(directory, DEFAULT_OUTPUT_DIRECTORY);
    const external = join(directory, "../external");
    await mkdir(output, { recursive: true });
    if (!dangling) await mkdir(external);
    await symlink(external, join(output, "auth"), "junction");
    const result = runCli(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /without symlinks/);
    assert.deepEqual(await readdir(output), ["auth"]);
    if (!dangling) assert.deepEqual(await readdir(external), []);
    await assert.rejects(readFile(join(directory, "../npm-call.json")), { code: "ENOENT" });
  });
}

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
