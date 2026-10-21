import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import {
  DEFAULT_OUTPUT_DIRECTORY,
  DEFAULT_TIMEOUT_MS,
} from "../config/defaults.js";

const TEMPLATE_DIRECTORY = new URL("../../templates/javascript/", import.meta.url);
const TEMPLATE_FILES = ["apiClient.js", "exampleApi.js", "auth/authConfig.js", "auth/attachAuthInterceptors.js"];

/** Inspect parents too: a missing leaf can hide a dangling or external directory symlink. */
async function inspectOutputParents(projectDirectory, destination) {
  let directory = projectDirectory;
  for (const part of relative(projectDirectory, dirname(destination)).split(sep)) {
    directory = join(directory, part);
    let entry;
    try {
      entry = await lstat(directory);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw new Error(`Cannot inspect ${directory}: ${error.message}`, { cause: error });
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(`Cannot inspect output directory ${directory}: expected a directory without symlinks.`);
    }
  }
}

/** Prepare templates and check conflicts before dependency installation can change the project. */
export async function prepareFiles(projectDirectory) {
  const outputDirectory = join(projectDirectory, DEFAULT_OUTPUT_DIRECTORY);
  const preparedFiles = [];

  // Prepare every template and check every destination before creating output.
  for (const filename of TEMPLATE_FILES) {
    const destination = join(outputDirectory, filename);
    await inspectOutputParents(projectDirectory, destination);
    let exists = false;

    try {
      await lstat(destination);
      exists = true;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new Error(`Cannot inspect ${destination}: ${error.message}`, {
          cause: error,
        });
      }
    }

    if (exists) {
      throw new Error(`Refusing to overwrite ${destination}. No files were generated.`);
    }

    const template = await readFile(new URL(filename, TEMPLATE_DIRECTORY), "utf8");
    const content = template.replaceAll(
      "__DEFAULT_TIMEOUT_MS__",
      String(DEFAULT_TIMEOUT_MS),
    );

    preparedFiles.push({ destination, content });
  }

  return { projectDirectory, outputDirectory, files: preparedFiles };
}

/** Write prepared files without overwrites; report rather than hide partial failures. */
export async function writeFiles({ projectDirectory, outputDirectory, files }) {
  const createdFiles = [];

  try {
    for (const { destination, content } of files) {
      await inspectOutputParents(projectDirectory, destination);
      await mkdir(dirname(destination), { recursive: true });
      // Exclusive creation also prevents overwrites if a file appears after preflight.
      await writeFile(destination, content, { flag: "wx" });
      createdFiles.push(destination);
    }
  } catch (error) {
    const progress = createdFiles.length > 0
      ? ` Already created: ${createdFiles.join(", ")}.`
      : "";

    throw new Error(
      `Could not finish generation in ${outputDirectory}: ${error.message}.${progress} Inspect the output before retrying; files were not rolled back.`,
      { cause: error },
    );
  }

  return createdFiles;
}
