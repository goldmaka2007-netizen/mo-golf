import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('historical cost overlay Firestore sync', () => {
  it('uses an owner-scoped query that matches Firestore rules for every user', () => {
    const source = readFileSync(
      new URL('../../hooks/useDataSync.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain("where('userId', '==', user.uid)");
    expect(source).toContain("where('ownerId', '==', user.uid)");
    expect(source).toContain("where('createdBy', '==', user.uid)");
    expect(source).not.toContain("? query(collection(db, 'historicalCostReviewOverlays'))");
  });
});