import { AffordabilityService } from './affordability.service.js';

describe('AffordabilityService', () => {
  const service = new AffordabilityService({} as never);

  it('marks purchase safe when ratio and cash flow are healthy', () => {
    expect(
      service.decide({
        newEmiRatio: 25,
        freeCashAfterNewEmi: 20000,
        emergencyFund: 30000,
        monthlyEssentialExpenses: 25000,
        highInterestDebtExists: false,
      }),
    ).toBe('SAFE');
  });

  it('marks purchase not recommended when ratio exceeds 40 percent', () => {
    expect(
      service.decide({
        newEmiRatio: 44,
        freeCashAfterNewEmi: 10000,
        emergencyFund: 50000,
        monthlyEssentialExpenses: 25000,
        highInterestDebtExists: false,
      }),
    ).toBe('NOT_RECOMMENDED');
  });

  it('marks purchase not recommended when high-interest credit card debt exists', () => {
    expect(
      service.decide({
        newEmiRatio: 25,
        freeCashAfterNewEmi: 10000,
        emergencyFund: 50000,
        monthlyEssentialExpenses: 25000,
        highInterestDebtExists: true,
      }),
    ).toBe('NOT_RECOMMENDED');
  });
});
