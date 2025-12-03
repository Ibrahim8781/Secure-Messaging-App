# STRIDE Threat Model Analysis

## 1. Spoofing Identity
**Threat:** An attacker impersonates a valid user during key exchange to intercept messages.
**Mitigation (Implemented):**
- **RSA-PSS Signatures:** Every key exchange step includes a digital signature created with the user's private signing key.
- **Verification:** The backend verifies these signatures against the stored public keys before establishing a session.
- **Authentication:** All API routes require a valid JWT token.

## 2. Tampering with Data
**Threat:** An attacker modifies ciphertext or keys in transit (MITM).
**Mitigation (Implemented):**
- **AES-GCM:** We use Authenticated Encryption (GCM mode). Any modification to the ciphertext destroys the integrity tag, causing decryption to fail on the client side.
- **Signed Handshake:** The initial key exchange parameters are signed. If an attacker modifies the ephemeral key, the signature verification fails.

## 3. Repudiation
**Threat:** A user denies sending a message.
**Mitigation (Implemented):**
- **Digital Signatures:** The key exchange is cryptographically signed, proving the user participated in the session setup.
- **Backend Logs:** The server logs key exchange initiations and confirmations (metadata only) to audit actions.

## 4. Information Disclosure
**Threat:** The server or an eavesdropper reads the message content.
**Mitigation (Implemented):**
- **End-to-End Encryption:** Messages are encrypted on the client using Web Crypto API.
- **Zero-Knowledge Server:** The server only stores encrypted blobs (`ciphertext`) and public keys. It never sees private keys or plaintext.
- **TLS/HTTPS:** All transport is secured (Requirement for deployment).

## 5. Denial of Service (DoS)
**Threat:** An attacker floods the server with fake key exchange requests.
**Mitigation (Implemented):**
- **Rate Limiting:** `express-rate-limit` is configured on the backend to limit requests per IP.
- **Validation:** Requests with invalid timestamps or missing fields are rejected immediately before expensive crypto operations.

## 6. Elevation of Privilege
**Threat:** A user accesses messages belonging to another user.
**Mitigation (Implemented):**
- **Access Control:** MongoDB queries strictly filter messages by `from` and `to` fields matching the authenticated user ID.
- **Key Isolation:** Private keys are stored in `IndexedDB` on the client device and are non-exportable via standard means in our crypto logic.