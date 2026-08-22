import { createHash } from 'node:crypto';
import {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/client.js';
import type { SmsMessageDto } from './dto/import-sms.dto.js';

export type ParsedSmsTransaction = {
  deviceMessageId: string;
  sender: string;
  messagePreview: string;
  contentHash: string;
  occurredAt: Date;
  type: TransactionType;
  category: TransactionCategory;
  status: TransactionStatus;
  amount: number;
  currency: string;
  merchantName?: string;
  accountLabel?: string;
  referenceNumber?: string;
  confidence: number;
};

const financialWords =
  /\b(debited|credited|spent|paid|purchased|withdrawn|received|transferred|sent|deposited|refunded|reversed)\b/i;
const otpWords = /\b(otp|one[ -]?time password|verification code)\b/i;
const nonTransactionWords =
  /\b(offer|eligible|pre[ -]?approved|apply now|coupon|promo(?:tion)?|reward points?|payment request|collect request|requested|due date|minimum due|bill due|failed|declined|unsuccessful)\b/i;
const bankSender =
  /(bank|hdfc|sbi|icici|axis|kotak|indus|yesbnk|canara|union|bob|pnb|idfc|federal|rbl|paytm|phonepe|gpay|googlepay|amazonpay|bhim)/i;

export function parseFinancialSms(
  message: SmsMessageDto,
): ParsedSmsTransaction | null {
  const body = message.body.replace(/\s+/g, ' ').trim();
  if (
    !financialWords.test(body) ||
    otpWords.test(body) ||
    nonTransactionWords.test(body)
  ) {
    return null;
  }

  const amountMatch = body.match(
    /(?:\u20b9|inr|rs\.?)[\s:]?([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (!amountMatch) {
    return null;
  }
  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const isRefund = /\b(refund(?:ed)?|cashback|reversal|reversed)\b/i.test(body);
  const isCredit = /\b(credit(?:ed)?|received)\b/i.test(body);
  const isEmi = /\b(emi|loan instal+ment|loan payment)\b/i.test(body);
  const type =
    isRefund || (isCredit && !isEmi)
      ? TransactionType.REFUND
      : isEmi
        ? TransactionType.EMI
        : TransactionType.PAYMENT;
  const category = detectCategory(body, type);
  const referenceNumber = capture(
    body,
    /\b(?:utr|ref(?:erence)?|txn)(?:\s*(?:no|number|id))?[\s:#-]*([a-z0-9-]{6,})/i,
  );
  const accountSuffix = capture(
    body,
    /\b(?:a\/c|acct|account|card)(?:\s*(?:no|number))?[\s:.-]*(?:x+|\*+)?(\d{3,4})\b/i,
  );
  const merchantName = capture(
    body,
    /\b(?:at|to)\s+([a-z0-9][a-z0-9 .&_-]{2,35}?)(?=\s+(?:on|ref|txn|utr|using|via|from)\b|[.,]|$)/i,
  );

  let confidence = 0.55;
  if (bankSender.test(message.sender)) confidence += 0.1;
  if (referenceNumber) confidence += 0.12;
  if (accountSuffix) confidence += 0.08;
  if (merchantName || isEmi || isRefund) confidence += 0.1;
  confidence = Math.min(0.99, Number(confidence.toFixed(2)));

  return {
    deviceMessageId: message.id,
    sender: message.sender.slice(0, 80),
    messagePreview: redactPreview(body),
    contentHash: createHash('sha256')
      .update(
        `${message.sender.toLowerCase()}|${body.toLowerCase()}|${message.occurredAt}`,
      )
      .digest('hex'),
    occurredAt: new Date(message.occurredAt),
    type,
    category,
    status: TransactionStatus.SUCCESS,
    amount,
    currency: 'INR',
    merchantName,
    accountLabel: accountSuffix ? `???? ${accountSuffix}` : undefined,
    referenceNumber,
    confidence,
  };
}

function detectCategory(body: string, type: TransactionType) {
  if (type === TransactionType.EMI) return TransactionCategory.LOAN;
  if (type === TransactionType.REFUND && /cashback/i.test(body)) {
    return TransactionCategory.CASHBACK;
  }
  if (/fuel|petrol|diesel|indian oil|bharat petroleum|hpcl/i.test(body)) {
    return TransactionCategory.FUEL;
  }
  if (/amazon|flipkart|myntra|shopping|retail/i.test(body)) {
    return TransactionCategory.SHOPPING;
  }
  if (/swiggy|zomato|restaurant|food|cafe/i.test(body)) {
    return TransactionCategory.FOOD;
  }
  if (/electricity|water bill|broadband|mobile bill|utility/i.test(body)) {
    return TransactionCategory.UTILITIES;
  }
  if (/hospital|pharmacy|medical|health/i.test(body)) {
    return TransactionCategory.HEALTHCARE;
  }
  if (/uber|ola|metro|railway|transport/i.test(body)) {
    return TransactionCategory.TRANSPORT;
  }
  if (/movie|netflix|spotify|entertainment/i.test(body)) {
    return TransactionCategory.ENTERTAINMENT;
  }
  return TransactionCategory.OTHER;
}

function capture(body: string, pattern: RegExp) {
  return body.match(pattern)?.[1]?.trim();
}

function redactPreview(body: string) {
  return body
    .slice(0, 240)
    .replace(/\b\d{8,}\b/g, (value) => `????${value.slice(-4)}`);
}
