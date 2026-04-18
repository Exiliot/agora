/**
 * Extract @mentions from a message body.
 *
 * A mention is `@` followed by a username-shaped token, preceded by start
 * of string or whitespace so email addresses like `bob@agora.test` don't
 * trigger a bogus mention of `agora`. Usernames follow the schema in
 * `@agora/shared/users`: lowercase alphanumeric with `.`, `_`, `-`, starting
 * with an alphanumeric.
 *
 * Returns the deduped set as lowercased usernames in first-seen order.
 */
const MENTION_RE = /(?:^|\s)@([a-z0-9][a-z0-9._-]*)/gi;

export const extractMentions = (body: string): string[] => {
  const seen = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    const raw = match[1];
    if (raw) seen.add(raw.toLowerCase());
  }
  return Array.from(seen);
};
