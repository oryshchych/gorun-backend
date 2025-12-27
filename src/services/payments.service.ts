import mongoose from 'mongoose';
import { frontendConfig, paymentConfig, serverConfig } from '../config/env';
import { logger } from '../config/logger';
import { IPayment, Payment } from '../models/Payment';
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
      throw new AppError('Monobank API key is not configured', 500);
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
      throw new AppError('Failed to create payment', 500);
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
      throw new AppError('Payment not found', 404);
    }

    if (!payment.plataMonoInvoiceId) {
      throw new AppError('Payment has no invoice ID', 400);
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
      throw new AppError('Payment not found', 404);
    }

    if (payment.status !== 'completed') {
      throw new AppError('Only completed payments can be refunded', 400);
    }

    if (!payment.plataMonoInvoiceId) {
      throw new AppError('Payment has no invoice ID', 400);
    }

    // Use provided amount or full payment amount
    const refundAmount = amount ?? payment.amount;

    const cancelResult = await monobankService.cancelInvoice(
      payment.plataMonoInvoiceId,
      refundAmount,
      extRef
    );

    if (!cancelResult) {
      throw new AppError('Failed to cancel invoice with Monobank', 502);
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
      throw new AppError('Payment not found', 404);
    }

    if (!payment.plataMonoInvoiceId) {
      throw new AppError('Payment has no invoice ID', 400);
    }

    if (payment.status !== 'completed') {
      throw new AppError('Receipt is only available for completed payments', 400);
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
    const webhookUrl =
      paymentConfig.webhookUrl || `http://localhost:${serverConfig.port}/api/webhooks/plata-mono`;

    // Monobank API expects amount in kopiykas (minimum units)
    // ccy: 980 is ISO 4217 code for UAH (Ukrainian Hryvnia)
    const body = {
      amount: Math.round(amount * 100), // kopiykas
      ccy: 980, // UAH (ISO 4217)
      merchantPaymInfo: {}, // Required for PPRO integration, can be empty
      redirectUrl: `${frontendConfig.successUrl}?registrationId=${registrationId}`,
      successUrl: `${frontendConfig.successUrl}?registrationId=${registrationId}`,
      failUrl: `${frontendConfig.failureUrl}?registrationId=${registrationId}`,
      webHookUrl: webhookUrl,
      merchantData: {
        registrationId,
        customerName,
        eventTitle,
      },
    };

    const response = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
      method: 'POST',
      headers: {
        'X-Token': paymentConfig.plataApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      logger.error('Monobank invoice creation failed', { status: response.status, data });
      throw new AppError('Failed to create payment link', 502);
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
  }
}

export default new PaymentsService();
