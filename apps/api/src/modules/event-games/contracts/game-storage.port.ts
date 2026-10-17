export const GAME_STORAGE = Symbol('GAME_STORAGE');

export interface GameStoragePort {
  putEventAsset(input: {
    eventId: string;
    assetId: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<{ storageKey: string }>;
  deleteEventAsset(input: { eventId: string; assetId: string }): Promise<void>;
}
