#!/usr/bin/env node

import { runCli } from "../src/cli/run-cli.js";

try {
  process.exitCode = await runCli(process.argv.slice(2), process.cwd());
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
