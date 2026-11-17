/**
 * Phase 0 Test Runner for Firestore Security Rules (`firestore.rules.test.ts`)
 * Verifies that all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Unverified Email Spoof',
    collectionPath: '/workspaces/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    payload: { ownerId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-Tenant Workspace Write',
    collectionPath: '/workspaces/victim_1',
    operation: 'create',
    auth: { uid: 'attacker_1', email_verified: true },
    payload: { ownerId: 'victim_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'OwnerId Spoofing on Create',
    collectionPath: '/workspaces/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Create',
    collectionPath: '/workspaces/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Client Timestamp Forgery',
    collectionPath: '/workspaces/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Immutable createdAt Tampering on Update',
    collectionPath: '/workspaces/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { createdAt: '2030-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immutable ownerId Transfer on Update',
    collectionPath: '/workspaces/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Unbounded Array Exhaustion',
    collectionPath: '/workspaces/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      ownerId: 'user_1',
      playlistSongIds: new Array(101).fill('song-1'),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Oversized String Payload (Value Poisoning)',
    collectionPath: '/workspaces/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      playlistTitle: 'A'.repeat(500),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Subcollection Write (Master Gate Bypass)',
    collectionPath: '/workspaces/user_without_workspace/songs/song_1',
    operation: 'create',
    auth: { uid: 'user_without_workspace', email_verified: true },
    payload: {
      id: 'song_1',
      ownerId: 'user_without_workspace',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Invalid Enum Injection on Song',
    collectionPath: '/workspaces/user_1/songs/song_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      id: 'song_1',
      ownerId: 'user_1',
      category: 'InvalidCategory',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Path Variable ID Poisoning',
    collectionPath: '/workspaces/user_1/songs/invalid id!',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      id: 'invalid id!',
      ownerId: 'user_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
