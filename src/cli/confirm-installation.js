import { createInterface } from "node:readline";

/**
 * Ask for consent without changing the project.
 * @returns {Promise<"confirmed" | "declined" | "interrupted">}
 */
export function confirmInstallation({
  input = process.stdin,
  output = process.stdout,
  signalSource = process,
} = {}) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "Axios is missing and installation requires consent. Run init in an interactive terminal, or use init -y (or --yes) to authorize installation.",
    );
  }

  return new Promise((resolve, reject) => {
    const terminal = createInterface({ input, output, terminal: true });
    let finished = false;

    function cleanup() {
      signalSource.removeListener("SIGINT", onInterrupt);
      terminal.removeListener("line", onAnswer);
      terminal.removeListener("close", onClose);
      terminal.removeListener("SIGINT", onInterrupt);
      terminal.removeListener("error", onError);
      terminal.close();
    }

    function finish(result) {
      if (finished) {
        return;
      }
      finished = true;
      cleanup();
      resolve(result);
    }

    function onAnswer(answer) {
      const normalized = answer.trim().toLowerCase();
      if (normalized === "y" || normalized === "yes") {
        finish("confirmed");
      } else if (normalized === "" || normalized === "n" || normalized === "no") {
        finish("declined");
      } else {
        output.write("Please answer y or n.\n");
        terminal.prompt();
      }
    }

    function onClose() {
      finish("declined");
    }

    function onInterrupt() {
      output.write("\n");
      finish("interrupted");
    }

    function onError(error) {
      if (!finished) {
        finished = true;
        cleanup();
        reject(error);
      }
    }

    terminal.on("line", onAnswer);
    terminal.once("close", onClose);
    terminal.once("SIGINT", onInterrupt);
    terminal.once("error", onError);
    signalSource.once("SIGINT", onInterrupt);
    output.write("Axios was not found in package.json.\n");
    output.write("Installing it may update package.json, the lockfile, and node_modules.\n");
    terminal.setPrompt("Install Axios? (y/N) ");
    terminal.prompt();
  });
}
