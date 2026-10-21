# Contributing

Thank you for helping improve axios-scaffold-kit. The `0.1.0` candidate provides JavaScript generation and consent-controlled Axios installation for standalone npm projects. Optional authentication/refresh/CSRF hooks and an editable authConfig factory are part of the candidate; TypeScript and output selection are future work.

## Proposing a change

Use [GitHub issues](https://github.com/masum2617/axios-scaffold-kit/issues) to report bugs or suggest improvements. For bugs, include reproduction steps, expected and actual behavior, the package version, operating system, and Node.js/npm versions. Remove credentials and private application data from reports.

Discuss larger changes in an issue before implementing them. The first release is an editable JavaScript starter. Keep changes focused and agree on future TypeScript interfaces or changes to authentication contracts before expanding the scope.

## Pull requests

1. Fork the repository and create a short-lived branch for your change.
2. Make a focused change and update related documentation.
3. Run `npm test` and inspect packaging when relevant; describe what you verified and any limitations.
4. Open a pull request explaining the problem and resulting behavior. Link the relevant issue when available.

Changes to consent, authentication, file generation, or dependency installation should include appropriate behavioral verification. Future language templates must provide equivalent behavior.

Run `npm test` with Node.js 22 or later before submitting code changes. The generator itself supports Node.js 16 or later. The tests use Node's built-in test runner, temporary target projects, and fake npm execution to stay offline; set `CLI_NODE_BINARY` to an absolute Node binary path to check the CLI on another runtime while keeping the test runner on Node 22 or later. Real installation and HTTP smoke checks belong in disposable projects, separately from routine tests. See the README's development instructions for the verified runtime matrix. For authentication changes, prepare a disposable fixture and run `npm run test:auth` as documented in the README. No Axios dependency belongs in the generator manifest. Browser checks are separate from Node integration tests. There are no build or lint commands yet. Do not claim unperformed checks as passing; generation tests alone do not prove HTTP requests work.

The maintainer reviews contributions and controls merges and official npm releases. Contributions do not require direct repository or publishing access.

The read-only CI workflow runs on pushes and pull requests; its existence is not proof the remote jobs passed. Releases follow [docs/RELEASING.md](docs/RELEASING.md), with a reviewed changelog, matching npm version and Git tag, and a GitHub Release. Neither a pull request merge nor an ordinary push publishes the package.

## License

Contributions are made under this project's [MIT License](LICENSE). Submit only material you have the right to contribute.
