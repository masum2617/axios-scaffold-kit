import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Read and validate the target manifest without changing the project. */
export async function validateProject(projectDirectory) {
  const manifestPath = join(projectDirectory, "package.json");
  let manifestText;

  try {
    manifestText = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `No package.json found in ${projectDirectory}.\n\n` +
        "If this is an existing project, run setup from the folder containing its package.json.\n" +
        "If you are starting a new project, first run:\n" +
        "  npm init -y\n" +
        "Then run:\n" +
        "  npx axios-scaffold-kit init\n\n" +
        "Setup stopped without installing Axios or generating files.",
        { cause: error },
      );
    }

    throw new Error(
      `Cannot read ${manifestPath}. Run init from an existing project's root directory.`,
      { cause: error },
    );
  }

  let manifest;

  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    throw new Error(`Invalid JSON in ${manifestPath}. Fix it before running init.`, {
      cause: error,
    });
  }

  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`${manifestPath} must contain a JSON object.`);
  }

  return manifest;
}
