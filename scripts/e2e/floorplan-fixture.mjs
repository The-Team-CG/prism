// The one-table venue the end-to-end suites approve as an event's official plan, as a Pascal scene in metres.
import { convertLegacyPlan, PASCAL_VERSION } from '@prism/floorplan-scene';

export function oneTableScene(name) {
  return convertLegacyPlan({
    name,
    widthM: 30,
    heightM: 20,
    objects: [{ id: 'table-1', kind: 'ellipse', name: 'Round Banquet (10pax)', category: 'furniture', x: 5, y: 5, w: 1.8, h: 1.8, rotation: 0, fill: '#FFF4EC', stroke: '#9060A0', strokeWidth: 0.04, seats: 10, locked: false, hidden: false }],
  }, PASCAL_VERSION);
}
