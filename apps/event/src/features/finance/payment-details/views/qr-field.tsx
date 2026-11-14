"use client";

import { useRef, useState } from "react";
import { QrCode, Upload } from "lucide-react";
import { PAYMENT_QR_CONTENT_TYPES } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { useQrImage } from "../view-models/use-qr-image";

/** A stored QR as an image, or a quiet placeholder while it loads or when it cannot be shown. */
export function QrPicture({ imageId, size }: { imageId: string | null; size: number }) {
  const image = useQrImage(imageId);
  const [undrawable, setUndrawable] = useState<string | null>(null);
  const box = { width: size, height: size };
  if (image.status === "ready" && undrawable !== image.url) {
    return <img src={image.url} alt="Payment QR" style={box} onError={() => setUndrawable(image.url)} className="rounded-md border border-border bg-white object-contain" />;
  }
  const note = image.status === "error" ? image.message : image.status === "ready" ? "This image could not be shown. Upload it again." : null;
  return (
    <span style={box} title={note ?? undefined} className="grid place-items-center rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
      <QrCode aria-hidden className="size-1/3" />
    </span>
  );
}

/** Upload, preview and remove the QR clients scan from their own banking app. */
export function QrField({ imageId, uploading, onUpload, onRemove }: { imageId: string | null; uploading: boolean; onUpload: (file: File) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <QrPicture imageId={imageId} size={128} />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => input.current?.click()}>
            <Upload className="size-4" aria-hidden /> {uploading ? "Uploading…" : imageId ? "Replace QR" : "Upload QR"}
          </Button>
          {imageId ? <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={onRemove}>Remove QR</Button> : null}
        </div>
        <p className="text-xs text-muted-foreground">PNG or JPEG, up to 1 MB. Use the QR your bank or e-wallet app shows for receiving money.</p>
        <input
          ref={input} type="file" accept={PAYMENT_QR_CONTENT_TYPES.join(",")} className="sr-only" aria-label="QR image file" tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onUpload(file);
          }}
        />
      </div>
    </div>
  );
}
