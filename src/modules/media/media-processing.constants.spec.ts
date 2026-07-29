import {
  budgetTierFor,
  RENDITION_BUDGETS,
  RENDITION_WIDTHS,
} from './media-processing.constants';

// The budget-tier rule (doc 20 §4, D20-20): a rendition is measured against the SMALLEST configured
// tier ≥ its own width. One rule covers the sub-640 source rendition and the D20-20 terminal
// rendition alike — borrowing the tier above, never below.
describe('budgetTierFor', () => {
  it.each([
    [1, 640],
    [400, 640],
    [640, 640],
    [641, 1280],
    [1086, 1280],
    [1280, 1280],
    [1281, 1920],
    [1700, 1920],
    [1920, 1920],
  ])('a %ipx rendition is measured against the %i tier', (width, tier) => {
    expect(budgetTierFor(width)).toBe(tier);
  });

  it('never selects a tier below the rendition width', () => {
    for (let width = 1; width <= 1920; width += 7) {
      expect(budgetTierFor(width)).toBeGreaterThanOrEqual(width);
    }
  });

  it('only ever returns a tier the budget table can price', () => {
    for (let width = 1; width <= 1920; width += 13) {
      expect(RENDITION_BUDGETS[budgetTierFor(width)]).toBeDefined();
    }
  });

  it('clamps above the largest tier — a total function, though the planner never asks', () => {
    const largest = RENDITION_WIDTHS[RENDITION_WIDTHS.length - 1] as number;
    expect(budgetTierFor(largest + 1)).toBe(largest);
    expect(budgetTierFor(99_999)).toBe(largest);
  });
});
