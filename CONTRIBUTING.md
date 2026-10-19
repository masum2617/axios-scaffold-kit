# Contributing

Thank you for helping improve axios-scaffold-kit. The current development milestone implements local JavaScript generation. TypeScript output, automatic Axios installation, and optional authentication are planned.

## Proposing a change

Use GitHub issues to report bugs or suggest improvements once the repository is available. For bugs, include reproduction steps, expected and actual behavior, the package version, operating system, and Node.js/npm versions. Remove credentials and private application data from reports.

Discuss larger changes in an issue before implementing them. The project's scope is an editable Axios starter, with JavaScript and TypeScript output and optional authentication. Keep changes focused on that purpose.

## Pull requests

1. Fork the repository and create a short-lived branch for your change.
2. Make a focused change and update related documentation.
3. Run the documented checks once they exist; describe what you verified and any limitations.
4. Open a pull request explaining the problem and resulting behavior. Link the relevant issue when available.

Both language templates should behave consistently. Changes to authentication, file generation, or dependency installation should include appropriate behavioral verification once those features exist.

Run `npm test` before submitting code changes. The tests use Node's built-in test runner and temporary target projects. There are no build or lint commands yet. Do not claim unperformed checks as passing; generation tests do not prove HTTP requests work.

The maintainer reviews contributions and controls merges and official npm releases. Contributions do not require direct repository or publishing access.

## License

Contributions are made under this project's [MIT License](LICENSE). Submit only material you have the right to contribute.
