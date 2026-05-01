import { describe, expect, test } from 'vitest';
import { loadConfig } from '../src/config';

describe('auth-api: config loading', () => {
  test('loadConfig: successfully parses valid environment variables', () => {
    const validEnv = {
      DATABASE_URL: 'postgresql://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_PRIVATE_KEY_PEM: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
      JWT_PUBLIC_KEY_PEM: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
      JWT_ACCESS_TTL: '900',
      JWT_REFRESH_TTL: '604800',
      JWT_ISSUER: 'test',
      JWT_AUDIENCE: 'test.api',
    };
    const config = loadConfig(validEnv);
    expect(config.DATABASE_URL).toBe('postgresql://localhost/test');
    expect(config.REDIS_URL).toBe('redis://localhost:6379');
    expect(config.JWT_PRIVATE_KEY_PEM).toBe(validEnv.JWT_PRIVATE_KEY_PEM);
    expect(config.JWT_AUDIENCE).toBe('test.api');
  });

  test('loadConfig: throws on missing DATABASE_URL', () => {
    const invalidEnv = {
      REDIS_URL: 'redis://localhost:6379',
      JWT_PRIVATE_KEY_PEM: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
      JWT_PUBLIC_KEY_PEM: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
    };
    expect(() => loadConfig(invalidEnv)).toThrow();
  });

  test('loadConfig: throws on invalid DATABASE_URL (not a URL)', () => {
    const invalidEnv = {
      DATABASE_URL: 'not-a-url',
      REDIS_URL: 'redis://localhost:6379',
      JWT_PRIVATE_KEY_PEM: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
      JWT_PUBLIC_KEY_PEM: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
    };
    expect(() => loadConfig(invalidEnv)).toThrow();
  });

  test('loadConfig: throws on empty JWT_PRIVATE_KEY_PEM', () => {
    const invalidEnv = {
      DATABASE_URL: 'postgresql://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_PRIVATE_KEY_PEM: '',
      JWT_PUBLIC_KEY_PEM: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
    };
    expect(() => loadConfig(invalidEnv)).toThrow();
  });

  test('loadConfig: throws on missing REDIS_URL', () => {
    const invalidEnv = {
      DATABASE_URL: 'postgresql://localhost/test',
      JWT_PRIVATE_KEY_PEM: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
      JWT_PUBLIC_KEY_PEM: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
    };
    expect(() => loadConfig(invalidEnv)).toThrow();
  });

  test('loadConfig: applies default values for JWT_ACCESS_TTL', () => {
    const validEnv = {
      DATABASE_URL: 'postgresql://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_PRIVATE_KEY_PEM: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
      JWT_PUBLIC_KEY_PEM: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
    };
    const config = loadConfig(validEnv);
    expect(config.JWT_ACCESS_TTL).toBe(900);
  });

  test('loadConfig: applies default values for JWT_ISSUER', () => {
    const validEnv = {
      DATABASE_URL: 'postgresql://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_PRIVATE_KEY_PEM: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
      JWT_PUBLIC_KEY_PEM: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
    };
    const config = loadConfig(validEnv);
    expect(config.JWT_ISSUER).toBe('lambder');
  });

  test('loadConfig: overrides default JWT_ISSUER when provided', () => {
    const validEnv = {
      DATABASE_URL: 'postgresql://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_PRIVATE_KEY_PEM: '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
      JWT_PUBLIC_KEY_PEM: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
      JWT_ISSUER: 'custom-issuer',
    };
    const config = loadConfig(validEnv);
    expect(config.JWT_ISSUER).toBe('custom-issuer');
  });
});
