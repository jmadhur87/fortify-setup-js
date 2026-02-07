/**
 * Tests for configuration management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock file system operations BEFORE importing config module
vi.mock('fs');
vi.mock('os', () => ({
  default: {
    platform: vi.fn(() => 'linux'),
    homedir: vi.fn(() => '/home/user')
  },
  platform: vi.fn(() => 'linux'),
  homedir: vi.fn(() => '/home/user')
}));

import {
  getFcliVersion,
  getDefaultConfig,
  loadConfig,
  saveConfig,
  resetConfig,
  getEffectiveConfig,
  getTempDir,
  getBootstrapBinPath
} from './config.js';

describe('getFcliVersion', () => {
  it('should return fixed version v3', () => {
    expect(getFcliVersion()).toBe('v3');
  });
});

describe('getDefaultConfig', () => {
  it('should return default config for Windows', () => {
    vi.mocked(os.platform).mockReturnValue('win32');
    
    const config = getDefaultConfig();
    
    expect(config.fcliUrl).toContain('fcli-windows.zip');
    expect(config.fcliUrl).toContain('/v3/');
    expect(config.verifySignature).toBe(true);
  });

  it('should return default config for macOS', () => {
    vi.mocked(os.platform).mockReturnValue('darwin');
    
    const config = getDefaultConfig();
    
    expect(config.fcliUrl).toContain('fcli-mac.tgz');
    expect(config.fcliUrl).toContain('/v3/');
    expect(config.verifySignature).toBe(true);
  });

  it('should return default config for Linux', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    
    const config = getDefaultConfig();
    
    expect(config.fcliUrl).toContain('fcli-linux.tgz');
    expect(config.fcliUrl).toContain('/v3/');
    expect(config.verifySignature).toBe(true);
  });

  it('should include GitHub release URL structure', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    
    const config = getDefaultConfig();
    
    expect(config.fcliUrl).toContain('github.com/fortify/fcli/releases');
  });
});

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(os.homedir).mockReturnValue('/home/user');
  });

  it('should return defaults when config file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    const config = loadConfig();
    
    expect(config.verifySignature).toBe(true);
    expect(config.fcliUrl).toContain('fcli-linux.tgz');
  });

  it('should load and merge saved config with defaults', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      fcliUrl: 'https://custom.url/fcli.tgz',
      verifySignature: false
    }));
    
    const config = loadConfig();
    
    expect(config.fcliUrl).toBe('https://custom.url/fcli.tgz');
    expect(config.verifySignature).toBe(false);
  });

  it('should return defaults on JSON parse error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid json {');
    
    const config = loadConfig();
    
    expect(config.verifySignature).toBe(true);
    expect(config.fcliUrl).toBeDefined();
  });

  it('should return defaults on file read error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });
    
    const config = loadConfig();
    
    expect(config.verifySignature).toBe(true);
    expect(config.fcliUrl).toBeDefined();
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it('should create config directory if it does not exist', () => {
    const config = { fcliUrl: 'https://example.com/fcli.tgz', verifySignature: true };
    
    saveConfig(config);
    
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.config/fortify/setup'),
      { recursive: true }
    );
  });

  it('should write config as formatted JSON', () => {
    const config = { fcliUrl: 'https://example.com/fcli.tgz', verifySignature: false };
    
    saveConfig(config);
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expect.stringContaining('fcli.tgz'),
      'utf-8'
    );
  });

  it('should not create directory if it already exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const config = { fcliUrl: 'https://example.com/fcli.tgz', verifySignature: true };
    
    saveConfig(config);
    
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});

describe('resetConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/user');
  });

  it('should delete config file if it exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return String(path).includes('config.json');
    });
    
    resetConfig();
    
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('config.json'));
  });

  it('should delete bootstrap cache directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    resetConfig();
    
    expect(fs.rmSync).toHaveBeenCalledWith(
      expect.stringContaining('.fortify/fcli/bootstrap'),
      { recursive: true, force: true }
    );
  });

  it('should handle missing config file gracefully', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    expect(() => resetConfig()).not.toThrow();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});

describe('getEffectiveConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(fs.existsSync).mockReturnValue(false);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return defaults with no overrides', () => {
    const config = getEffectiveConfig();
    
    expect(config.verifySignature).toBe(true);
    expect(config.fcliUrl).toContain('fcli-linux.tgz');
  });

  it('should apply environment variable overrides', () => {
    process.env.FCLI_BOOTSTRAP_URL = 'https://env.url/fcli.tgz';
    process.env.FCLI_BOOTSTRAP_VERIFY_SIGNATURE = 'false';
    
    const config = getEffectiveConfig();
    
    expect(config.fcliUrl).toBe('https://env.url/fcli.tgz');
    expect(config.verifySignature).toBe(false);
  });

  it('should apply runtime options over environment variables', () => {
    process.env.FCLI_BOOTSTRAP_URL = 'https://env.url/fcli.tgz';
    
    const config = getEffectiveConfig({
      fcliUrl: 'https://runtime.url/fcli.tgz'
    });
    
    expect(config.fcliUrl).toBe('https://runtime.url/fcli.tgz');
  });

  it('should handle FCLI_BOOTSTRAP_PATH environment variable', () => {
    process.env.FCLI_BOOTSTRAP_PATH = '/custom/path/to/fcli';
    
    const config = getEffectiveConfig();
    
    expect(config.fcliPath).toBe('/custom/path/to/fcli');
  });

  it('should handle FCLI_BOOTSTRAP_RSA_SHA256_URL environment variable', () => {
    process.env.FCLI_BOOTSTRAP_RSA_SHA256_URL = 'https://example.com/signature';
    
    const config = getEffectiveConfig();
    
    expect(config.fcliRsaSha256Url).toBe('https://example.com/signature');
  });

  it('should build URL from FCLI_BOOTSTRAP_VERSION environment variable', () => {
    process.env.FCLI_BOOTSTRAP_VERSION = 'v3.6.1';
    
    const config = getEffectiveConfig();
    
    expect(config.fcliUrl).toBe('https://github.com/fortify/fcli/releases/download/v3.6.1/fcli-linux.tgz');
  });

  it('should normalize version without v prefix in FCLI_BOOTSTRAP_VERSION', () => {
    process.env.FCLI_BOOTSTRAP_VERSION = '3.14.1';
    
    const config = getEffectiveConfig();
    
    expect(config.fcliUrl).toBe('https://github.com/fortify/fcli/releases/download/v3.14.1/fcli-linux.tgz');
  });

  it('should not add v prefix to special version tags like dev_v3.x', () => {
    process.env.FCLI_BOOTSTRAP_VERSION = 'dev_v3.x';
    
    const config = getEffectiveConfig();
    
    expect(config.fcliUrl).toBe('https://github.com/fortify/fcli/releases/download/dev_v3.x/fcli-linux.tgz');
  });

  it('should not add v prefix to non-numeric version tags', () => {
    process.env.FCLI_BOOTSTRAP_VERSION = 'latest';
    
    const config = getEffectiveConfig();
    
    expect(config.fcliUrl).toBe('https://github.com/fortify/fcli/releases/download/latest/fcli-linux.tgz');
  });

  it('should add v prefix to numeric version without dots', () => {
    process.env.FCLI_BOOTSTRAP_VERSION = '3';
    
    const config = getEffectiveConfig();
    
    expect(config.fcliUrl).toBe('https://github.com/fortify/fcli/releases/download/v3/fcli-linux.tgz');
  });

  it('should prioritize FCLI_BOOTSTRAP_URL over FCLI_BOOTSTRAP_VERSION', () => {
    process.env.FCLI_BOOTSTRAP_VERSION = 'v3.6.1';
    process.env.FCLI_BOOTSTRAP_URL = 'https://custom.url/fcli.tgz';
    
    const config = getEffectiveConfig();
    
    expect(config.fcliUrl).toBe('https://custom.url/fcli.tgz');
  });

  it('should build different platform URLs from FCLI_BOOTSTRAP_VERSION', () => {
    process.env.FCLI_BOOTSTRAP_VERSION = 'v3.5.0';
    
    // Test Windows
    vi.mocked(os.platform).mockReturnValue('win32');
    let config = getEffectiveConfig();
    expect(config.fcliUrl).toBe('https://github.com/fortify/fcli/releases/download/v3.5.0/fcli-windows.zip');
    
    // Test macOS
    vi.mocked(os.platform).mockReturnValue('darwin');
    config = getEffectiveConfig();
    expect(config.fcliUrl).toBe('https://github.com/fortify/fcli/releases/download/v3.5.0/fcli-mac.tgz');
    
    // Test Linux
    vi.mocked(os.platform).mockReturnValue('linux');
    config = getEffectiveConfig();
    expect(config.fcliUrl).toBe('https://github.com/fortify/fcli/releases/download/v3.5.0/fcli-linux.tgz');
  });

  it('should throw error for invalid fcliUrl', () => {
    expect(() => getEffectiveConfig({ fcliUrl: 'not-a-url' })).toThrow('Invalid fcli-url');
  });

  it('should throw error for invalid fcliRsaSha256Url', () => {
    expect(() => getEffectiveConfig({ 
      fcliUrl: 'https://valid.url/fcli.tgz',
      fcliRsaSha256Url: 'not-a-url' 
    })).toThrow('Invalid fcli-rsa-sha256-url');
  });

  it('should handle verifySignature as boolean from options', () => {
    const config = getEffectiveConfig({ verifySignature: false });
    
    expect(config.verifySignature).toBe(false);
  });

  it('should merge file config, env, and runtime options correctly', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      fcliUrl: 'https://file.url/fcli.tgz',
      verifySignature: false
    }));
    process.env.FCLI_BOOTSTRAP_VERIFY_SIGNATURE = 'true';
    
    const config = getEffectiveConfig({
      fcliPath: '/runtime/fcli'
    });
    
    expect(config.fcliUrl).toBe('https://file.url/fcli.tgz'); // from file
    expect(config.verifySignature).toBe(true); // from env (overrides file)
    expect(config.fcliPath).toBe('/runtime/fcli'); // from runtime
  });
});

describe('getTempDir', () => {
  it('should return bootstrap directory path', () => {
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    
    const dir = getTempDir();
    
    expect(dir).toBe('/home/user/.fortify/fcli/bootstrap');
  });

  it('should use actual home directory', () => {
    vi.mocked(os.homedir).mockReturnValue('/root');
    
    const dir = getTempDir();
    
    expect(dir).toContain('/root/.fortify/fcli/bootstrap');
  });
});

describe('getBootstrapBinPath', () => {
  it('should return path with fcli.exe on Windows', () => {
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(os.platform).mockReturnValue('win32');
    
    const binPath = getBootstrapBinPath();
    
    expect(binPath).toContain('fcli.exe');
    expect(binPath).toContain('.fortify/fcli/bootstrap/bin');
  });

  it('should return path with fcli on Unix-like systems', () => {
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(os.platform).mockReturnValue('linux');
    
    const binPath = getBootstrapBinPath();
    
    expect(binPath).toContain('/bin/fcli');
    expect(binPath).not.toContain('.exe');
  });

  it('should return path with fcli on macOS', () => {
    vi.mocked(os.homedir).mockReturnValue('/Users/user');
    vi.mocked(os.platform).mockReturnValue('darwin');
    
    const binPath = getBootstrapBinPath();
    
    expect(binPath).toContain('/bin/fcli');
    expect(binPath).toContain('.fortify/fcli/bootstrap');
  });
});
