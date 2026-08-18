import { config } from '../config/env.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendConsoleEmail(options: EmailOptions): Promise<void> {
  console.log(`[email:console] To: ${options.to}`);
  console.log(`[email:console] Subject: ${options.subject}`);
  console.log(`[email:console] Body:\n${options.text ?? options.html}`);
}

async function sendSmtpEmail(_options: EmailOptions): Promise<void> {
  // TODO: Implement SMTP transport when email provider is configured.
  // Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
  throw new Error('SMTP email not configured. Set EMAIL_PROVIDER=console for development.');
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const provider = config.emailProvider;
  if (provider === 'smtp') {
    return sendSmtpEmail(options);
  }
  return sendConsoleEmail(options);
}
