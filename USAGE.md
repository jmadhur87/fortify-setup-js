
<!-- START-INCLUDE:repo-usage.md -->

# @fortify/setup - Usage Instructions

## Overview

`@fortify/setup` is a cross-platform utility that automates the setup of Fortify tools in CI/CD pipelines and local development environments by providing a wrapper around `fcli tool env` commands:

1. **Configure fcli bootstrapping** (optional) - Use the `bootstrap-config` command to specify custom fcli download URLs or point to a pre-installed fcli binary (must be 3.14.0+)

2. **Bootstrap fcli** - Automatically downloads and verifies fcli v3.x from GitHub or custom URL, unless pre-installed fcli has been configured

3. **Initialize tools** - Use `env init` to detect, install, and configure Fortify tools (fcli, ScanCentral Client, FoD Uploader, Debricked CLI)

4. **Generate environment variables** - Use platform-specific `env` subcommands (`shell`, `github`, `ado`, `gitlab`, `powershell`) to generate tool-related environment variables and PATH updates

The bootstrapped fcli is saved to an internal cache, allowing subsequent `env` commands to reuse it without re-downloading.

## Quick Start

```bash
# Initialize tools with auto-detected versions
npx @fortify/setup env init --tools=fcli:auto,sc-client:auto

# Set shell environment variables to add initialized fortify tools to PATH
source <(npx @fortify/setup env shell)

# Or use pre-installed fcli (skip download, must be 3.14.0+)
npx @fortify/setup bootstrap-config --fcli-path=/usr/local/bin/fcli
npx @fortify/setup env init --tools=sc-client:auto

# Generate GitHub Actions environment
npx @fortify/setup env github
```

## Version Pinning

By default, `npx @fortify/setup` will always use the latest version, which may include breaking changes. Especially in CI/CD and automation scenarios, it is recommended to pin `@fortify/setup` to at least a major version to avoid any breaking changes from disrupting your pipelines or automations. 

```bash
# Pin to major version (recommended - gets bug fixes and features)
npx @fortify/setup@2 env init --tools=fcli:auto,sc-client:auto

# Pin to minor version (more conservative)
npx @fortify/setup@2.0 env init --tools=fcli:auto,sc-client:auto

# Pin to exact version (maximum stability)
npx @fortify/setup@2.0.0 env init --tools=fcli:auto,sc-client:auto
```

Instead of explicitly specifying a version on each `@fortify/setup` invocation, you can also install a specific version globally and then use that version onwards:

```bash
# Install specific major version
npm install -g @fortify/setup@2

# Use installed version
fortify-setup env init --tools=fcli:auto,sc-client:auto
```

## Commands

### `env` - Initialize tools and generate environment variables

```bash
npx @fortify/setup env <subcommand> [options]
```

Provides a unified interface to `fcli tool env` commands for both tool initialization and environment variable generation. Automatically bootstraps fcli if not available in cache or via configuration. Use the `--fcli-help` option to display fcli help output for given command, i.e.:

```bash
# Show general `fcli tool env` help, including list of available subcommands
npx @fortify/setup env --fcli-help

# Show help for specific subcommand
npx @fortify/setup env init --fcli-help
npx @fortify/setup env shell --fcli-help
```

Depending on the bootstrapped fcli version, the list of available `env` subcommands and their usage may vary. Following is a list of commonly used subcommands that were available in the latest fcli version at the time of writing.

**Subcommands:**
- `init` - Initialize/install Fortify tools (wraps `fcli tool env init`)
- `shell` - Generate POSIX shell exports
- `powershell` (or `pwsh`) - Generate PowerShell assignments
- `github` - Append to GitHub Actions environment files
- `gitlab` - Write to a GitLab environment file
- `ado` - Generate Azure DevOps logging commands
- `expr` - Evaluate custom template expressions

**Options:**
- `--help|-h` - Show `@fortify/setup env` help
- `--fcli-help` - Show `fcli tool env` help

**Common init options:**
- `--tools=<tool1>[:<version>],<tool2>[:<version>],...` - Tools to initialize
  - Format: `toolname:version` where version can be:
    - Specific version: `sc-client:24.4.0`, `fcli:3.6.1`
    - Latest: `sc-client:latest`, `fcli:latest`
    - Auto-detect: `sc-client:auto`, `fcli:auto`
    - Path: `sc-client:/path/to/scancentral`
  - Available tools: `fcli`, `sc-client`, `fod-uploader`, `debricked-cli`

**Examples:**
```bash
# Initialize with auto-detected versions
npx @fortify/setup env init --tools=fcli:auto,sc-client:auto

# Initialize with specific versions
npx @fortify/setup env init --tools=fcli:3.6.1,sc-client:24.4.0

# Initialize with latest versions
npx @fortify/setup env init --tools=fcli:latest,sc-client:latest

# Initialize with path to pre-installed tool
npx @fortify/setup env init --tools=sc-client:/opt/scancentral/bin

# Generate shell environment variables
npx @fortify/setup env shell

# Generate GitHub Actions environment
npx @fortify/setup env github

# Use in shell (bash/zsh)
source <(npx @fortify/setup env shell)
eval "$(npx @fortify/setup env shell)"

# Show general fcli tool env help
npx @fortify/setup env --fcli-help

# Show help for specific subcommand
npx @fortify/setup env init --fcli-help
npx @fortify/setup env shell --fcli-help
```

### `bootstrap-config` - Configure bootstrap settings

```bash
npx @fortify/setup bootstrap-config [options]
```

Configures how fcli is bootstrapped. Settings are saved to `~/.config/fortify/setup/config.json`.

**Options:**
- `--help|-h` - Show `@fortify/setup bootstrap-config` help
- `--cache-dir=<path>` - Custom cache directory for bootstrapped fcli
  - Default: `~/.fortify/fcli/bootstrap` (Linux/Mac) or `%USERPROFILE%\.fortify\fcli\bootstrap` (Windows)
  - **Recommended for CI/CD**: Use job-specific temp directory (see Bootstrap Behavior section)
- `--fcli-version=<version>` - Fcli version to bootstrap
  - For numeric versions, 'v' prefix is automatically added if missing: `3.14.1` → `v3.14.1`, `3` → `v3`
  - Special tags are used as-is: `dev_v3.x`, `latest`, `main`
  - Examples: `v3`, `v3.14`, `v3.14.1`, `3`, `3.14`, `3.14.1`, `dev_v3.x`
  - Default: `v3` (latest v3.x release)
  - Ignored if `--fcli-url` is specified
- `--fcli-url=<url>` - Full URL to fcli archive (platform-specific)
  - Example: `https://github.com/fortify/fcli/releases/download/v3/fcli-linux.tgz`
  - Takes precedence over `--fcli-version`
- `--fcli-rsa-sha256-url=<url>` - Full URL to RSA SHA256 signature file
  - Default: `<fcli-url>.rsa_sha256`
- `--fcli-path=<path>` - Use pre-installed fcli binary (skip download)
  - **Must be fcli 3.14.0 or later**
- `--verify-signature` - Verify RSA signatures on downloads (default: enabled)
- `--no-verify-signature` - Skip signature verification (not recommended)
- `--reset` - Reset configuration to defaults

**Environment variables** (override config file):
- `FCLI_BOOTSTRAP_CACHE_DIR` - Override cache directory
- `FCLI_BOOTSTRAP_VERSION` - Override fcli version (supports with or without 'v' prefix, ignored if `FCLI_BOOTSTRAP_URL` is set)
  - Examples: `v3.14.1`, `3.14.1`, `v3`, `3`
- `FCLI_BOOTSTRAP_URL` - Override fcli archive download URL (takes precedence over version)
- `FCLI_BOOTSTRAP_RSA_SHA256_URL` - Override RSA SHA256 signature file URL
- `FCLI_BOOTSTRAP_PATH` - Override fcli binary path (must be 3.14.0+)
- `FCLI_BOOTSTRAP_VERIFY_SIGNATURE` - Enable/disable signature verification (true|false)

**Examples:**
```bash
# Pin to specific fcli version
npx @fortify/setup bootstrap-config --fcli-version=v3.14.1

# Use pre-installed fcli (skip downloads)
npx @fortify/setup bootstrap-config --fcli-path=/usr/local/bin/fcli

# Use custom download URL (internal mirror)
npx @fortify/setup bootstrap-config --fcli-url=https://my-mirror.com/fcli-linux.tgz

# Disable signature verification (not recommended)
npx @fortify/setup bootstrap-config --no-verify-signature

# Reset to defaults
npx @fortify/setup bootstrap-config --reset

# View current settings
npx @fortify/setup bootstrap-config

# Configure via environment variables
export FCLI_BOOTSTRAP_PATH=/usr/local/bin/fcli
npx @fortify/setup bootstrap-config
```

## Bootstrap Behavior

`@fortify/setup` automatically bootstraps fcli when needed by any `env` subcommand. The bootstrap process checks for existing fcli installations before downloading.

**fcli resolution order:**

1. **Configured path** - Via config file or `FCLI_BOOTSTRAP_PATH` env var (must be fcli 3.14.0+)
2. **Cached download** - Previously downloaded fcli in bootstrap cache
3. **Download from configured URL** - If none of the above are available

**Default bootstrap cache location:**
- Linux/Mac: `~/.fortify/fcli/bootstrap/`
- Windows: `%USERPROFILE%\.fortify\fcli\bootstrap\`

**Configurable bootstrap cache directory:**

The bootstrap cache directory can be customized for CI/CD environments or to control cache lifetime:

- **Environment variable**: `FCLI_BOOTSTRAP_CACHE_DIR=/path/to/cache`
- **Programmatic API**: Pass `config: { cacheDir: '/path' }` to `runFortifyEnv()`

**Recommended CI cache directories** (job-specific, cleaned between runs):

| CI System | Environment Variable | Recommended Cache Dir |
|-----------|---------------------|----------------------|
| GitHub Actions | `RUNNER_TEMP` | `$RUNNER_TEMP/.fortify/fcli/bootstrap` |
| GitLab CI | `CI_PROJECT_DIR` | `$CI_PROJECT_DIR/.fortify-cache/fcli/bootstrap` |
| Azure DevOps | `AGENT_TEMPDIRECTORY` | `$AGENT_TEMPDIRECTORY/.fortify/fcli/bootstrap` |
| Bitbucket | `BITBUCKET_CLONE_DIR` | `$BITBUCKET_CLONE_DIR/.fortify-cache/fcli/bootstrap` |
| Jenkins | `WORKSPACE` | `$WORKSPACE/.fortify-cache/fcli/bootstrap` |

## Configuration File

Configuration is saved to `~/.config/fortify/setup/config.json`:

## Security

### Signature Verification

By default, `@fortify/setup` verifies RSA SHA256 signatures on downloaded fcli archives using Fortify's public key. This ensures the binary hasn't been tampered with.

**To disable** (not recommended unless when downloading from trusted URLs):

```bash
npx @fortify/setup bootstrap-config --no-verify-signature
```

### Pre-installed fcli Requirements

When using pre-installed fcli (via `--fcli-path` or environment variables), you **must** use fcli version 3.14.0 or later, as the `fcli tool env` commands as exposed through `@fortify/setup` were introduced in that fcli version.

### Supply Chain Security

- **Minimal dependencies** - Only `undici`, `tar`, and `unzipper` for cross-platform HTTP and archive handling
- **Pure Node.js implementation** - No reliance on system utilities (curl, tar, openssl)
- **Transparent bootstrap** - All downloads from official Fortify GitHub releases
- **Always latest v3.x** - Ensures latest security patches and features
- **Signature verification** - RSA SHA256 signature verification by default

## Troubleshooting

### Bootstrap fails with signature verification error

```bash
# Disable verification (not recommended)
npx @fortify/setup bootstrap-config --no-verify-signature

# Or specify custom signature URL
npx @fortify/setup bootstrap-config \
  --fcli-url=https://custom-url/fcli-linux.tgz \
  --fcli-rsa-sha256-url=https://custom-url/fcli-linux.tgz.rsa_sha256
```

### Using pre-installed fcli

```bash
# Ensure fcli is 3.14.0 or later
fcli --version  # Should show 3.14.0+

# Configure path to pre-installed fcli
npx @fortify/setup bootstrap-config --fcli-path=/usr/local/bin/fcli

# Or use environment variable
export FCLI_BOOTSTRAP_PATH=/usr/local/bin/fcli
npx @fortify/setup env init --tools=fcli:auto,sc-client:auto
```

### `env` command fails

```bash
# Ensure tools are initialized first
npx @fortify/setup env init --tools=fcli:auto,sc-client:auto
npx @fortify/setup env shell

# Or configure pre-installed fcli
npx @fortify/setup bootstrap-config --fcli-path=/usr/local/bin/fcli
npx @fortify/setup env shell
```

### CI/CD downloading fcli on every run

This is as designed; to ensure the latest fcli v3 version is used by default, most Fortify-provided CI integrations set `FCLI_BOOTSTRAP_CACHE_DIR` to a job-specific (temp) directory that gets cleared after each job. To avoid:

- Pre-install fcli and use either the `bootstrap-config --fcli-path` option or set the `FCLI_BOOTSTRAP_PATH` environment variable
- Some CI integrations may install the bootstrapped fcli to a tool cache if `FCLI_BOOTSTRAP_VERSION` is set to a specific `<major>.<minor>.<patch>` version, allowing a bootstrapped fcli version to be re-used across job runs.

### Proxy configuration

```bash
# Set standard proxy environment variables
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# @fortify/setup automatically uses these for downloads
npx @fortify/setup env init --tools=fcli:auto,sc-client:auto
```

## Programmatic Usage

For Node.js/TypeScript projects that need to integrate Fortify tooling programmatically, `@fortify/setup` can be used as a library.

### Installation

```bash
# Install as project dependency (also see "Version Pinning" section)
npm install --save-dev @fortify/setup@^2.1.0
```

### API Usage

```typescript
import { runFortifyEnv } from '@fortify/setup';

// Initialize tools
await runFortifyEnv({
  args: ['init', '--tools=fcli:auto,sc-client:auto'],
  verbose: true
});

// Generate environment variables
const result = await runFortifyEnv({
  args: ['shell']
});
console.log(result.output);

// With custom bootstrap configuration
await runFortifyEnv({
  args: ['init', '--tools=fcli:auto'],
  config: {
    cacheDir: '/path/to/custom/cache',
    fcliUrl: 'https://custom-mirror.com/fcli-linux.tgz',
    verifySignature: false
  },
  verbose: true
});
```

### Use in npm scripts

```json
{
  "devDependencies": {
    "@fortify/setup": "^2.0.0"
  },
  "scripts": {
    "fortify:init": "@fortify/setup env init --tools=fcli:auto,sc-client:auto",
    "fortify:env": "@fortify/setup env shell",
    "fortify:github": "@fortify/setup env github"
  }
}
```

## Related Projects

- **[fcli](https://github.com/fortify/fcli)** - Fortify CLI (what this package bootstraps)
- **[fcli tool env commands](https://fortify.github.io/fcli/v3/manpage/fcli-tool-env.html)** - The fcli commands that @fortify/setup wraps

<!-- END-INCLUDE:repo-usage.md -->


---

*[This document was auto-generated from USAGE.template.md; do not edit by hand](https://github.com/fortify/shared-doc-resources/blob/main/USAGE.md)*
