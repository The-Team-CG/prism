import { Module } from '@nestjs/common';
import { COMMERCIAL_ADDENDUM_IMPACT_WRITER } from './contracts/addendum-impact-writer.port';
import { CommercialAddendumImpactService } from './application/billing/commercial-addendum-impact.service';

/** Narrow Commercial owner capability for addendum impacts; it has no Lifecycle dependency. */
@Module({
  providers: [CommercialAddendumImpactService, { provide: COMMERCIAL_ADDENDUM_IMPACT_WRITER, useExisting: CommercialAddendumImpactService }],
  exports: [COMMERCIAL_ADDENDUM_IMPACT_WRITER],
})
export class CommercialAddendumImpactModule {}
