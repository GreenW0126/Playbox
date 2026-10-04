import { describe, expect, it } from 'vitest';
import { durationOptionsForRole } from './App';

describe('duration options', () => {
  it('offers 180 minutes instead of 90 for the Student role', () => {
    expect(durationOptionsForRole('Student')).toEqual([15, 30, 60, 180]);
  });

  it('keeps the existing options for other roles', () => {
    expect(durationOptionsForRole('Researcher')).toEqual([15, 30, 60, 90]);
  });
});
