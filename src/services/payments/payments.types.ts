import mongoose from 'mongoose';

export interface CreatePaymentParams {
  registrationId: string;
  amount: number;
  customerName: string;
  eventTitle: string;
  /** UI locale the user registered in, used to localize the return URL. */
  locale?: string | undefined;
  session?: mongoose.ClientSession;
}

export interface PlataInvoiceResponse {
  invoiceId?: string;
  paymentLink?: string;
  raw?: unknown;
}
