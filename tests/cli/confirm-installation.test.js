import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { confirmInstallation } from "../../src/cli/confirm-installation.js";
import { createProject, readNpmCall, runCli } from "../helpers/project-fixture.js";

function createTerminal(t) {
  const input = new PassThrough();
  const output = new PassThrough();
  input.isTTY = true;
  output.isTTY = true;
  output.columns = 80;
  const signalSource = new EventEmitter();
  let text = "";
  output.on("data", (chunk) => { text += chunk.toString(); });
  t.after(() => { input.destroy(); output.destroy(); });
  return { input, output, signalSource, getText: () => text };
}

for (const answer of ["y", "yes", " Y ", " YeS "]) {
  test(`accepts affirmative consent: ${JSON.stringify(answer)}`, async (t) => {
    const streams = createTerminal(t);
    const result = confirmInstallation(streams);
    streams.input.write(`${answer}\n`);
    assert.equal(await result, "confirmed");
    assert.match(streams.getText(), /Installing it may update package.json/);
    assert.equal(streams.signalSource.listenerCount("SIGINT"), 0);
  });
}

for (const answer of ["n", "no", "", " NO "]) {
  test(`declines installation: ${JSON.stringify(answer)}`, async (t) => {
    const streams = createTerminal(t);
    const result = confirmInstallation(streams);
    streams.input.write(`${answer}\n`);
    assert.equal(await result, "declined");
    assert.equal(streams.signalSource.listenerCount("SIGINT"), 0);
  });
}

test("repeats an invalid answer without treating it as consent", async (t) => {
  const streams = createTerminal(t);
  const result = confirmInstallation(streams);
  streams.input.write("maybe\n");
  assert.match(streams.getText(), /Please answer y or n/);
  streams.input.write("n\n");
  assert.equal(await result, "declined");
});

test("end of input declines and releases signal listeners", async (t) => {
  const streams = createTerminal(t);
  const result = confirmInstallation(streams);
  streams.input.end();
  assert.equal(await result, "declined");
  assert.equal(streams.signalSource.listenerCount("SIGINT"), 0);
});

for (const source of ["keyboard", "process"]) {
  test(`handles ${source} Ctrl+C and cleans up`, async (t) => {
    const streams = createTerminal(t);
    const result = confirmInstallation(streams);
    if (source === "keyboard") {
      streams.input.write("\u0003");
    } else {
      streams.signalSource.emit("SIGINT");
    }
    assert.equal(await result, "interrupted");
    assert.equal(streams.signalSource.listenerCount("SIGINT"), 0);
  });
}

test("requires both input and output to be interactive", async (t) => {
  const streams = createTerminal(t);
  streams.input.isTTY = false;
  assert.throws(() => confirmInstallation(streams), /interactive terminal/);
  streams.input.isTTY = true;
  streams.output.isTTY = false;
  assert.throws(() => confirmInstallation(streams), /interactive terminal/);
});

test("noninteractive refusal changes no existing project files or dependencies", async (t) => {
  const directory = await createProject(t);
  const manifest = await readFile(join(directory, "package.json"), "utf8");
  await writeFile(join(directory, "package-lock.json"), "original lock");
  await writeFile(join(directory, "application.js"), "original source");
  await mkdir(join(directory, "node_modules/existing"), { recursive: true });
  await writeFile(join(directory, "node_modules/existing/index.js"), "original dependency");
  const result = runCli(directory, ["init"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /installation requires consent/);
  assert.match(result.stderr, /init -y/);
  assert.equal(await readFile(join(directory, "package.json"), "utf8"), manifest);
  assert.equal(await readFile(join(directory, "package-lock.json"), "utf8"), "original lock");
  assert.equal(await readFile(join(directory, "application.js"), "utf8"), "original source");
  assert.equal(await readFile(join(directory, "node_modules/existing/index.js"), "utf8"), "original dependency");
  await assert.rejects(readdir(join(directory, "src")), { code: "ENOENT" });
  await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
});

for (const option of ["-y", "--yes"]) {
  test(`${option} authorizes noninteractive installation`, async (t) => {
    const directory = await createProject(t);
    const result = runCli(directory, ["init", option]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Axios installed successfully/);
    assert.doesNotMatch(result.stdout, /Install Axios\?/);
    assert.ok(await readNpmCall(directory));
  });
}

test("existing Axios permits noninteractive generation without consent flags", async (t) => {
  const directory = await createProject(t, '{"dependencies":{"axios":"^1.0.0"}}');
  const result = runCli(directory, ["init"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /preserving it/);
  assert.doesNotMatch(result.stdout, /Install Axios\?/);
  await assert.rejects(readNpmCall(directory), { code: "ENOENT" });
});
