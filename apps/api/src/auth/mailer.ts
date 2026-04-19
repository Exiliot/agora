/**
 * Mailer seam. In demo mode (AGORA_DEMO_MODE=1) the password-reset handler
 * logs the link to stdout and never calls this. In any other mode the
 * handler calls sendResetEmail and expects a real mailer wired here.
 *
 * The default implementation is a no-op that warns; a deployment that
 * wants functional password reset must replace this with a real
 * transport (nodemailer, SES, Postmark, whatever).
 */
import { config } from '../config.js';

export interface ResetEmailArgs {
  to: string;
  link: string;
}

export const sendResetEmail = async (args: ResetEmailArgs): Promise<void> => {
  // eslint-disable-next-line no-console
  console.warn(
    '[mailer] sendResetEmail called but no transport is wired; reset link will not reach the user.',
    { to: args.to, demoMode: config.AGORA_DEMO_MODE },
  );
};
