import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PRIVACY_NOTICE_METADATA = 'allowPendingPrivacyNotice';

/** Lets a signed-in account whose privacy notice is pending reach this route: sign-out, self, and acknowledgement. */
export const AllowPendingPrivacyNotice = () => SetMetadata(ALLOW_PENDING_PRIVACY_NOTICE_METADATA, true);
