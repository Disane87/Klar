import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { mailConfig, appConfig } from '../config/app.config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    @Inject(mailConfig.KEY) private readonly mail: ConfigType<typeof mailConfig>,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      ...(mail.user && mail.pass ? { auth: { user: mail.user, pass: mail.pass } } : {}),
    });
  }

  async sendVerificationEmail(
    to: string,
    displayName: string,
    token: string,
  ): Promise<void> {
    const verifyUrl = `${this.app.frontendUrl}/verify-email?token=${token}`;
    const year = new Date().getFullYear();
    const html = this.compile('email-verification', { displayName, verifyUrl, year });
    await this.transporter.sendMail({
      from: `"${this.mail.fromName}" <${this.mail.from}>`,
      to,
      subject: 'Bitte bestätige deine E-Mail-Adresse — Klar',
      html,
    });
    this.logger.log(`Verification email sent to ${to}`);
  }

  private compile(template: string, context: Record<string, unknown>): string {
    const templatePath = path.join(__dirname, 'templates', `${template}.hbs`);
    const source = fs.readFileSync(templatePath, 'utf-8');
    return Handlebars.compile(source)(context);
  }
}
