export const FILE_REQUIREMENT_COMMANDS = Symbol('FILE_REQUIREMENT_COMMANDS');
export const FILE_REQUIREMENT_READER = Symbol('FILE_REQUIREMENT_READER');
/**
 * Intentionally unbound: W10 moved signed uploads to
 * `platform-ops/contracts/storage/storage.port.ts`. The only implementation
 * left is the deprecated `MetadataOnlySignedUploadUrlFactory` shim, which is
 * never registered as a provider. Do not add this token to a module's
 * `exports` unless something also provides it — Nest fails module scanning
 * with `UnknownExportException` and the API never opens its port.
 */
export const SIGNED_UPLOAD_URL_FACTORY = Symbol('SIGNED_UPLOAD_URL_FACTORY');
