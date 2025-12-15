import { emailConfig } from '../config/env';
import { logger } from '../config/logger';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private async sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
    if (!emailConfig.resendApiKey) {
      logger.warn('Resend API key not configured, skipping email send', { to, subject });
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${emailConfig.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailConfig.fromEmail,
          to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('Failed to send email via Resend', { status: response.status, errorBody });
      }
    } catch (error) {
      logger.error('Resend email send failed', { error });
    }
  }

  async sendRegistrationConfirmation(params: {
    to: string;
    name: string;
    eventTitle: string;
    eventDate: string;
    eventLocation: string;
    paymentAmount: number;
    paymentCurrency: string;
    registrationId: string;
  }): Promise<void> {
    const {
      to,
      name,
      eventTitle,
      eventDate,
      eventLocation,
      paymentAmount,
      paymentCurrency,
      registrationId,
    } = params;

    const html = `
      <h1>Registration Confirmed</h1>
      <p>Hi ${name},</p>
      <p>Your registration for <strong>${eventTitle}</strong> is confirmed.</p>
      <p><strong>Event date:</strong> ${new Date(eventDate).toLocaleString()}</p>
      <p><strong>Location:</strong> ${eventLocation}</p>
      <p><strong>Payment:</strong> ${paymentAmount} ${paymentCurrency}</p>
      <p><strong>Registration ID:</strong> ${registrationId}</p>
      <p>Thank you for registering!</p>
    `;

    await this.sendEmail({
      to,
      subject: `Registration Confirmed - ${eventTitle}`,
      html,
    });
  }

  async sendPaymentFailed(params: {
    to: string;
    name: string;
    eventTitle: string;
    retryLink: string;
    errorMessage?: string;
  }): Promise<void> {
    const { to, name, eventTitle, retryLink, errorMessage } = params;

    const html = `
      <h1>Payment Failed</h1>
      <p>Hi ${name},</p>
      <p>We could not complete your payment for <strong>${eventTitle}</strong>.</p>
      <p>${errorMessage ?? 'Payment was declined or cancelled.'}</p>
      <p>You can retry your payment here: <a href="${retryLink}">Retry payment</a></p>
      <p>If the issue persists, please contact support.</p>
    `;

    await this.sendEmail({
      to,
      subject: `Payment Failed - ${eventTitle}`,
      html,
    });
  }

  async sendErrorNotification(params: {
    to: string;
    name: string;
    eventTitle: string;
    supportEmail: string;
  }): Promise<void> {
    const { to, name, eventTitle, supportEmail } = params;

    const html = `
      <h1>Registration Issue</h1>
      <p>Hi ${name},</p>
      <p>We encountered an issue while processing your registration for <strong>${eventTitle}</strong>.</p>
      <p>Our team is looking into it. If you need help, please contact ${supportEmail}.</p>
    `;

    await this.sendEmail({
      to,
      subject: `Registration Issue - ${eventTitle}`,
      html,
    });
  }
}

export default new EmailService();
