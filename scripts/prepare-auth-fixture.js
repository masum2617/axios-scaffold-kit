import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendFileSync } from "node:fs";
import { installAxios } from "../src/install/install-axios.js";

// Explicit network preparation, separate from offline tests and the generator repository.
const directory = await mkdtemp(join(tmpdir(), "axios-scaffold-auth-fixture-"));
await writeFile(join(directory, "package.json"), '{"name":"auth-test-fixture","private":true,"type":"module"}\n');
await installAxios(directory);
if (process.env.GITHUB_ENV) {
  appendFileSync(process.env.GITHUB_ENV, `AXIOS_TEST_DIRECTORY=${directory}\n`);
}
console.log(`Axios fixture ready. Set AXIOS_TEST_DIRECTORY to: ${directory}`);
