"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@prism/ui/components/empty-state";
import { Card, CardBody } from "./shell-ui";

export function EmptyEventWorkspace() {
  return (
    <Card>
      <CardBody>
        <EmptyState
          icon={AlertTriangle}
          title="No confirmed events"
          description="Accept an inquiry and upload signed conforme to create the first PMCM event workspace."
        />
      </CardBody>
    </Card>
  );
}
