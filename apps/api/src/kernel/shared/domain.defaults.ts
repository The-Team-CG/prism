import { randomUUID } from 'node:crypto';
import type { SeatCategory } from './domain.types';

export const defaultSeatCategories = (): SeatCategory[] => [
  { id: randomUUID(), name: 'VIP', colorHex: '#4f7a5e' },
  { id: randomUUID(), name: 'Standard', colorHex: '#d3d9d5' },
];
