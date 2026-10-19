import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_OUTPUT_DIRECTORY,
  DEFAULT_TIMEOUT_MS,
} from "../config/defaults.js";

const TEMPLATE_DIRECTORY = new URL("../../templates/javascript/", import.meta.url);
const TEMPLATE_FILES = ["apiClient.js", "exampleApi.js"];

/** Copy the starter into a validated project, preserving existing destination files. */
export async function generateFiles(projectDirectory) {
  const outputDirectory = join(projectDirectory, DEFAULT_OUTPUT_DIRECTORY);
  const preparedFiles = [];

  // Prepare every template and check every destination before creating output.
  for (const filename of TEMPLATE_FILES) {
    const destination = join(outputDirectory, filename);
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

  const createdFiles = [];

  try {
    await mkdir(outputDirectory, { recursive: true });

    for (const { destination, content } of preparedFiles) {
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
