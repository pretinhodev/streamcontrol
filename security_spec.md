# Security Specification for LiveDeck

## Data Invariants
- A UserProfile can only be created/read/updated by the user with the matching UID.
- Connections belong to a specific user and can only be managed by that user.
- Root connections cannot be created outside the `/users/{uid}/connections` path.

## The Dirty Dozen Payloads
1. Attempt to create a profile for another UID.
2. Attempt to read someone else's profile.
3. Attempt to update another user's email.
4. Attempt to create a connection for another user.
5. Attempt to read someone else's connections.
6. Attempt to delete someone else's connection.
7. Attempt to inject an XSS script into the `displayName`.
8. Attempt to use a massive document ID (resource poisoning).
9. Attempt to update `createdAt` field (immutable).
10. Attempt to create a connection with an invalid platform type.
11. Attempt to create a profile without the required `email` field.
12. Attempt to write to a non-existent path like `/admin_config`.

## Rules Draft Strategy
- Use `isValidUserProfile` and `isValidConnection` helpers.
- Use `request.auth.uid` validation everywhere.
- Deny all by default.
