import { spawn } from "node:child_process";
import { AXIOS_VERSION_RANGE } from "../config/defaults.js";

/** Run npm in the consumer project; injectable process creation keeps routine tests offline. */
export function installAxios(projectDirectory, { spawnProcess = spawn, platform = process.platform } = {}) {
  const packageSpec = `axios@${AXIOS_VERSION_RANGE}`;
  // cmd.exe treats an unquoted caret as an escape character, not part of the range.
  const packageArgument = platform === "win32" ? `"${packageSpec}"` : packageSpec;

  return new Promise((resolve, reject) => {
    let child;

    try {
      child = spawnProcess("npm", ["install", packageArgument, "--save-prod"], {
        cwd: projectDirectory,
        stdio: "inherit",
        shell: platform === "win32",
      });
    } catch (error) {
      reject(new Error(`Could not start npm in ${projectDirectory}: ${error.message}`, { cause: error }));
      return;
    }

    child.once("error", (error) => {
      reject(new Error(
        `Could not start npm in ${projectDirectory}: ${error.message}. Check that npm is available on PATH.`,
        { cause: error },
      ));
    });

    child.once("close", (code, signal) => {
      if (signal) {
        reject(new Error(`npm installation was terminated by ${signal}.`));
      } else if (code !== 0) {
        reject(new Error(`npm installation failed with exit code ${code}.`));
      } else {
        resolve();
      }
    });
  });
}
