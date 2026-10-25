import argon2 from "argon2";

export type PasswordHasherOptions = {
  pepper?: string;
};

function withPepper(password: string, pepper?: string): string {
  return pepper ? `${pepper}:${password}` : password;
}

/** Argon2id hash — never log the input or output. */
export async function hashPassword(
  password: string,
  options: PasswordHasherOptions = {},
): Promise<string> {
  return argon2.hash(withPepper(password, options.pepper), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/** Constant-time verification via argon2. */
export async function verifyPassword(
  passwordHash: string,
  password: string,
  options: PasswordHasherOptions = {},
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, withPepper(password, options.pepper));
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
