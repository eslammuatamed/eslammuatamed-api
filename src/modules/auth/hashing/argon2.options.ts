import * as argon2 from 'argon2';

// Meets/exceeds the OWASP minimum for argon2id (D19-1): 64 MiB memory, 3 iterations, parallelism 4.
// Parameters live here (revisited yearly, doc 19 §2) and are shared by the runtime
// PasswordService and the seed script so hashes are produced identically everywhere.
export const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};
