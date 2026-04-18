/**
 * Per-user "what conversation are you looking at right now?" registry.
 *
 * Populated by the `client.focus` WS event and cleared when the last
 * connection for a user drops. The notifications publisher consults
 * `matches(userId, subjectType, subjectId)` to skip inserting a row for a
 * DM or room the user is actively viewing – the live UI already reflects
 * the message, so a bell entry on top would be noise.
 *
 * In-memory only: if the process restarts, focus is lost and the next
 * client.focus from each live tab restores it. Matches agora's decision
 * to keep presence-like ephemeral state out of Postgres (ADR-0003).
 */

interface FocusRecord {
  subjectType: 'room' | 'dm' | 'user';
  subjectId: string;
}

const byUser = new Map<string, FocusRecord>();

export const userFocusRegistry = {
  get(userId: string): FocusRecord | undefined {
    return byUser.get(userId);
  },
  set(userId: string, subjectType: FocusRecord['subjectType'], subjectId: string): void {
    byUser.set(userId, { subjectType, subjectId });
  },
  clear(userId: string): void {
    byUser.delete(userId);
  },
  matches(
    userId: string,
    subjectType: FocusRecord['subjectType'],
    subjectId: string,
  ): boolean {
    const rec = byUser.get(userId);
    return rec !== undefined && rec.subjectType === subjectType && rec.subjectId === subjectId;
  },
  _clearAll(): void {
    byUser.clear();
  },
};
