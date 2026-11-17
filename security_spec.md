# Security Specification (`security_spec.md`) — Louvor IEB Horta

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every unmatched document path must default to `allow read, write: if false;`.
2. **Verified Owner Isolation**: Only a signed-in user with `request.auth.token.email_verified == true` and `request.auth.uid == userId` can read or write `/workspaces/{userId}` and `/workspaces/{userId}/songs/{songId}`.
3. **Master Gate Relational Sync**: A `CustomSong` at `/workspaces/{userId}/songs/{songId}` can only be created, updated, or deleted if the parent document `/workspaces/{userId}` exists and its `ownerId` equals `request.auth.uid`.
4. **Strict Key & Schema Enforcement**: All writes to `UserWorkspace` and `CustomSong` must pass `isValidUserWorkspace` or `isValidCustomSong`, enforcing exact key allowlists (`hasAll` and `hasOnly`), string length bounds, numeric bounds, array size bounds, and valid categories.
5. **Temporal & Identity Immutability**: `ownerId` and `createdAt` are immutable after document creation, and `createdAt` / `updatedAt` must equal `request.time`.
6. **Secure List Queries**: `allow list` on `/workspaces/{userId}/songs` enforces `request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without invoking `get()` or `exists()`.

## 2. The "Dirty Dozen" Payloads

1. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempting to create `/workspaces/{userId}`.
2. **Cross-Tenant Workspace Write**: Authenticated user `uid: "attacker"` attempting to write to `/workspaces/victim` with `ownerId: "victim"`.
3. **OwnerId Spoofing on Create**: Authenticated user `uid: "user_1"` creating `/workspaces/user_1` with `ownerId: "user_2"`.
4. **Shadow Field Injection on Create**: Creating `/workspaces/user_1` with an undeclared field `isAdmin: true`.
5. **Client Timestamp Forgery**: Creating `/workspaces/user_1` with a past or future client timestamp instead of `request.time`.
6. **Immutable `createdAt` Tampering on Update**: Updating `/workspaces/user_1` while mutating `createdAt`.
7. **Immutable `ownerId` Transfer on Update**: Updating `/workspaces/user_1` while changing `ownerId` to another UID.
8. **Unbounded Array Exhaustion ("Denial of Wallet")**: Sending `playlistSongIds` with 101 items (exceeding limit of 100).
9. **Oversized String Payload ("Value Poisoning")**: Sending `playlistTitle` with 500 characters (exceeding `maxLength: 200`).
10. **Orphaned Subcollection Write (Master Gate Bypass)**: Creating `/workspaces/user_1/songs/song_1` when `/workspaces/user_1` does not exist.
11. **Invalid Enum Injection on Song**: Creating `/workspaces/user_1/songs/song_1` with `category: "Rock"` (not in `['Normal', 'Crianças', 'Hinos']`).
12. **Path Variable ID Poisoning**: Creating `/workspaces/user_1/songs/invalid id with spaces!` violating `^[a-zA-Z0-9_\-]+$`.
