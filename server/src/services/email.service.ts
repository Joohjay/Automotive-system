import nodemailer from 'nodemailer';

import { config } from '../config/env.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 5_000,
    socketTimeout: 15_000,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  });
  return transporter;
}

async function sendConsoleEmail(options: EmailOptions): Promise<void> {
  console.log(`[email:console] To: ${options.to}`);
  console.log(`[email:console] Subject: ${options.subject}`);
  console.log(`[email:console] Body:\n${options.text ?? options.html}`);
}

async function sendSmtpEmail(options: EmailOptions): Promise<void> {
  const transport = getTransporter();
  await transport.sendMail({
    from: config.smtp.from ?? config.smtp.user,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const provider = config.emailProvider;
  if (provider === 'smtp') {
    return sendSmtpEmail(options);
  }
  return sendConsoleEmail(options);
}

export async function verifyConnection(): Promise<boolean> {
  if (config.emailProvider !== 'smtp') return true;
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('[email] SMTP connection verified');
    return true;
  } catch (err) {
    console.warn('[email] SMTP connection failed:', (err as Error).message);
    return false;
  }
}
