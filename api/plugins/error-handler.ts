import {
  InvoiceNotFoundError,
  InvoiceOwnershipError,
  AccountNotFoundError,
  AccountOwnershipError,
  TransactionNotFoundError,
  TransactionOwnershipError,
  ClientOwnershipError,
  ServiceOwnershipError,
  ProjectOwnershipError,
  ProjectNotFoundError,
  BudgetNotFoundError,
  BudgetOwnershipError,
  ProjectTaskNotFoundError,
  ProjectTaskOwnershipError,
} from '@/modules/shared/errors';
import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import type { ApiError } from '@/api/types';
import { ClientNotFoundError } from '@/modules/client/client.service';
import { ServiceNotFoundError } from '@/modules/service/service.service';
import { InvoicePaymentNotFoundError } from '@/modules/invoice-payment/invoice-payment.service';

export async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | ZodError, _req, reply) => {
    let statusCode = 500;
    let error: ApiError = {
      code: 'internal_error',
      message: 'Une erreur interne est survenue.',
    };

    if (err instanceof ZodError) {
      statusCode = 400;
      error = {
        code: 'invalid_request',
        message: 'Requête invalide',
        details: err.issues,
      };
    }

    const isJwtError = typeof (err as any)?.code === 'string' && (err as any).code.startsWith('FST_JWT_');
    if (isJwtError) {
      app.log.error({ err }, 'Request error');
      return reply.status(401).send({
        error: {
          code: 'unauthorized',
          message: 'Authentication required',
          details: { reason: err.message },
        },
      });
    }

    if (err instanceof AccountNotFoundError) {
      statusCode = 404;
      error = { code: 'account_not_found', message: err.message };
    } else if (err instanceof AccountOwnershipError) {
      statusCode = 403;
      error = { code: 'forbidden', message: err.message };
    } else if (err instanceof ClientNotFoundError) {
      statusCode = 404;
      error = { code: 'client_not_found', message: err.message };
    } else if (err instanceof ClientOwnershipError) {
      statusCode = 403;
      error = { code: 'forbidden', message: err.message };
    } else if (err instanceof ServiceNotFoundError) {
      statusCode = 404;
      error = { code: 'service_not_found', message: err.message };
    } else if (err instanceof ServiceOwnershipError) {
      statusCode = 403;
      error = { code: 'forbidden', message: err.message };
    } else if (err instanceof ProjectNotFoundError) {
      statusCode = 404;
      error = { code: 'project_not_found', message: err.message };
    } else if (err instanceof ProjectOwnershipError) {
      statusCode = 403;
      error = { code: 'forbidden', message: err.message };
    } else if (err instanceof BudgetNotFoundError) {
      statusCode = 404;
      error = { code: 'budget_not_found', message: err.message };
    } else if (err instanceof BudgetOwnershipError) {
      statusCode = 403;
      error = { code: 'forbidden', message: err.message };
    } else if (err instanceof ProjectTaskNotFoundError) {
      statusCode = 404;
      error = { code: 'task_not_found', message: err.message };
    } else if (err instanceof ProjectTaskOwnershipError) {
      statusCode = 403;
      error = { code: 'forbidden', message: err.message };
    } else if (err instanceof TransactionNotFoundError) {
      statusCode = 404;
      error = { code: 'transaction_not_found', message: err.message };
    } else if (err instanceof TransactionOwnershipError) {
      statusCode = 403;
      error = { code: 'forbidden', message: err.message };
    } else if (err instanceof InvoiceNotFoundError) {
      statusCode = 404;
      error = { code: 'invoice_not_found', message: err.message };
    } else if (err instanceof InvoiceOwnershipError) {
      statusCode = 403;
      error = { code: 'forbidden', message: err.message };
    } else if (err instanceof InvoicePaymentNotFoundError) {
      statusCode = 404;
      error = { code: 'payment_not_found', message: err.message };
    } else if (typeof err.message === 'string') {
      if (err.message.includes('Quote not found')) {
        statusCode = 404;
        error = { code: 'quote_not_found', message: err.message };
      } else if (err.message.includes('Quote must be accepted')) {
        statusCode = 409;
        error = { code: 'invalid_quote_state', message: err.message };
      } else if (err.message.includes('Only draft quotes')) {
        statusCode = 409;
        error = { code: 'invalid_quote_state', message: err.message };
      } else if (err.message.includes('Cannot delete quote linked to invoices')) {
        statusCode = 409;
        error = { code: 'invalid_quote_state', message: err.message };
      } else if (err.message.includes('Cannot delete invoice')) {
        statusCode = 409;
        error = { code: 'invoice_delete_forbidden', message: err.message };
      }
    }

    app.log.error({ err }, 'Request error');

    reply.status(statusCode).send({ error });
  });
}
