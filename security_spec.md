# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document inside `/users/{userId}` and its subcollections (`projects`, `files`, `images`, `memos`, `orders`, `messages`) is readable and writable exclusively by the verified authenticated user whose `request.auth.uid == userId` and `data.ownerId == request.auth.uid`.
2. **Master Gate Verification**: Any write to a subcollection requires the parent `/users/{userId}` document to exist (`exists(...)` or `existsAfter(...)`).
3. **Referential Project Integrity**: When an item references a non-empty `projectId`, that project must exist under `/users/{userId}/projects/{projectId}`.
4. **Immutable Ownership & Creation Time**: `ownerId`, `id`, and `createdAt` can never be mutated on update; `createdAt == request.time` on create and `updatedAt == request.time` on create and update.
5. **Terminal State Locking**: Work orders whose `status` reaches `'done'` cannot be modified afterward (deletion by owner remains permitted).
6. **Strict Field Allowlisting & Size Bounds**: Every collection enforces exact `keys().hasAll(...) && keys().hasOnly(...)` and bounded string/list lengths to prevent shadow fields and resource exhaustion.

## 2. The "Dirty Dozen" Attack Payloads
1. **Cross-User Read Attempt**: User B (`uid: user_b`) queries `GET /users/user_a/files/file_1` -> `PERMISSION_DENIED`.
2. **Cross-User List Scrape**: User B queries `LIST /users/user_a/messages` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: User A creates `/users/user_a/memos/m1` with `ownerId: "user_b"` -> `PERMISSION_DENIED`.
4. **Unverified Email Write**: User with `email_verified: false` attempts `CREATE /users/user_a/orders/o1` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: User A creates a file with an extra unexpected key `isAdmin: true` -> `PERMISSION_DENIED`.
6. **Path ID Poisoning**: User A writes to `/users/user_a/files/bad$id/../../../etc` or a 300-character document ID -> `PERMISSION_DENIED`.
7. **Timestamp Forgery on Create**: User A supplies a backdated `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: User A updates a work order attempting to change `createdAt` or `ownerId` -> `PERMISSION_DENIED`.
9. **Orphaned Project Reference**: User A creates a memo referencing `projectId: "nonexistent_proj"` -> `PERMISSION_DENIED`.
10. **Terminal Work Order Mutation**: User A attempts to change a work order whose existing `status == 'done'` back to `'in_progress'` -> `PERMISSION_DENIED`.
11. **Oversized Payload / Denial-of-Wallet**: User A injects a 100KB `title` string or a `linkedFileIds` array with 50 items (max 20) -> `PERMISSION_DENIED`.
12. **Invalid Enum Injection**: User A sets `domain: "personal"` or `category: "exe"` -> `PERMISSION_DENIED`.
