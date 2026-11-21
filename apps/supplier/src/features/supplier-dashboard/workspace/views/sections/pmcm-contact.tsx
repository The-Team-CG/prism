"use client";

import Link from "next/link";
import { Mail, MessageSquareText, Phone } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import type { PrismSupportContact } from "@prism/ui/account-help";

/**
 * Every way this supplier can reach PMCM right now, as buttons: Messages once they have a booking (threads belong to
 * an event), and PMCM's email and phone when the deployment sets them. `subject` pre-fills the email.
 */
export function PmcmContactButtons({ contact, canMessage, subject, size = "default" }: {
  contact: PrismSupportContact;
  canMessage: boolean;
  subject: string;
  size?: "default" | "sm";
}) {
  if (!canMessage && !contact.email && !contact.phone) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canMessage ? (
        <Button asChild size={size}><Link href="/dashboard/messages"><MessageSquareText className="size-4" aria-hidden /> Message PMCM</Link></Button>
      ) : null}
      {contact.email ? (
        <Button asChild size={size} variant={canMessage ? "outline" : "default"}>
          <a href={`mailto:${contact.email}?subject=${encodeURIComponent(subject)}`}><Mail className="size-4" aria-hidden /> Email PMCM</a>
        </Button>
      ) : null}
      {contact.phone ? (
        <Button asChild size={size} variant="outline">
          <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}><Phone className="size-4" aria-hidden /> Call {contact.phone}</a>
        </Button>
      ) : null}
    </div>
  );
}
