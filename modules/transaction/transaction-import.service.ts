// src/modules/transaction/transaction-import.service.ts

import { TransactionDirection } from './transaction.service';
import { transactionService } from './transaction.service';
import { assertAccountOwnedByUser, assertUserExists } from '@/modules/shared/assertions';
import { normalizeAccountId, normalizeUserId } from '@/modules/shared/ids';
import { prisma } from '@/lib/prisma';

export interface TransactionImportColumnMapping {
  date: string;
  label: string;
  amount: string;
}

export interface TransactionImportOptions {
  dateFormat?: 'YYYY-MM-DD' | 'DD/MM/YYYY';
  decimalSeparator?: '.' | ',';
}

export interface ImportPersonalTransactionsFromCsvInput {
  userId: bigint;
  accountId: bigint;
  csvContent: string;
  columnMapping?: TransactionImportColumnMapping;
  options?: TransactionImportOptions;
}

export interface TransactionImportResult {
  importedCount: number;
  skippedCount: number;
  errors: Array<{ line: number; message: string }>;
}

function parseAmount(raw: string, decimalSeparator: '.' | ','): number {
  const normalized =
    decimalSeparator === ','
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error('Invalid amount');
  return value;
}

function parseDate(raw: string, format: 'YYYY-MM-DD' | 'DD/MM/YYYY'): Date {
  if (format === 'YYYY-MM-DD') {
    const d = new Date(raw);
    if (isNaN(d.getTime())) throw new Error('Invalid date');
    return d;
  }

  // DD/MM/YYYY
  const parts = raw.split('/');
  if (parts.length !== 3) throw new Error('Invalid date');
  const [dd, mm, yyyy] = parts.map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (isNaN(d.getTime())) throw new Error('Invalid date');
  return d;
}

export class TransactionImportService {
  /**
   * Import personal transactions from a CSV file into a *personal* account.
   *
   * - Positive amount  -> direction = "in",  type = "income"
   * - Negative amount  -> direction = "out", type = "expense"
   *
   * Does **not** stop at first error: collects per-line errors and reports
   * importedCount / skippedCount.
   */
  async importPersonalTransactionsFromCsv(
    input: ImportPersonalTransactionsFromCsvInput
  ): Promise<TransactionImportResult> {
    const userId = normalizeUserId(input.userId);
    const accountId = normalizeAccountId(input.accountId);

    await assertUserExists(prisma, userId);
    const account = await assertAccountOwnedByUser(prisma, accountId, userId);
    if (account.business_id !== null) {
      throw new Error('Account must be personal for personal CSV import');
    }

    const mapping: TransactionImportColumnMapping = input.columnMapping ?? {
      date: 'date',
      label: 'label',
      amount: 'amount',
    };

    const options: TransactionImportOptions = {
      dateFormat: input.options?.dateFormat ?? 'YYYY-MM-DD',
      decimalSeparator: input.options?.decimalSeparator ?? '.',
    };

    const trimmed = input.csvContent.trim();
    if (!trimmed) {
      return {
        importedCount: 0,
        skippedCount: 0,
        errors: [{ line: 0, message: 'Empty CSV' }],
      };
    }

    const lines = trimmed.split(/\r?\n/);
    const header = lines.shift();
    if (!header) {
      return {
        importedCount: 0,
        skippedCount: 0,
        errors: [{ line: 0, message: 'Empty CSV' }],
      };
    }

    // Detect delimiter: ";" (FR banks) or "," (classic)
    const delimiter = header.includes(';') ? ';' : ',';
    const headers = header.split(delimiter).map((h) => h.trim());

    const dateIdx = headers.findIndex((h) => h === mapping.date);
    const labelIdx = headers.findIndex((h) => h === mapping.label);
    const amountIdx = headers.findIndex((h) => h === mapping.amount);

    if (dateIdx === -1 || labelIdx === -1 || amountIdx === -1) {
      return {
        importedCount: 0,
        skippedCount: lines.length,
        errors: [{ line: 1, message: 'Required columns not found (date / label / amount)' }],
      };
    }

    let importedCount = 0;
    const errors: Array<{ line: number; message: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 2; // +1 for header, +1 for 1-based line number
      const rowRaw = lines[i];

      if (!rowRaw.trim()) {
        // Ligne vide : on skip silencieusement
        continue;
      }

      const cols = rowRaw.split(delimiter);

      try {
        const date = parseDate(cols[dateIdx].trim(), options.dateFormat!);
        const label = cols[labelIdx].trim();
        const rawAmount = cols[amountIdx].trim();
        const signedAmount = parseAmount(rawAmount, options.decimalSeparator!);

        if (!label) {
          throw new Error('Empty label');
        }
        if (signedAmount === 0) {
          throw new Error('Zero amount, skipping');
        }

        const direction: TransactionDirection = signedAmount >= 0 ? 'in' : 'out';
        // On mappe sur les types métier existants : "income" / "expense"
        const txType: 'income' | 'expense' = signedAmount >= 0 ? 'income' : 'expense';
        const amount = Math.abs(signedAmount);

        await transactionService.createPersonalTransaction({
          userId,
          accountId,
          date,
          amount,
          direction,
          label,
          type: txType,
          // Si ton domaine gère une notion d'import_source/import_batch_id
          // tu peux les ajouter ici plus tard sans casser l’API.
        });

        importedCount++;
      } catch (err: any) {
        errors.push({
          line: lineNum,
          message: err?.message ?? 'Unknown error',
        });
      }
    }

    return {
      importedCount,
      skippedCount: lines.length - importedCount,
      errors,
    };
  }
}

export const transactionImportService = new TransactionImportService();