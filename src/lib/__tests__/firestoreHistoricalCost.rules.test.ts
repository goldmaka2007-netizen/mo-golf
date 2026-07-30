import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const rulesDescribe = emulatorHost ? describe : describe.skip;
const [host, rawPort] = (emulatorHost ?? '127.0.0.1:8080').split(':');
const port = Number(rawPort);
const projectId = 'makka-central-accounting-rules-test';
const collectionName = 'historicalCostReviewOverlays';
let testEnv: RulesTestEnvironment;

const overlay = (
  uid: string,
  overlayId: string,
  status: 'draft' | 'approved' | 'rejected' = 'draft',
  version = 1,
  supersedesOverlayId: string | null = null,
) => ({
  overlayId,
  overlayVersion: version,
  schemaVersion: 'historical-cost-review-v1',
  targetOperationId: 'historical-operation-1',
  overlayType: 'merchant_receipt_cost',
  originalDiagnosticCode: 'unresolved_merchant_cost',
  approvedInterpretedCostMinor: 125000,
  pricePerGramMinor: null,
  valueBasis: 'total',
  sourceType: 'original_invoice',
  sourceReference: 'invoice-1',
  approver: status === 'approved' ? 'Owner' : '',
  createdAt: '2026-07-29T00:00:00.000Z',
  approvedAt: status === 'approved' ? '2026-07-29T01:00:00.000Z' : null,
  supersedesOverlayId,
  status,
  sourceInventoryAccountId: null,
  notes: 'audited historical assignment',
  confidenceNote: '',
  historicalAssignmentConfirmed: status === 'approved',
  userId: uid,
  ownerId: uid,
  createdBy: uid,
  auditHash: 'a'.repeat(64),
});

rulesDescribe('historicalCostReviewOverlays Firestore rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host,
        port,
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it('allows the owner to create, update, and approve a draft', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore();
    const ref = doc(db, collectionName, 'draft-1');
    await assertSucceeds(setDoc(ref, overlay('owner-a', 'draft-1')));
    await assertSucceeds(updateDoc(ref, {
      notes: 'updated draft evidence',
      auditHash: 'b'.repeat(64),
    }));
    await assertSucceeds(setDoc(ref, {
      ...overlay('owner-a', 'draft-1', 'approved'),
      notes: 'updated draft evidence',
      auditHash: 'c'.repeat(64),
    }));
    expect((await getDoc(ref)).data()?.status).toBe('approved');
  });

  it('rejects an unauthenticated write', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(
      doc(db, collectionName, 'anonymous-draft'),
      overlay('owner-a', 'anonymous-draft'),
    ));
  });

  it('rejects access by another user', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-a').firestore();
    const ref = doc(ownerDb, collectionName, 'private-draft');
    await assertSucceeds(setDoc(ref, overlay('owner-a', 'private-draft')));

    const otherDb = testEnv.authenticatedContext('owner-b').firestore();
    await assertFails(getDoc(doc(otherDb, collectionName, 'private-draft')));
    await assertFails(updateDoc(doc(otherDb, collectionName, 'private-draft'), {
      notes: 'other user edit',
    }));
  });

  it('keeps an approved overlay immutable and undeletable', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore();
    const ref = doc(db, collectionName, 'approved-v1');
    await assertSucceeds(setDoc(ref, overlay('owner-a', 'approved-v1', 'approved')));
    await assertFails(updateDoc(ref, { notes: 'mutation attempt' }));
    await assertFails(deleteDoc(ref));
  });

  it('allows a new immutable version that supersedes the owner approved overlay', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore();
    await assertSucceeds(setDoc(
      doc(db, collectionName, 'approved-v1'),
      overlay('owner-a', 'approved-v1', 'approved'),
    ));
    await assertSucceeds(setDoc(
      doc(db, collectionName, 'approved-v2'),
      overlay('owner-a', 'approved-v2', 'approved', 2, 'approved-v1'),
    ));
  });
});