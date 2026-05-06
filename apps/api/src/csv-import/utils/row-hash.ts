import { createHash } from 'node:crypto';

export interface RowHashInput {
  date: string;
  amountCents: number;
  counterpartyNorm: string;
  purposeNorm: string;
}

export function rowHash(input: RowHashInput): string {
  const payload = `${input.date}|${input.amountCents}|${input.counterpartyNorm}|${input.purposeNorm}`;
  return createHash('sha256').update(payload).digest('hex');
}
