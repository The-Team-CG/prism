import { File, FileImage, FileSpreadsheet, FileText, FileVideo } from "lucide-react";
import type { PmcmFileKind } from "../model/pmcm-file-library";

const ICONS = { pdf: FileText, document: FileText, image: FileImage, sheet: FileSpreadsheet, video: FileVideo, other: File } as const;
const COLORS: Record<PmcmFileKind, string> = {
  pdf: "bg-destructive/10 text-destructive",
  document: "bg-primary/10 text-primary",
  image: "bg-sky-500/10 text-sky-600",
  sheet: "bg-emerald-500/10 text-emerald-600",
  video: "bg-violet-500/10 text-violet-600",
  other: "bg-muted text-muted-foreground",
};

export function PmcmFileKindIcon({ kind, className = "size-9" }: { kind: PmcmFileKind; className?: string }) {
  const Icon = ICONS[kind];
  return <span className={`grid shrink-0 place-items-center rounded-lg ${COLORS[kind]} ${className}`} aria-hidden="true"><Icon className="size-4" /></span>;
}
