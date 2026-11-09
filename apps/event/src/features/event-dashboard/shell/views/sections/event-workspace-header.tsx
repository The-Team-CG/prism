"use client";

import { AlertTriangle } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { Card, CardBody } from "./shell-ui";

export function EmptyEventWorkspace() {
  return (
    <Card>
      <CardBody>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle>No confirmed events</EmptyTitle>
            <EmptyDescription>Accept an inquiry and upload signed conforme to create the first PMCM event workspace.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardBody>
    </Card>
  );
}
