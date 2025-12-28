import { emailConfig } from '../config/env';
import { logger } from '../config/logger';

/**
 * Format date to Kyiv timezone
 */
const formatKyivDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

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
    basePrice?: number;
    discountAmount?: number;
    promoCode?: string;
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
      basePrice,
      discountAmount,
      promoCode,
    } = params;

    // Build price breakdown HTML
    let priceHtml = '';
    if (basePrice !== undefined && discountAmount !== undefined && discountAmount > 0) {
      const hasDiscount = discountAmount > 0;
      priceHtml = `
        <p><strong>Ціна:</strong></p>
        <ul style="list-style: none; padding-left: 0;">
          <li>Базова ціна: ${basePrice.toFixed(2)} ${paymentCurrency}</li>
          ${hasDiscount ? `<li>Промокод "${promoCode || ''}": -${discountAmount.toFixed(2)} ${paymentCurrency}</li>` : ''}
          <li style="font-weight: bold; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">До оплати: ${paymentAmount.toFixed(2)} ${paymentCurrency}</li>
        </ul>
      `;
    } else {
      priceHtml = `<p><strong>Оплата:</strong> ${paymentAmount.toFixed(2)} ${paymentCurrency}</p>`;
    }

    const html = `
      <h1>Реєстрацію підтверджено</h1>
      <p>Вітаємо, ${name}!</p>
      <p>Вашу реєстрацію на <strong>${eventTitle}</strong> підтверджено.</p>
      <p><strong>Дата події:</strong> ${formatKyivDate(eventDate)}</p>
      <p><strong>Місце проведення:</strong> ${eventLocation}</p>
      ${priceHtml}
      <p><strong>ID реєстрації:</strong> ${registrationId}</p>
      <p>Дякуємо за реєстрацію!</p>
    `;

    await this.sendEmail({
      to,
      subject: `Реєстрацію підтверджено - ${eventTitle}`,
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
      <h1>Оплата не вдалася</h1>
      <p>Вітаємо, ${name}!</p>
      <p>Нам не вдалося завершити вашу оплату за <strong>${eventTitle}</strong>.</p>
      <p>${errorMessage ?? 'Оплату було відхилено або скасовано.'}</p>
      <p>Ви можете спробувати оплатити знову за цим посиланням: <a href="${retryLink}">Спробувати оплату знову</a></p>
      <p>Якщо проблема не зникає, будь ласка, зв'яжіться зі службою підтримки.</p>
    `;

    await this.sendEmail({
      to,
      subject: `Оплата не вдалася - ${eventTitle}`,
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
      <h1>Проблема з реєстрацією</h1>
      <p>Вітаємо, ${name}!</p>
      <p>Ми зіткнулися з проблемою під час обробки вашої реєстрації на <strong>${eventTitle}</strong>.</p>
      <p>Наша команда вже працює над цим. Якщо вам потрібна допомога, будь ласка, зв'яжіться з ${supportEmail}.</p>
    `;

    await this.sendEmail({
      to,
      subject: `Проблема з реєстрацією - ${eventTitle}`,
      html,
    });
  }

  async sendPaymentLink(params: {
    to: string;
    name: string;
    eventTitle: string;
    eventDate: string;
    eventLocation: string;
    paymentAmount: number;
    paymentCurrency: string;
    paymentLink: string;
    registrationId: string;
    basePrice?: number;
    discountAmount?: number;
    promoCode?: string;
  }): Promise<void> {
    const {
      to,
      name,
      eventTitle,
      eventDate,
      eventLocation,
      paymentAmount,
      paymentCurrency,
      paymentLink,
      registrationId,
      basePrice,
      discountAmount,
      promoCode,
    } = params;

    // Build price breakdown HTML
    let priceHtml = '';
    if (basePrice !== undefined && discountAmount !== undefined && discountAmount > 0) {
      const hasDiscount = discountAmount > 0;
      priceHtml = `
        <p><strong>Ціна:</strong></p>
        <ul style="list-style: none; padding-left: 0;">
          <li>Базова ціна: ${basePrice.toFixed(2)} ${paymentCurrency}</li>
          ${hasDiscount ? `<li>Промокод "${promoCode || ''}": -${discountAmount.toFixed(2)} ${paymentCurrency}</li>` : ''}
          <li style="font-weight: bold; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">До оплати: ${paymentAmount.toFixed(2)} ${paymentCurrency}</li>
        </ul>
      `;
    } else {
      priceHtml = `<p><strong>Сума до оплати:</strong> ${paymentAmount.toFixed(2)} ${paymentCurrency}</p>`;
    }

    const html = `
      <h1>Завершіть вашу реєстрацію</h1>
      <p>Вітаємо, ${name}!</p>
      <p>Дякуємо за реєстрацію на <strong>${eventTitle}</strong>!</p>
      <p><strong>Дата події:</strong> ${formatKyivDate(eventDate)}</p>
      <p><strong>Місце проведення:</strong> ${eventLocation}</p>
      ${priceHtml}
      <p><strong>ID реєстрації:</strong> ${registrationId}</p>
      <p>Будь ласка, завершіть оплату, натиснувши на посилання нижче:</p>
      <p style="margin: 30px 0;">
        <a href="${paymentLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Завершити оплату
        </a>
      </p>
      <p>Або скопіюйте та вставте це посилання у ваш браузер:</p>
      <p style="word-break: break-all; color: #666;">${paymentLink}</p>
      <p><strong>Важливо:</strong> Це посилання на оплату дійсне обмежений час. Будь ласка, завершіть оплату якнайшвидше.</p>
      <p>Якщо у вас виникли питання, будь ласка, зв'яжіться з нашою службою підтримки.</p>
    `;

    await this.sendEmail({
      to,
      subject: `Завершіть вашу реєстрацію - ${eventTitle}`,
      html,
    });
  }
}

export default new EmailService();
