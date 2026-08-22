import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SmsImportReviewStatus,
  TransactionSource,
  TransactionType,
} from '../../generated/prisma/client.js';
import type { SmsImportCandidate } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImportSmsDto } from './dto/import-sms.dto.js';
import { ReviewSmsImportDto } from './dto/review-sms-import.dto.js';
import { SmsImportQueryDto } from './dto/sms-import-query.dto.js';
import { parseFinancialSms } from './sms-transaction-parser.js';
import type { ParsedSmsTransaction } from './sms-transaction-parser.js';

// A valid action and amount are required by the parser. One additional signal
// (financial sender, reference, account, merchant, EMI or refund) makes the
// message safe to import without asking the user to classify it.
const MIN_AUTO_IMPORT_CONFIDENCE = 0.65;

@Injectable()
export class SmsImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async importMessages(
    userId: string,
    dto: ImportSmsDto,
    source: TransactionSource = TransactionSource.SMS,
  ) {
    const result = {
      received: dto.messages.length,
      detected: 0,
      autoImported: 0,
      pendingReview: 0,
      duplicates: 0,
      skipped: 0,
      candidates: [] as ReturnType<typeof this.toResponse>[],
    };
    const parsedMessages: ParsedSmsTransaction[] = [];
    const batchMessageIds = new Set<string>();
    const batchContentHashes = new Set<string>();
    const batchReferences = new Set<string>();

    for (const message of dto.messages) {
      const parsed = parseFinancialSms(message);
      if (!parsed || parsed.confidence < MIN_AUTO_IMPORT_CONFIDENCE) {
        result.skipped += 1;
        continue;
      }
      result.detected += 1;

      const normalizedReference = parsed.referenceNumber?.toLowerCase();
      if (
        batchMessageIds.has(parsed.deviceMessageId) ||
        batchContentHashes.has(parsed.contentHash) ||
        (normalizedReference && batchReferences.has(normalizedReference))
      ) {
        result.duplicates += 1;
        continue;
      }

      batchMessageIds.add(parsed.deviceMessageId);
      batchContentHashes.add(parsed.contentHash);
      if (normalizedReference) batchReferences.add(normalizedReference);
      parsedMessages.push(parsed);
    }

    if (parsedMessages.length === 0) {
      return result;
    }

    const referenceNumbers = parsedMessages
      .map((parsed) => parsed.referenceNumber)
      .filter((value): value is string => Boolean(value));
    const [existingTransactions, existingCandidates] = await Promise.all([
      referenceNumbers.length
        ? this.prisma.transaction.findMany({
            where: {
              userId,
              isDeleted: false,
              referenceNumber: {
                in: referenceNumbers,
                mode: 'insensitive',
              },
            },
            select: { referenceNumber: true },
          })
        : Promise.resolve([]),
      this.prisma.smsImportCandidate.findMany({
        where: {
          userId,
          OR: [
            {
              deviceMessageId: {
                in: parsedMessages.map((parsed) => parsed.deviceMessageId),
              },
            },
            {
              contentHash: {
                in: parsedMessages.map((parsed) => parsed.contentHash),
              },
            },
          ],
        },
        select: { deviceMessageId: true, contentHash: true },
      }),
    ]);
    const existingReferences = new Set(
      existingTransactions
        .map((transaction) => transaction.referenceNumber?.toLowerCase())
        .filter((value): value is string => Boolean(value)),
    );
    const existingMessageIds = new Set(
      existingCandidates.map((candidate) => candidate.deviceMessageId),
    );
    const existingContentHashes = new Set(
      existingCandidates.map((candidate) => candidate.contentHash),
    );

    for (const parsed of parsedMessages) {
      if (
        existingMessageIds.has(parsed.deviceMessageId) ||
        existingContentHashes.has(parsed.contentHash) ||
        (parsed.referenceNumber &&
          existingReferences.has(parsed.referenceNumber.toLowerCase()))
      ) {
        result.duplicates += 1;
        continue;
      }

      try {
        let candidate = await this.prisma.smsImportCandidate.create({
          data: {
            userId,
            ...parsed,
            source,
            confidence: new Prisma.Decimal(parsed.confidence),
          },
        });

        candidate = await this.createTransaction(
          userId,
          candidate,
          SmsImportReviewStatus.AUTO_IMPORTED,
        );
        result.autoImported += 1;
        result.candidates.push(this.toResponse(candidate));
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          result.duplicates += 1;
          continue;
        }
        throw error;
      }
    }

    return result;
  }

  async findAll(userId: string, query: SmsImportQueryDto) {
    const limit = query.limit ?? 20;
    const candidates = await this.prisma.smsImportCandidate.findMany({
      where: { userId, reviewStatus: query.status },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : undefined),
    });
    const hasMore = candidates.length > limit;
    const items = hasMore ? candidates.slice(0, limit) : candidates;

    return {
      items: items.map((candidate) => this.toResponse(candidate)),
      nextCursor: hasMore ? items.at(-1)?.id : null,
      hasMore,
    };
  }

  async review(userId: string, id: string, dto: ReviewSmsImportDto) {
    const candidate = await this.prisma.smsImportCandidate.findFirst({
      where: { id, userId },
    });
    if (!candidate) {
      throw new NotFoundException('SMS import candidate not found');
    }
    if (candidate.reviewStatus !== SmsImportReviewStatus.PENDING) {
      throw new ConflictException('SMS import candidate was already reviewed');
    }

    if (dto.action === 'IGNORE') {
      const ignored = await this.prisma.smsImportCandidate.update({
        where: { id },
        data: {
          reviewStatus: SmsImportReviewStatus.IGNORED,
          reviewedAt: new Date(),
        },
      });
      return this.toResponse(ignored);
    }

    return this.toResponse(
      await this.createTransaction(
        userId,
        candidate,
        SmsImportReviewStatus.APPROVED,
        dto,
      ),
    );
  }

  private createTransaction(
    userId: string,
    candidate: SmsImportCandidate,
    reviewStatus:
      | typeof SmsImportReviewStatus.AUTO_IMPORTED
      | typeof SmsImportReviewStatus.APPROVED,
    edits?: ReviewSmsImportDto,
  ) {
    const type = edits?.type ?? candidate.type;
    const category = edits?.category ?? candidate.category;
    const amount = edits?.amount ?? Number(candidate.amount.toString());
    const occurredAt = edits?.occurredAt
      ? new Date(edits.occurredAt)
      : candidate.occurredAt;
    const merchantName = edits?.merchantName ?? candidate.merchantName;

    return this.prisma.$transaction(async (transactionClient) => {
      const transaction = await transactionClient.transaction.create({
        data: {
          userId,
          title:
            edits?.title?.trim() ??
            this.transactionTitle(type, merchantName ?? undefined),
          description: candidate.messagePreview,
          type,
          category,
          status: candidate.status,
          source: candidate.source,
          amount: new Prisma.Decimal(amount),
          currency: candidate.currency,
          merchantName,
          accountLabel: candidate.accountLabel,
          referenceNumber: candidate.referenceNumber,
          externalReference: `${candidate.source.toLowerCase()}:${candidate.contentHash}`,
          occurredAt,
        },
      });

      return transactionClient.smsImportCandidate.update({
        where: { id: candidate.id },
        data: {
          transactionId: transaction.id,
          type,
          category,
          amount: new Prisma.Decimal(amount),
          merchantName,
          occurredAt,
          reviewStatus,
          reviewedAt: new Date(),
        },
      });
    });
  }

  private transactionTitle(type: TransactionType, merchantName?: string) {
    if (merchantName) return merchantName;
    if (type === TransactionType.EMI) return 'EMI Payment';
    if (type === TransactionType.REFUND) return 'Refund Received';
    return 'SMS Payment';
  }

  private toResponse(candidate: SmsImportCandidate) {
    return {
      id: candidate.id,
      transactionId: candidate.transactionId ?? undefined,
      sender: candidate.sender,
      source: candidate.source,
      messagePreview: candidate.messagePreview,
      occurredAt: candidate.occurredAt.toISOString(),
      type: candidate.type,
      category: candidate.category,
      status: candidate.status,
      amount: Number(candidate.amount.toString()),
      currency: candidate.currency,
      merchantName: candidate.merchantName ?? undefined,
      accountLabel: candidate.accountLabel ?? undefined,
      referenceNumber: candidate.referenceNumber ?? undefined,
      confidence: Number(candidate.confidence.toString()),
      reviewStatus: candidate.reviewStatus,
      reviewedAt: candidate.reviewedAt?.toISOString(),
      createdAt: candidate.createdAt.toISOString(),
    };
  }
}
