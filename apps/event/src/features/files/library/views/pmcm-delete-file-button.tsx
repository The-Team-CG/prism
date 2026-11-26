"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@prism/ui/components/button";

/** Deleting can't be undone, so the first click only asks; the second deletes. */
export function PmcmDeleteFileButton({ fileName, disabled, onDelete }: { fileName: string; disabled: boolean; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="ghost" disabled={disabled} onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" />
        Delete
      </Button>
    );
  }
  return (
    <div role="group" aria-label={`Delete ${fileName}`} className="flex w-full flex-wrap items-center gap-2">
      <p className="text-sm">Delete {fileName}? The client will no longer see it, and this can't be undone.</p>
      <Button type="button" size="sm" variant="destructive" disabled={disabled} onClick={onDelete}>Delete file</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button>
    </div>
  );
}
