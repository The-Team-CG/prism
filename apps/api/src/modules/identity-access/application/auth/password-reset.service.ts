import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../kernel/database';
import { AuthSecurityService } from './auth-security.service';
import { PASSWORD_RESET_DELIVERY, type PasswordResetDeliveryPort } from '../../contracts/password-reset-delivery.port';

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const GENERIC_MESSAGE = 'If an account exists for that email, password reset instructions will be sent.';
const UNAVAILABLE_MESSAGE = 'If an account exists for that email, password reset delivery is currently unavailable. Contact PMCM for help.';

function tokenHash(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(PASSWORD_RESET_DELIVERY) private readonly delivery?: PasswordResetDeliveryPort,
  ) {}

  async request(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.opsUser.findUnique({ where: { email: normalizedEmail } });
    const configuredDelivery = Boolean(this.delivery && this.buildTrustedResetUrl('placeholder'));
    let deliveryAvailable = configuredDelivery;
    if (user) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      await this.prisma.$transaction(async (tx) => {
        await tx.opsPasswordResetToken.deleteMany({ where: { userId: user.id, consumedAt: null } });
        await tx.opsPasswordResetToken.create({
          data: { id: `prt_${randomUUID()}`, userId: user.id, tokenHash: tokenHash(token), expiresAt },
        });
      });

      const resetUrl = this.buildTrustedResetUrl(token);
      if (resetUrl && this.delivery) {
        try {
          await this.delivery.deliver({ recipient: user.email, resetUrl });
        } catch {
          deliveryAvailable = false;
          this.logger.warn('Password reset provider failed; token remains un-delivered and can expire safely');
        }
      }
    }
    return { message: deliveryAvailable ? GENERIC_MESSAGE : UNAVAILABLE_MESSAGE, deliveryAvailable };
  }

  async consume(token: string, password: string) {
    const hash = tokenHash(token);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.opsPasswordResetToken.findUnique({ where: { tokenHash: hash } });
      if (!candidate || candidate.consumedAt || candidate.expiresAt <= now) throw new BadRequestException('Invalid or expired password reset token');

      const consumed = await tx.opsPasswordResetToken.updateMany({
        where: { id: candidate.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new BadRequestException('Invalid or expired password reset token');

      await tx.opsUser.update({
        where: { id: candidate.userId },
        data: { password: AuthSecurityService.hashPassword(password), sessionVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null },
      });
    });
    return { message: 'Password reset completed. Please sign in again.' };
  }

  private buildTrustedResetUrl(token: string) {
    const configured = process.env.PRISM_PORTAL_RESET_URL?.trim();
    if (!configured) return null;
    try {
      const url = new URL(configured);
      const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null;
      if (url.username || url.password || url.hash) return null;
      url.searchParams.set('token', token);
      return url.toString();
    } catch {
      return null;
    }
  }
}
