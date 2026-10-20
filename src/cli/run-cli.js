import { relative } from "node:path";
import { validateProject } from "../project/validate-project.js";
import { prepareFiles, writeFiles } from "../generate/generate-files.js";
import { hasAxiosDependency, validateInstallationTarget } from "../project/inspect-installation.js";
import { installAxios } from "../install/install-axios.js";

const HELP = `Usage: axios-scaffold-kit init

Generate a JavaScript Axios client and example API in an existing project.

Commands:
  init       Create the starter files without overwriting existing files
  --help     Show this help

Installs missing Axios in standalone npm projects; preserves existing declarations.
Authentication is not configured by this command.`;

/** Handle terminal arguments; keep project and filesystem work in their own modules. */
export async function runCli(args, projectDirectory) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
    console.log(HELP);
    return;
  }

  if (args.length !== 1 || args[0] !== "init") {
    throw new Error("Unsupported command or arguments. Run axios-scaffold-kit --help.");
  }

  const manifest = await validateProject(projectDirectory);
  const prepared = await prepareFiles(projectDirectory);
  const hasAxios = hasAxiosDependency(manifest);

  if (hasAxios) {
    console.log("Axios already declared; preserving it.");
  } else {
    await validateInstallationTarget(projectDirectory, manifest);
    console.log("Installing Axios with npm. npm may update package.json, lockfiles, and node_modules.");

    try {
      await installAxios(projectDirectory);
    } catch (error) {
      throw new Error(
        `${error.message} No starter files were generated. npm changes, if any, were not rolled back; inspect the project before retrying.`,
        { cause: error },
      );
    }

    console.log("Axios installed successfully.");
  }

  let createdFiles;

  try {
    createdFiles = await writeFiles(prepared);
  } catch (error) {
    const installation = hasAxios ? "" : "Axios was installed, but starter generation failed. ";
    throw new Error(`${installation}${error.message}`, { cause: error });
  }

  for (const file of createdFiles) {
    console.log(`Created ${relative(projectDirectory, file)}`);
  }

  console.log("Next: set your API base URL in apiClient.js and replace the example endpoints.");
  console.log("No requests were sent to your API by this command.");
}
