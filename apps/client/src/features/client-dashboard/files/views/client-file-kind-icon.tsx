import { File, FileImage, FileSpreadsheet, FileText, FileVideo, type LucideIcon } from "lucide-react";
import { cn } from "@/app/components/ui/utils";
import type { ClientFileKind } from "../model/client-file-library";

const KIND: Record<ClientFileKind, { icon: LucideIcon; tone: string }> = {
  pdf: { icon: FileText, tone: "bg-danger-soft text-danger" },
  image: { icon: FileImage, tone: "bg-info-soft text-info" },
  sheet: { icon: FileSpreadsheet, tone: "bg-success-soft text-success" },
  document: { icon: FileText, tone: "bg-info-soft text-info" },
  video: { icon: FileVideo, tone: "bg-attention-soft text-attention" },
  other: { icon: File, tone: "bg-muted text-muted-foreground" },
};

/** A file's type at a glance: PDFs, sheets, images and videos each get their own icon and tint. */
export function ClientFileKindIcon({ kind, className }: { kind: ClientFileKind; className?: string }) {
  const { icon: Icon, tone } = KIND[kind];
  return (
    <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-md", tone, className)}>
      <Icon className="size-4" />
    </span>
  );
}
