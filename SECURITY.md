# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report privately through GitHub: open the [Security tab](https://github.com/sikandar100/orm-preflight/security) of this repository and choose **Report a vulnerability**. You will get a response within 7 days.

## Supported versions

Security fixes are released for the latest minor version.

## Security model

- **Static mode** (the default) never imports or executes the migration files it reads, and makes no network or database connections. It is designed to be safe on pull requests from forks. Anything that makes static mode execute user code, read files outside the requested paths, or make a network connection is a vulnerability.
- **Configuration is JSON only**, so a pull request cannot run code through a config file.
- **`--execute` mode** (planned) runs migration code by design. Use it only in trusted contexts, and never with the `pull_request_target` GitHub Actions event.
- **No telemetry.** orm-preflight never sends data anywhere.
- **Releases** are published from GitHub Actions with npm trusted publishing and provenance. No long-lived npm tokens exist.
