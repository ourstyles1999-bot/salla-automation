import { computePrice } from './optimize_with_openai.js';

describe('computePrice', () => {
  test('calculates price with profit margin and VAT', () => {
    const product = { supplier_price: 100, supplier_shipping: 20 };
    expect(computePrice(product)).toBe(234.5);
  });

  test('rounds result to nearest 0.5', () => {
    const product = { supplier_price: 40, supplier_shipping: 0 };
    expect(computePrice(product)).toBe(87.5);
  });
});
