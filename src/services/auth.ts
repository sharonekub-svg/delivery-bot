import * as repo from '../lib/repo';
import { getTenbisClient } from '../tenbis';

/**
 * 10Bis login orchestration. Login is SMS one-time-code, so it's two phases:
 *  - startLogin  -> triggers the SMS to the account phone
 *  - completeLogin(code) -> verifies and persists the (encrypted) session
 *
 * In WhatsApp this maps to: bot asks for the code -> user forwards it -> done.
 */
export async function setEmail(userId: string, email: string): Promise<void> {
  await repo.setTenbisEmail(userId, email.trim());
}

/** Request an SMS code for the user's stored 10Bis email. */
export async function startLogin(userId: string): Promise<void> {
  const email = await repo.getTenbisEmail(userId);
  if (!email) throw new Error('no 10Bis email on file');
  const challenge = await getTenbisClient().requestLoginCode(email);
  await repo.savePendingLogin(userId, challenge.pending);
}

/** Verify the SMS code the user sent back; stores the session on success. */
export async function completeLogin(userId: string, code: string): Promise<boolean> {
  const email = await repo.getTenbisEmail(userId);
  const pending = await repo.loadPendingLogin(userId);
  if (!email || !pending) return false;
  try {
    const session = await getTenbisClient().verifyLoginCode(email, code.trim(), { pending });
    await repo.saveSession(userId, session);
    await repo.clearPendingLogin(userId);
    return true;
  } catch {
    return false;
  }
}

/** True if we're mid-login (awaiting the SMS code). */
export async function awaitingCode(userId: string): Promise<boolean> {
  return (await repo.loadPendingLogin(userId)) !== null;
}
