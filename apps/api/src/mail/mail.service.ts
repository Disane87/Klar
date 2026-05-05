import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { EmailStatus } from '@prisma/client';
import { mailConfig, appConfig } from '../config/app.config';
import { PrismaService } from '../prisma/prisma.service';

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  template: string;
  userId?: string;
  householdId?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    @Inject(mailConfig.KEY) private readonly mail: ConfigType<typeof mailConfig>,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
    private readonly prisma: PrismaService,
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
    userId?: string,
  ): Promise<void> {
    const verifyUrl = `${this.app.frontendUrl}/verify-email?token=${token}`;
    const year = new Date().getFullYear();
    const html = this.compile('email-verification', { displayName, verifyUrl, year });
    await this.send({
      to,
      subject: 'Bitte bestätige deine E-Mail-Adresse — Klar',
      html,
      template: 'email-verification',
      userId,
    });
  }

  async sendInviteEmail(
    to: string,
    inviterName: string,
    householdName: string,
    inviteUrl: string,
    expiresAt?: Date,
    householdId?: string,
  ): Promise<void> {
    const year = new Date().getFullYear();
    const expiresAtStr = expiresAt
      ? expiresAt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : undefined;
    const html = this.compile('invite', { inviterName, householdName, inviteUrl, expiresAt: expiresAtStr, year });
    await this.send({
      to,
      subject: `${inviterName} lädt dich zu "${householdName}" ein — Klar`,
      html,
      template: 'invite',
      householdId,
    });
  }

  private async send(args: SendArgs): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${this.mail.fromName}" <${this.mail.from}>`,
        to: args.to,
        subject: args.subject,
        html: args.html,
      });
      this.logger.log(`Email sent: template=${args.template} to=${args.to}`);
      this.logEmail(args, EmailStatus.SENT);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Email FAILED: template=${args.template} to=${args.to} — ${message}`);
      this.logEmail(args, EmailStatus.FAILED, message);
      throw err;
    }
  }

  private logEmail(args: SendArgs, status: EmailStatus, error?: string): void {
    this.prisma.emailLog
      .create({
        data: {
          to: args.to,
          subject: args.subject,
          template: args.template,
          status,
          error: error ?? null,
          userId: args.userId ?? null,
          householdId: args.householdId ?? null,
        },
      })
      .catch((err: unknown) => {
        this.logger.warn({ err }, 'EmailLog write failed — non-fatal');
      });
  }

  private compile(template: string, context: Record<string, unknown>): string {
    const templatePath = path.join(__dirname, 'templates', `${template}.hbs`);
    const source = fs.readFileSync(templatePath, 'utf-8');
    return Handlebars.compile(source)(context);
  }
}
