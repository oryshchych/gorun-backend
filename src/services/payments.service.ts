import mongoose from 'mongoose';
import { frontendConfig, paymentConfig, serverConfig } from '../config/env';
import { logger } from '../config/logger';
import { IPayment, Payment } from '../models/Payment';
import { AppError } from '../types/errors';

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
   * Create a payment record and generate a Plata by Mono invoice
   */
  async createPaymentWithInvoice({
    registrationId,
    amount,
    customerName,
    eventTitle,
    session,
  }: CreatePaymentParams): Promise<{ payment: IPayment; paymentLink?: string }> {
    if (!paymentConfig.plataApiKey) {
      throw new AppError('Plata by Mono API key is not configured', 500);
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
   * Find payment by Plata invoice id
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
   * Call Plata by Mono to create an invoice
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

    const body = {
      amount: Math.round(amount * 100), // kopiykas
      currency: paymentConfig.currency,
      description: `Event Registration - ${customerName || 'Participant'} (${eventTitle})`,
      redirectUrl: `${frontendConfig.successUrl}?registrationId=${registrationId}`,
      webhookUrl,
      merchantData: {
        registrationId,
      },
      failureRedirectUrl: `${frontendConfig.failureUrl}?registrationId=${registrationId}`,
    };

    const response = await fetch('https://api.plata.mono.com/invoices', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paymentConfig.plataApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      logger.error('Plata invoice creation failed', { status: response.status, data });
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
