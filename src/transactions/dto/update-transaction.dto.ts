import { PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto.js';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}
