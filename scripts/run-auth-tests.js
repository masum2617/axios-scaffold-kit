import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.env.AXIOS_TEST_DIRECTORY) {
  console.error("Set AXIOS_TEST_DIRECTORY to a disposable project containing Axios. Run node scripts/prepare-auth-fixture.js first.");
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["--test", fileURLToPath(new URL("../tests/auth/attach-auth-interceptors.test.js", import.meta.url))], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
