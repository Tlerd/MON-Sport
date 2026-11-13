// Proves the decisions of verify-flow/scripts/verify-env.mjs: a live run takes its accounts from a file
// outside the repository, and a value from the shell wins.

import { expect, test } from 'vitest';
import { DEFAULT_ENV_FILE, envFilePath, loadVerifyEnv } from '../.agents/skills/verify-flow/scripts/verify-env.mjs';

const file = 'VERIFY_OWNER_PHONE=0900000001\nVERIFY_OWNER_PASSWORD="p w#1"\n# a comment\nOTHER=x\nVERIFY_VENUE=\n';
const read = () => file;

test('a live run loads the VERIFY_ variables of the file and returns their names, never their values', () => {
  const env = {};
  const loaded = loadVerifyEnv({ target: 'live', env, read });
  expect(env.VERIFY_OWNER_PHONE).toBe('0900000001');
  expect(env.VERIFY_OWNER_PASSWORD).toBe('p w#1');
  expect(loaded).toEqual(['VERIFY_OWNER_PASSWORD', 'VERIFY_OWNER_PHONE']);
});

test('a variable of another name and an empty value are not loaded', () => {
  const env = {};
  loadVerifyEnv({ target: 'live', env, read });
  expect(env.OTHER).toBeUndefined();
  expect('VERIFY_VENUE' in env).toBe(false);
});

test('a value from the shell wins over the file', () => {
  const env = { VERIFY_OWNER_PHONE: '0911111111' };
  const loaded = loadVerifyEnv({ target: 'live', env, read });
  expect(env.VERIFY_OWNER_PHONE).toBe('0911111111');
  expect(loaded).toEqual(['VERIFY_OWNER_PASSWORD']);
});

test('a local run never reads the file', () => {
  const env = {};
  const loaded = loadVerifyEnv({ target: 'local', env, read: () => { throw new Error('read'); } });
  expect(loaded).toEqual([]);
  expect(env).toEqual({});
});

test('a missing file loads nothing and does not fail', () => {
  const missing = () => { throw Object.assign(new Error('no file'), { code: 'ENOENT' }); };
  expect(loadVerifyEnv({ target: 'live', env: {}, read: missing })).toEqual([]);
});

test('VERIFY_ENV_FILE picks the file, and the default is outside the repository', () => {
  expect(envFilePath({ VERIFY_ENV_FILE: 'E:/x/verify.env' })).toBe('E:/x/verify.env');
  expect(envFilePath({})).toBe(DEFAULT_ENV_FILE);
  expect(DEFAULT_ENV_FILE).toBe('D:/runenv/verify.env');
});
