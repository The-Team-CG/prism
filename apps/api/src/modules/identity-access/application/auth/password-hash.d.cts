export interface ScryptParams {
  readonly N: number;
  readonly r: number;
  readonly p: number;
}

export interface ParsedScryptPasswordHash {
  params: ScryptParams;
  salt: string;
  derivedHex: string;
}

export declare const CURRENT_SCRYPT_PARAMS: Readonly<ScryptParams>;
export declare const KEY_LENGTH: 64;
export declare function formatScryptPasswordHash(input: ParsedScryptPasswordHash): string;
export declare function hashScryptPassword(password: string): Promise<string>;
export declare function isCurrentScryptPasswordHash(stored: string): boolean;
export declare function parseScryptPasswordHash(stored: string): ParsedScryptPasswordHash | null;
export declare function verifyScryptPassword(stored: string, candidate: string): Promise<boolean>;
