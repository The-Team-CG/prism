"use client";
import { formatPortalDate } from "@prism/ui/format-date";
import { Card, CardContent } from "@prism/ui/components/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@prism/ui/components/item";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { formatStatusLabel } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientScheduleView() {
  const { selectedEvent, payments } = useClientWorkspace();

  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        <ItemGroup className="gap-0">
          <Item className="rounded-none border-0 border-b border-border">
            <ItemContent>
              <ItemTitle>Event date</ItemTitle>
              <ItemDescription>{selectedEvent ? formatPortalDate(selectedEvent.eventDate) : "Pending"}</ItemDescription>
            </ItemContent>
          </Item>
          {payments.map((payment) => (
            <Item key={payment.id} className="rounded-none border-0 border-b border-border last:border-b-0">
              <ItemContent>
                <ItemTitle>{payment.label}</ItemTitle>
                <ItemDescription>Payment due {formatPortalDate(payment.dueDate)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <StatusBadge status={payment.status} label={formatStatusLabel(payment.status)} />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
