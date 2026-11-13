// The accounts of a live run come from a file outside the repository, so no password is in git,
// in a worktree, or in the shell history. A value from the shell wins over the file.
// Never print a value of this file: the caller gets the names only.

import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export const DEFAULT_ENV_FILE = 'D:/runenv/verify.env';

export const envFilePath = (env = process.env) => env.VERIFY_ENV_FILE || DEFAULT_ENV_FILE;

/** Sets the missing VERIFY_ variables of `env` from the file. Returns the names it set, sorted. */
export function loadVerifyEnv({ target, env = process.env, read = (path) => readFileSync(path, 'utf8') }) {
  if (target !== 'live') return [];
  let text;
  try {
    text = read(envFilePath(env));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Cannot read ${envFilePath(env)} (${error.code ?? error.message}). Fix the file or VERIFY_ENV_FILE.`);
  }
  const loaded = [];
  // Notepad and PowerShell 5 write a BOM, and parseEnv would keep it in the first name.
  for (const [name, value] of Object.entries(parseEnv(text.replace(/^FEFF/, '')))) {
    if (!name.startsWith('VERIFY_') || value === '' || env[name]) continue;
    env[name] = value;
    loaded.push(name);
  }
  return loaded.sort();
}
