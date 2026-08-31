import { getSize } from '../tileindex.validate';
import type { BBox } from '@linzjs/geojson';

describe('getSize', () => {
  it('should return correct width and height for a valid bbox', () => {
    const bbox: BBox = [10, 20, 30, 40];
    const size = getSize(bbox);
    expect(size).toEqual({ width: 20, height: 20 });
  });

  it('should return zero width and height for a bbox with same points', () => {
    const bbox: BBox = [5, 5, 5, 5];
    const size = getSize(bbox);
    expect(size).toEqual({ width: 0, height: 0 });
  });

  it('should handle negative coordinates', () => {
    const bbox: BBox = [-10, -20, 10, 20];
    const size = getSize(bbox);
    expect(size).toEqual({ width: 20, height: 40 });
  });

  it('should handle width and height when min > max (negative size)', () => {
    const bbox: BBox = [30, 40, 10, 20];
    const size = getSize(bbox);
    expect(size).toEqual({ width: -20, height: -20 });
  });
});
