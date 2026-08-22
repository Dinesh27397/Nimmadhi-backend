import {
  TransactionCategory,
  TransactionType,
} from '../../generated/prisma/client.js';
import { parseFinancialSms } from './sms-transaction-parser.js';

describe('parseFinancialSms', () => {
  it('extracts a high-confidence fuel payment', () => {
    const result = parseFinancialSms({
      id: 'sms-1',
      sender: 'VK-HDFCBK',
      body: 'Rs.1,250 debited from A/c XX4567 at Indian Oil on 21-Jul. Ref UTR123456.',
      occurredAt: '2026-07-21T08:30:00.000Z',
    });

    expect(result).toMatchObject({
      amount: 1250,
      type: TransactionType.PAYMENT,
      category: TransactionCategory.FUEL,
      merchantName: 'Indian Oil',
      accountLabel: '???? 4567',
      referenceNumber: 'UTR123456',
    });
    expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('classifies EMI and refund messages', () => {
    const emi = parseFinancialSms({
      id: 'sms-2',
      sender: 'SBI',
      body: 'INR 18,750 EMI paid for home loan account XX8901. Ref EMI123456.',
      occurredAt: '2026-07-20T08:30:00.000Z',
    });
    const refund = parseFinancialSms({
      id: 'sms-3',
      sender: 'AMAZON',
      body: 'Rs 750 cashback credited to account XX4567. Ref CASH123456.',
      occurredAt: '2026-07-19T08:30:00.000Z',
    });

    expect(emi).toMatchObject({
      type: TransactionType.EMI,
      category: TransactionCategory.LOAN,
    });
    expect(refund).toMatchObject({
      type: TransactionType.REFUND,
      category: TransactionCategory.CASHBACK,
    });
  });

  it('ignores OTP and non-financial messages', () => {
    expect(
      parseFinancialSms({
        id: 'sms-4',
        sender: 'HDFCBK',
        body: 'OTP 123456 is your one-time password for a payment of Rs 500.',
        occurredAt: '2026-07-21T08:30:00.000Z',
      }),
    ).toBeNull();
    expect(
      parseFinancialSms({
        id: 'sms-5',
        sender: 'STORE',
        body: 'Your order is ready for collection.',
        occurredAt: '2026-07-21T08:30:00.000Z',
      }),
    ).toBeNull();
  });

  it('ignores offers, payment requests, due reminders, and failed payments', () => {
    const bodies = [
      'Special offer: get cashback of Rs 500 when you shop today.',
      'Payment request received for INR 750 from Store. Open the app to pay.',
      'Your credit card minimum due is Rs 2,500. Pay before the due date.',
      'Payment of Rs 900 at Cafe was declined.',
    ];

    for (const [index, body] of bodies.entries()) {
      expect(
        parseFinancialSms({
          id: `non-transaction-${index}`,
          sender: 'HDFCBK',
          body,
          occurredAt: '2026-07-21T08:30:00.000Z',
        }),
      ).toBeNull();
    }
  });

  it('detects a completed transfer from a recognized financial sender', () => {
    const result = parseFinancialSms({
      id: 'sms-transfer',
      sender: 'VM-SBIBNK',
      body: 'INR 500 transferred from your account to Ravi.',
      occurredAt: '2026-07-21T08:30:00.000Z',
    });

    expect(result).toMatchObject({
      amount: 500,
      type: TransactionType.PAYMENT,
      status: 'SUCCESS',
    });
    expect(result?.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it('redacts long numeric identifiers from the stored preview', () => {
    const result = parseFinancialSms({
      id: 'sms-6',
      sender: 'AXISBANK',
      body: 'Rs 200 paid from account 123456789012 at Cafe. Ref 998877665544.',
      occurredAt: '2026-07-21T08:30:00.000Z',
    });

    expect(result?.messagePreview).not.toContain('123456789012');
    expect(result?.messagePreview).not.toContain('998877665544');
    expect(result?.messagePreview).toContain('????9012');
  });
});
