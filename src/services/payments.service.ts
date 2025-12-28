import mongoose from 'mongoose';
import { frontendConfig, paymentConfig, serverConfig } from '../config/env';
import { logger } from '../config/logger';
import { IPayment, Payment } from '../models/Payment';
import { PAYMENTS_CODES } from '../types/codes';
import { AppError } from '../types/errors';
import monobankService from './monobank.service';

interface CreatePaymentParams {
  registrationId: string;
  amount: number;
  customerName: string;
  eventTitle: string;
  session?: mongoose.ClientSession;
}

interface PlataInvoiceResponse {
  invoiceId?: string;
  paymentLink?: string;
  raw?: unknown;
}

class PaymentsService {
  /**
   * Create a payment record and generate a Monobank invoice
   */
  async createPaymentWithInvoice({
    registrationId,
    amount,
    customerName,
    eventTitle,
    session,
  }: CreatePaymentParams): Promise<{ payment: IPayment; paymentLink?: string }> {
    if (!paymentConfig.plataApiKey) {
      throw new AppError(
        'Monobank API key is not configured',
        500,
        PAYMENTS_CODES.ERROR_PAYMENT_EXTERNAL_API_ERROR
      );
    }

    // Create payment record first (pending)
    const paymentArray = await Payment.create(
      [
        {
          registrationId,
          amount,
          currency: paymentConfig.currency,
          status: 'pending',
        },
      ],
      { session }
    );

    const payment = paymentArray[0];
    if (!payment) {
      throw new AppError('Failed to create payment', 500, PAYMENTS_CODES.ERROR_PAYMENT_FAILED);
    }

    const invoice = await this.createPlataInvoice({
      amount,
      customerName,
      eventTitle,
      registrationId,
    });

    if (invoice.invoiceId) {
      payment.plataMonoInvoiceId = invoice.invoiceId;
    }
    if (invoice.paymentLink) {
      payment.paymentLink = invoice.paymentLink;
    }
    await payment.save(session ? { session } : undefined);

    const result: { payment: IPayment; paymentLink?: string } = { payment };
    if (invoice.paymentLink) {
      result.paymentLink = invoice.paymentLink;
    }

    return result;
  }

  /**
   * Find payment by Monobank invoice id
   */
  async findByInvoiceId(invoiceId: string): Promise<IPayment | null> {
    return Payment.findOne({ plataMonoInvoiceId: invoiceId });
  }

  /**
   * Update payment status and optional metadata
   */
  async updateStatus(
    paymentId: string,
    status: IPayment['status'],
    updates: Partial<Pick<IPayment, 'plataMonoPaymentId' | 'webhookData'>> = {},
    session?: mongoose.ClientSession
  ): Promise<void> {
    const options = session ? { session } : undefined;
    await Payment.updateOne({ _id: paymentId }, { status, ...updates }, options);
  }

  /**
   * Check payment status from Monobank API (fallback if webhook missed)
   * Documentation: https://monobank.ua/api-docs/acquiring/methods/ia/get--api--merchant--invoice--status
   */
  async checkPaymentStatus(paymentId: string): Promise<Record<string, unknown> | null> {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404, PAYMENTS_CODES.ERROR_PAYMENT_NOT_FOUND);
    }

    if (!payment.plataMonoInvoiceId) {
      throw new AppError(
        'Payment has no invoice ID',
        400,
        PAYMENTS_CODES.ERROR_PAYMENT_INVOICE_ID_MISSING
      );
    }

    const status = await monobankService.getInvoiceStatus(payment.plataMonoInvoiceId);
    return status;
  }

  /**
   * Refund a payment (cancel invoice)
   * Documentation: https://monobank.ua/api-docs/acquiring/methods/ia/post--api--merchant--invoice--cancel
   */
  async refundPayment(
    paymentId: string,
    amount?: number,
    extRef?: string,
    session?: mongoose.ClientSession
  ): Promise<IPayment> {
    const payment = await Payment.findById(paymentId).session(session || null);
    if (!payment) {
      throw new AppError('Payment not found', 404, PAYMENTS_CODES.ERROR_PAYMENT_NOT_FOUND);
    }

    if (payment.status !== 'completed') {
      throw new AppError(
        'Only completed payments can be refunded',
        400,
        PAYMENTS_CODES.ERROR_PAYMENT_FAILED
      );
    }

    if (!payment.plataMonoInvoiceId) {
      throw new AppError(
        'Payment has no invoice ID',
        400,
        PAYMENTS_CODES.ERROR_PAYMENT_INVOICE_ID_MISSING
      );
    }

    // Use provided amount or full payment amount
    const refundAmount = amount ?? payment.amount;

    const cancelResult = await monobankService.cancelInvoice(
      payment.plataMonoInvoiceId,
      refundAmount,
      extRef
    );

    if (!cancelResult) {
      throw new AppError(
        'Failed to cancel invoice with Monobank',
        502,
        PAYMENTS_CODES.ERROR_PAYMENT_EXTERNAL_API_ERROR
      );
    }

    // Update payment status to refunded
    payment.status = 'refunded';
    if (cancelResult) {
      payment.webhookData = { ...payment.webhookData, refundData: cancelResult };
    }
    await payment.save(session ? { session } : undefined);

    return payment;
  }

  /**
   * Get receipt for a payment
   * Documentation: https://monobank.ua/api-docs/acquiring/methods/ia/get--api--merchant--invoice--receipt
   */
  async getReceipt(paymentId: string): Promise<Record<string, unknown> | null> {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404, PAYMENTS_CODES.ERROR_PAYMENT_NOT_FOUND);
    }

    if (!payment.plataMonoInvoiceId) {
      throw new AppError(
        'Payment has no invoice ID',
        400,
        PAYMENTS_CODES.ERROR_PAYMENT_INVOICE_ID_MISSING
      );
    }

    if (payment.status !== 'completed') {
      throw new AppError(
        'Receipt is only available for completed payments',
        400,
        PAYMENTS_CODES.ERROR_PAYMENT_FAILED
      );
    }

    const receipt = await monobankService.getInvoiceReceipt(payment.plataMonoInvoiceId);
    return receipt;
  }

  /**
   * Call Monobank API to create an invoice
   * Documentation: https://monobank.ua/api-docs/acquiring/methods/ia/post--api--merchant--invoice--create
   */
  private async createPlataInvoice(params: {
    amount: number;
    customerName: string;
    eventTitle: string;
    registrationId: string;
  }): Promise<PlataInvoiceResponse> {
    const { amount, customerName, eventTitle, registrationId } = params;

    // Validate amount before processing
    if (!amount || amount <= 0 || !isFinite(amount)) {
      logger.error('Invalid amount for Monobank invoice', {
        amount,
        registrationId,
      });
      throw new AppError('Invalid payment amount', 400, PAYMENTS_CODES.ERROR_PAYMENT_FAILED);
    }

    // Monobank minimum amount is 1 kopiyka (0.01 UAH)
    // Convert to kopiykas and validate
    const amountInKopiykas = Math.round(amount * 100);
    if (amountInKopiykas < 1) {
      logger.error('Amount too small for Monobank invoice', {
        amount,
        amountInKopiykas,
        registrationId,
      });
      throw new AppError(
        'Payment amount is too small (minimum 0.01 UAH)',
        400,
        PAYMENTS_CODES.ERROR_PAYMENT_FAILED
      );
    }

    // Check if API key is configured
    if (!paymentConfig.plataApiKey) {
      logger.error('Monobank API key is not configured');
      throw new AppError(
        'Payment service is not configured',
        500,
        PAYMENTS_CODES.ERROR_PAYMENT_EXTERNAL_API_ERROR
      );
    }

    const webhookUrl =
      paymentConfig.webhookUrl || `http://localhost:${serverConfig.port}/api/webhooks/plata-mono`;

    // Monobank API expects amount in kopiykas (minimum units)
    // ccy: 980 is ISO 4217 code for UAH (Ukrainian Hryvnia)
    const body = {
      amount: amountInKopiykas, // kopiykas
      ccy: 980, // UAH (ISO 4217)
      merchantPaymInfo: {}, // Required for PPRO integration, can be empty
      redirectUrl: `${frontendConfig.url}`,
      successUrl: `${frontendConfig.url}?tab=participants`,
      failUrl: `${frontendConfig.url}?tab=registration`,
      webHookUrl: webhookUrl,
      merchantData: {
        registrationId,
        customerName,
        eventTitle,
      },
    };

    const apiUrl = 'https://api.monobank.ua/api/merchant/invoice/create';

    // Log request details (without sensitive data)
    logger.info('Creating Monobank invoice', {
      registrationId,
      amount: body.amount,
      apiUrl,
      hasApiKey: !!paymentConfig.plataApiKey,
    });

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-Token': paymentConfig.plataApiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'gorun-backend/1.0.0',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        // Add keepalive for better connection handling
        keepalive: true,
      });

      clearTimeout(timeoutId);

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        const errorData = data as { errCode?: string; errText?: string; errDescription?: string };
        const errorCode = errorData.errCode;
        const errorText = errorData.errText || errorData.errDescription || 'Unknown error';

        logger.error('Monobank invoice creation failed', {
          status: response.status,
          statusText: response.statusText,
          errorCode,
          errorText,
          data,
          registrationId,
          amount: body.amount,
          originalAmount: amount,
        });

        // Handle specific Monobank error codes
        let userMessage = 'Failed to create payment link';
        let errorCodeType: (typeof PAYMENTS_CODES)[keyof typeof PAYMENTS_CODES] =
          PAYMENTS_CODES.ERROR_PAYMENT_EXTERNAL_API_ERROR;

        if (errorCode === '1001') {
          userMessage = 'Invalid payment amount. Please contact support.';
          errorCodeType = PAYMENTS_CODES.ERROR_PAYMENT_FAILED;
        } else if (errorCode === '1002') {
          userMessage = 'Payment currency is not supported';
          errorCodeType = PAYMENTS_CODES.ERROR_PAYMENT_EXTERNAL_API_ERROR;
        } else if (errorCode === '1003') {
          userMessage = 'Invalid merchant configuration';
          errorCodeType = PAYMENTS_CODES.ERROR_PAYMENT_EXTERNAL_API_ERROR;
        } else if (errorText) {
          userMessage = `Payment service error: ${errorText}`;
        }

        throw new AppError(userMessage, 502, errorCodeType);
      }

      const invoiceId = (data.invoiceId as string | undefined) || (data.id as string | undefined);
      const paymentLink =
        (data.pageUrl as string | undefined) ||
        (data.paymentLink as string | undefined) ||
        (data.link as string | undefined) ||
        (data.invoiceUrl as string | undefined);

      const responseData: PlataInvoiceResponse = { raw: data };
      if (invoiceId) {
        responseData.invoiceId = invoiceId;
      }
      if (paymentLink) {
        responseData.paymentLink = paymentLink;
      }

      return responseData;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.error('Monobank API request timeout', { registrationId, apiUrl });
          throw new AppError(
            'Payment service timeout. Please try again.',
            504,
            PAYMENTS_CODES.ERROR_PAYMENT_EXTERNAL_API_ERROR
          );
        }

        if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
          logger.error('Monobank API connection failed', {
            error: error.message,
            registrationId,
            apiUrl,
            stack: error.stack,
          });
          throw new AppError(
            'Unable to connect to payment service. Please check your network connection or try again later.',
            503,
            PAYMENTS_CODES.ERROR_PAYMENT_EXTERNAL_API_ERROR
          );
        }

        // If it's already an AppError, re-throw it
        if (error instanceof AppError) {
          throw error;
        }
      }

      logger.error('Unexpected error creating Monobank invoice', {
        error,
        registrationId,
        apiUrl,
      });
      throw new AppError(
        'Failed to create payment link. Please try again.',
        500,
        PAYMENTS_CODES.ERROR_PAYMENT_EXTERNAL_API_ERROR
      );
    }
  }
}

export default new PaymentsService();
