import { Global, Module } from '@nestjs/common';
import { COMMUNICATION_ATTACHMENT_GATE } from '@prism/contexts/platform-ops';
import { CommercialModule } from '../modules/commercial/commercial.module';
import { CommunicationAttachmentGateService } from '../modules/commercial/application/suppliers/communication-attachment-gate.service';

/** Root composition bridge: Platform authorizes conversation files through Commercial's gate, never its service. */
@Global()
@Module({
  imports: [CommercialModule],
  providers: [{ provide: COMMUNICATION_ATTACHMENT_GATE, useExisting: CommunicationAttachmentGateService }],
  exports: [COMMUNICATION_ATTACHMENT_GATE],
})
export class CommunicationAttachmentGateModule {}
