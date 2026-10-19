import { createHash } from 'node:crypto';

/**
 * Shared integrity rules for versioned conforme documents (onboarding conformes and addendum conformes):
 * stored content is hashed once at issue, signers bind to the version and hash they were shown, and any
 * drift between stored content and its recorded hash is treated as tampering.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** True when the stored content still hashes to the hash recorded when the version was issued. */
export function isIntactContent(content: string, recordedSha256: string): boolean {
  return sha256Hex(content) === recordedSha256;
}

/** True when the signer's displayed version and hash match the stored version exactly. */
export function matchesDisplayedVersion(
  stored: { version: number; documentSha256: string },
  displayed: { version: number; documentSha256: string },
): boolean {
  return stored.version === displayed.version && stored.documentSha256 === displayed.documentSha256.toLowerCase();
}

/** Request metadata is kept only as one-way hashes on the signature record. */
export function hashSigningMetadata(metadata: { ip?: string; userAgent?: string }) {
  return {
    ipHash: metadata.ip ? sha256Hex(metadata.ip) : null,
    userAgentHash: metadata.userAgent ? sha256Hex(metadata.userAgent) : null,
  };
}
