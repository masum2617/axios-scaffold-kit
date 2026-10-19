import { relative } from "node:path";
import { validateProject } from "../project/validate-project.js";
import { generateFiles } from "../generate/generate-files.js";

const HELP = `Usage: axios-scaffold-kit init

Generate a JavaScript Axios client and example API in an existing project.

Commands:
  init       Create the starter files without overwriting existing files
  --help     Show this help

This development milestone does not install Axios or configure authentication.`;

/** Handle terminal arguments; keep project and filesystem work in their own modules. */
export async function runCli(args, projectDirectory) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
    console.log(HELP);
    return;
  }

  if (args.length !== 1 || args[0] !== "init") {
    throw new Error("Unsupported command or arguments. Run axios-scaffold-kit --help.");
  }

  await validateProject(projectDirectory);
  const createdFiles = await generateFiles(projectDirectory);

  for (const file of createdFiles) {
    console.log(`Created ${relative(projectDirectory, file)}`);
  }

  console.log("Next: set your API base URL in apiClient.js and replace the example endpoints.");
  console.log("If Axios is not already installed, run: npm install axios");
  console.log("Axios was not installed and no API requests were sent by this command.");
}
