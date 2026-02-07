/**
 * Configuration management for @fortify/setup
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { BootstrapConfig, BootstrapOptions } from './types.js';
import { defaultLogger } from './logger.js';
import { validateUrl, formatError } from './utils.js';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'fortify', 'setup');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// By default, we use latest fcli v3 version for bootstrapping
const FCLI_VERSION = 'v3';

/**
 * Get default fcli version to be bootstrapped
 */
export function getFcliVersion(): string {
  return FCLI_VERSION;
}

/**
 * Normalize version to ensure it starts with 'v' prefix
 * Only adds 'v' prefix if version contains only numbers and dots (e.g., '3.14.1')
 * Leaves special tags unchanged (e.g., 'dev_v3.x', 'latest')
 */
function normalizeVersion(version: string): string {
  if (version.startsWith('v')) {
    return version;
  }
  // Only add 'v' prefix if version contains only numbers and dots
  return /^[\d.]+$/.test(version) ? `v${version}` : version;
}

/**
 * Build fcli download URL from version
 */
function buildFcliUrl(version: string): string {
  const normalizedVersion = normalizeVersion(version);
  const platform = os.platform();
  let archiveName: string;
  
  if (platform === 'win32') {
    archiveName = 'fcli-windows.zip';
  } else if (platform === 'darwin') {
    archiveName = 'fcli-mac.tgz';
  } else {
    archiveName = 'fcli-linux.tgz';
  }
  
  return `https://github.com/fortify/fcli/releases/download/${normalizedVersion}/${archiveName}`;
}

/**
 * Get default bootstrap configuration
 */
export function getDefaultConfig(): BootstrapConfig {
  return {
    fcliUrl: buildFcliUrl(FCLI_VERSION),
    verifySignature: true
  };
}

/**
 * Load configuration from file (with defaults)
 */
export function loadConfig(): BootstrapConfig {
  const defaults = getDefaultConfig();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return defaults;
  }
  
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const saved = JSON.parse(content);
    return { ...defaults, ...saved };
  } catch (error) {
    defaultLogger.warn(`Warning: Failed to load config from ${CONFIG_FILE}: ${formatError(error)}`);
    return defaults;
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: BootstrapConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Reset configuration to defaults (delete config file and clear bootstrap cache)
 */
export function resetConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
  
  // Clear bootstrap cache to force re-download with new config
  const bootstrapDir = getTempDir();
  if (fs.existsSync(bootstrapDir)) {
    fs.rmSync(bootstrapDir, { recursive: true, force: true });
  }
}

/**
 * Get effective configuration (config file + env overrides + runtime options)
 */
export function getEffectiveConfig(options: BootstrapOptions = {}): BootstrapConfig {
  const fileConfig = loadConfig();
  
  // Environment variable overrides
  const envOverrides: Partial<BootstrapConfig> = {};
  
  if (process.env.FCLI_BOOTSTRAP_CACHE_DIR) {
    envOverrides.cacheDir = process.env.FCLI_BOOTSTRAP_CACHE_DIR;
  }
  
  if (process.env.FCLI_BOOTSTRAP_URL) {
    envOverrides.fcliUrl = process.env.FCLI_BOOTSTRAP_URL;
  }
  
  if (process.env.FCLI_BOOTSTRAP_RSA_SHA256_URL) {
    envOverrides.fcliRsaSha256Url = process.env.FCLI_BOOTSTRAP_RSA_SHA256_URL;
  }
  
  if (process.env.FCLI_BOOTSTRAP_VERIFY_SIGNATURE !== undefined) {
    envOverrides.verifySignature = process.env.FCLI_BOOTSTRAP_VERIFY_SIGNATURE === 'true';
  }
  
  if (process.env.FCLI_BOOTSTRAP_PATH) {
    envOverrides.fcliPath = process.env.FCLI_BOOTSTRAP_PATH;
  }
  
  // Runtime options take highest precedence
  const finalConfig: BootstrapConfig = {
    ...fileConfig,
    ...envOverrides,
    ...(options.cacheDir && { cacheDir: options.cacheDir }),
    ...(options.fcliUrl && { fcliUrl: options.fcliUrl }),
    ...(options.fcliRsaSha256Url && { fcliRsaSha256Url: options.fcliRsaSha256Url }),
    ...(options.verifySignature !== undefined && { verifySignature: options.verifySignature }),
    ...(options.fcliPath && { fcliPath: options.fcliPath })
  };
  
  // If FCLI_BOOTSTRAP_VERSION env var is set but URL is NOT explicitly set,
  // build URL from version (FCLI_BOOTSTRAP_URL takes precedence)
  const hasExplicitUrl = envOverrides.fcliUrl || options.fcliUrl;
  const versionEnvVar = process.env.FCLI_BOOTSTRAP_VERSION;
  if (versionEnvVar && !hasExplicitUrl) {
    finalConfig.fcliUrl = buildFcliUrl(versionEnvVar);
  }
  
  // Validate URLs if present
  if (finalConfig.fcliUrl) {
    validateUrl(finalConfig.fcliUrl, 'fcli-url');
  }
  if (finalConfig.fcliRsaSha256Url) {
    validateUrl(finalConfig.fcliRsaSha256Url, 'fcli-rsa-sha256-url');
  }
  
  return finalConfig;
}

/**
 * Get bootstrap directory for downloaded fcli
 * @param config Optional bootstrap configuration to use custom cache directory
 * @returns Cache directory path (default: ~/.fortify/fcli/bootstrap)
 */
export function getTempDir(config?: BootstrapConfig): string {
  if (config?.cacheDir) {
    return config.cacheDir;
  }
  return path.join(os.homedir(), '.fortify', 'fcli', 'bootstrap');
}

/**
 * Get full path to bootstrapped fcli binary
 * @param config Optional bootstrap configuration to use custom cache directory
 * @returns Path to fcli binary
 */
export function getBootstrapBinPath(config?: BootstrapConfig): string {
  return path.join(getTempDir(config), 'bin', os.platform() === 'win32' ? 'fcli.exe' : 'fcli');
}


