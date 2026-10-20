import { lstat, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const DIRECT_DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
];
const OTHER_MANAGER_FILES = ["yarn.lock", "pnpm-lock.yaml", "pnpm-workspace.yaml"];

function declaresAxios(dependencies) {
  return Object.prototype.hasOwnProperty.call(dependencies ?? {}, "axios");
}

/** Preserve direct declarations; do not silently replace a peer dependency contract. */
export function hasAxiosDependency(manifest) {
  if (DIRECT_DEPENDENCY_FIELDS.some((field) => declaresAxios(manifest[field]))) {
    return true;
  }

  if (declaresAxios(manifest.peerDependencies)) {
    throw new Error(
      "Axios is declared only in peerDependencies. Install Axios explicitly in this project before running init; the peer contract was not changed.",
    );
  }

  return false;
}

/** Limit automatic installation to standalone npm projects without mixed package managers. */
export async function validateInstallationTarget(projectDirectory, manifest) {
  // npm can discover an enclosing workspace even when invoked inside a child package.
  const targetDirectory = resolve(projectDirectory);
  let directory = targetDirectory;

  while (true) {
    let currentManifest = manifest;

    if (directory !== targetDirectory) {
      const manifestPath = join(directory, "package.json");
      let manifestText;

      try {
        manifestText = await readFile(manifestPath, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw new Error(`Cannot inspect ${manifestPath}: ${error.message}`, { cause: error });
        }
      }

      if (manifestText !== undefined) {
        try {
          currentManifest = JSON.parse(manifestText);
        } catch (error) {
          throw new Error(`Cannot inspect invalid JSON in ${manifestPath}.`, { cause: error });
        }
      } else {
        currentManifest = null;
      }
    }

    const manager = currentManifest?.packageManager;
    if (manager !== undefined && (typeof manager !== "string" || !manager.startsWith("npm@"))) {
      throw new Error(
        `Automatic installation supports npm projects only; ${directory} declares packageManager ${manager}. Install Axios with your package manager first.`,
      );
    }

    for (const filename of OTHER_MANAGER_FILES) {
      const markerPath = join(directory, filename);

      try {
        await lstat(markerPath);
      } catch (error) {
        if (error.code === "ENOENT") {
          continue;
        }
        throw new Error(`Cannot inspect ${markerPath}: ${error.message}`, { cause: error });
      }

      throw new Error(
        `Automatic installation does not support ${filename} (${directory}). Install Axios with your package manager first; no npm installation was started.`,
      );
    }

    if (currentManifest?.workspaces !== undefined) {
      throw new Error(
        `Automatic installation inside workspace roots is not supported (${directory}). Install Axios in the intended package first.`,
      );
    }

    const parent = dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
}
