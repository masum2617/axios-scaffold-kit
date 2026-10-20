import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AXIOS_VERSION_RANGE } from "../../src/config/defaults.js";
import { installAxios } from "../../src/install/install-axios.js";
import { createProject, readNpmCall, runCli } from "../helpers/project-fixture.js";

test("installs missing Axios before creating starter files", async (t) => {
  const directory = await createProject(t);
  const result = runCli(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installing Axios/);
  assert.match(result.stdout, /Axios installed successfully/);
  assert.match(result.stdout, /Created/);
  assert.deepEqual(await readNpmCall(directory), {
    args: ["install", `axios@${AXIOS_VERSION_RANGE}`, "--save-prod"],
    cwd: directory,
    outputExists: false,
  });
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  assert.equal(manifest.dependencies.axios, AXIOS_VERSION_RANGE);
  assert.deepEqual((await readdir(join(directory, "src/api"))).sort(), ["apiClient.js", "exampleApi.js"]);
});

for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
  test(`preserves Axios and lockfiles when declared in ${field}`, async (t) => {
    const manifest = JSON.stringify({ name: "existing", [field]: { axios: "0.27.2" } });
    const directory = await createProject(t, manifest);
    await writeFile(join(directory, "package-lock.json"), "existing lockfile");
    const result = runCli(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Axios already declared; preserving it/);
    assert.equal(await readFile(join(directory, "package.json"), "utf8"), manifest);
    assert.equal(await readFile(join(directory, "package-lock.json"), "utf8"), "existing lockfile");
    await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
  });
}

test("refuses peer-only Axios without altering the manifest", async (t) => {
  const manifest = '{"peerDependencies":{"axios":"^1.0.0"}}';
  const directory = await createProject(t, manifest);
  const result = runCli(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /only in peerDependencies/);
  assert.equal(await readFile(join(directory, "package.json"), "utf8"), manifest);
  assert.deepEqual(await readdir(directory), ["package.json"]);
  await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
});

test("does not mistake incidental node_modules contents for a declaration", async (t) => {
  const directory = await createProject(t);
  await mkdir(join(directory, "node_modules/axios"), { recursive: true });
  const result = runCli(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installing Axios/);
  assert.ok(await readNpmCall(directory));
});

for (const filename of ["apiClient.js", "exampleApi.js"]) {
  test(`checks ${filename} conflicts before starting npm`, async (t) => {
    const directory = await createProject(t);
    await mkdir(join(directory, "src/api"), { recursive: true });
    await writeFile(join(directory, "src/api", filename), "user code");
    const before = await readFile(join(directory, "package.json"), "utf8");
    const result = runCli(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing to overwrite/);
    assert.equal(await readFile(join(directory, "package.json"), "utf8"), before);
    await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
  });
}

test("reports npm failure and preserves npm's partial changes without generating", async (t) => {
  const directory = await createProject(t);
  const result = runCli(directory, ["init"], { FAKE_NPM_MODE: "fail" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exit code 7/);
  assert.match(result.stderr, /No starter files were generated/);
  assert.match(result.stderr, /not rolled back/);
  assert.doesNotMatch(result.stdout, /installed successfully|Created/);
  await assert.rejects(readdir(join(directory, "src")), { code: "ENOENT" });
  assert.equal(await readFile(join(directory, "package-lock.json"), "utf8"), "fixture lockfile");
});

test("reports termination without generating files", { skip: process.platform === "win32" }, async (t) => {
  const directory = await createProject(t);
  const result = runCli(directory, ["init"], { FAKE_NPM_MODE: "signal" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /terminated by SIGTERM/);
  assert.deepEqual(await readdir(directory), ["package.json"]);
});

test("reports unavailable npm without generating files", async (t) => {
  const directory = await createProject(t);
  const result = runCli(directory, ["init"], { PATH: "" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not start npm|npm installation failed/);
  assert.doesNotMatch(result.stdout, /Created/);
  assert.deepEqual(await readdir(directory), ["package.json"]);
});

test("distinguishes successful installation from partial generation failure", async (t) => {
  const directory = await createProject(t);
  const result = runCli(directory, ["init"], { FAKE_NPM_MODE: "generation-failure" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Axios installed successfully/);
  assert.match(result.stderr, /Axios was installed, but starter generation failed/);
  assert.match(result.stderr, /Already created: .*apiClient\.js/);
  assert.equal(await readFile(join(directory, "src/api/exampleApi.js"), "utf8"), "created during installation");
});

for (const platform of ["darwin", "win32"]) {
  test(`uses a fixed npm argument array on ${platform}`, async () => {
    const spawnProcess = (command, args, options) => {
      assert.equal(command, "npm");
      assert.deepEqual(args, [
        "install",
        platform === "win32" ? `"axios@${AXIOS_VERSION_RANGE}"` : `axios@${AXIOS_VERSION_RANGE}`,
        "--save-prod",
      ]);
      assert.deepEqual(options, {
        cwd: "/example project",
        stdio: "inherit",
        shell: platform === "win32",
      });
      const child = new EventEmitter();
      process.nextTick(() => child.emit("close", 0, null));
      return child;
    };
    await installAxios("/example project", { spawnProcess, platform });
  });
}

for (const manifest of [
  { packageManager: "yarn@4.0.0" },
  { packageManager: "pnpm@9.0.0" },
  { workspaces: ["packages/*"] },
]) {
  test(`refuses automatic installation for ${JSON.stringify(manifest)}`, async (t) => {
    const directory = await createProject(t, JSON.stringify(manifest));
    const result = runCli(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /npm projects only|workspace roots/);
    await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
    assert.deepEqual(await readdir(directory), ["package.json"]);
  });
}

for (const filename of ["yarn.lock", "pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
  test(`refuses mixed lockfiles when ${filename} identifies another manager`, async (t) => {
    const directory = await createProject(t);
    await writeFile(join(directory, filename), "existing configuration");
    const result = runCli(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Automatic installation does not support/);
    assert.equal(await readFile(join(directory, filename), "utf8"), "existing configuration");
    await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
  });
}

test("detects an enclosing npm workspace before installing in a child package", async (t) => {
  const directory = await createProject(t);
  await writeFile(join(directory, "..", "package.json"), '{"workspaces":["*"]}');
  const result = runCli(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /workspace roots/);
  await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
});

test("detects an enclosing pnpm workspace without starting npm", async (t) => {
  const directory = await createProject(t);
  await writeFile(join(directory, "..", "pnpm-workspace.yaml"), "packages: [project*]");
  const result = runCli(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not support pnpm-workspace.yaml/);
  await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
});

test("allows generation without installation in another manager's project with Axios declared", async (t) => {
  const directory = await createProject(t, '{"packageManager":"pnpm@9.0.0","dependencies":{"axios":"^1.0.0"}}');
  const result = runCli(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /preserving it/);
  await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
});
