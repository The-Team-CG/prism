import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Put, Req, StreamableFile, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { PAYMENT_QR_MAX_BYTES, savePaymentDetailsSchema, type PrismVerifiedEventActor, type SavePaymentDetailsInput } from '@prism/types';
import { PaymentDetailsService } from '../../application/billing/payment-details.service';

/** PMCM's payment details and QR images: what clients are told to pay to. PMCM finance only. */
@Controller('payment-details')
@UseGuards(EventSessionGuard)
export class PaymentDetailsController {
  constructor(private readonly details: PaymentDetailsService) {}

  @Get()
  read(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.details.read(actor);
  }

  @Put()
  save(@Body(zodBody(savePaymentDetailsSchema)) input: SavePaymentDetailsInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.details.save(input, actor);
  }

  /** The raw image bytes, with the image's own content type. */
  @Post('qr-images')
  @HttpCode(HttpStatus.CREATED)
  async uploadQr(@Req() request: Request, @Headers('content-type') contentType: string | undefined, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.details.uploadQr(await this.readRequestBytes(request), contentType, actor);
  }

  @Get('qr-images/:imageId')
  async qr(@Param('imageId') imageId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    const image = await this.details.readQr(imageId, actor);
    return new StreamableFile(image.bytes, { type: image.contentType });
  }

  /** Reads at most one byte over the limit, so an oversized upload is refused without being held in memory. */
  private async readRequestBytes(request: Request): Promise<Buffer> {
    const declaredLength = Number(request.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > PAYMENT_QR_MAX_BYTES) throw new BadRequestException('The QR image must be 1 MB or smaller');
    const chunks: Buffer[] = [];
    let byteSize = 0;
    for await (const chunk of request as unknown as AsyncIterable<Uint8Array>) {
      const bytes = Buffer.from(chunk);
      byteSize += bytes.byteLength;
      if (byteSize > PAYMENT_QR_MAX_BYTES) throw new BadRequestException('The QR image must be 1 MB or smaller');
      chunks.push(bytes);
    }
    return Buffer.concat(chunks, byteSize);
  }
}
