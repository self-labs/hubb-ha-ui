import { describe, expect, it } from 'vitest';
import { angleToValue, ARC_START, ARC_SWEEP, arcPath, pointToAngle, targetLimits, valueToAngle } from '../../src/model/arc';

describe('the arc of the air conditioner', () => {
  it('opens at the bottom: 270 degrees from the lower left, clockwise', () => {
    expect(ARC_START).toBe(135);
    expect(ARC_SWEEP).toBe(270);
  });

  it('puts the lowest target at the start, the highest at the end and the middle on top', () => {
    expect(valueToAngle(16, 16, 30)).toBe(135);
    expect(valueToAngle(30, 16, 30)).toBe(405);
    expect(valueToAngle(23, 16, 30)).toBe(270);
    // A target outside the limits of the device stays at the end of the arc.
    expect(valueToAngle(10, 16, 30)).toBe(135);
    expect(valueToAngle(40, 16, 30)).toBe(405);
  });

  it('reads a target from an angle, rounded to the step and kept inside the limits', () => {
    expect(angleToValue(270, 16, 30, 1)).toBe(23);
    expect(angleToValue(272, 16, 30, 1)).toBe(23);
    expect(angleToValue(500, 16, 30, 1)).toBe(30);
    expect(angleToValue(100, 16, 30, 1)).toBe(16);
  });

  it('turns a finger into an angle, and the gap at the bottom into the nearest end', () => {
    expect(pointToAngle(130, 25, 130, 130)).toBeCloseTo(270);
    expect(pointToAngle(235, 130, 130, 130)).toBeCloseTo(360);
    // Just left of the bottom: the start of the arc; just right: its end.
    expect(pointToAngle(120, 230, 130, 130)).toBe(135);
    expect(pointToAngle(140, 230, 130, 130)).toBe(405);
  });

  it('draws the path of a stretch of the arc', () => {
    expect(arcPath(130, 130, 105, 135, 270)).toBe('M 55.75 204.25 A 105 105 0 0 1 130 25');
    expect(arcPath(130, 130, 105, 135, 405)).toBe('M 55.75 204.25 A 105 105 0 1 1 204.25 204.25');
  });

  it('reads the limits and the step of the device, whole degrees like a remote control', () => {
    expect(targetLimits({})).toEqual({ min: 7, max: 35, step: 1 });
    expect(targetLimits({ min_temp: 18, max_temp: 30, target_temp_step: 1 })).toEqual({ min: 18, max: 30, step: 1 });
    expect(targetLimits({ target_temp_step: 0.5 }).step).toBe(1);
    expect(targetLimits({ min_temp: 7, max_temp: 35, target_temp_step: 2 }).step).toBe(2);
  });
});
