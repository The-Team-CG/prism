import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../utils";
import { formatAttachmentSize, type ChatAttachmentDownload, type ChatAttachmentRecord } from "./chat-display";

/** Fetches a file's bytes through the portal's download authorization. */
export type ChatAttachmentDownloader = (attachmentId: string) => Promise<ChatAttachmentDownload>;

/** The files on one message, as rows: name, size and a download. Images also show a small preview. */
export function MessageAttachments({ attachments, mine, download }: { attachments: ChatAttachmentRecord[]; mine: boolean; download?: ChatAttachmentDownloader }) {
  return (
    <ul className="flex w-full flex-col gap-1.5">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <AttachmentRow attachment={attachment} mine={mine} download={download} />
        </li>
      ))}
    </ul>
  );
}

function AttachmentRow({ attachment, mine, download }: { attachment: ChatAttachmentRecord; mine: boolean; download?: ChatAttachmentDownloader }) {
  const [preview, setPreview] = useState<string>();
  const [failed, setFailed] = useState(false);
  const image = attachment.contentType.startsWith("image/");

  useEffect(() => {
    if (!image || !download) return;
    let url: string | undefined;
    let current = true;
    download(attachment.id).then(
      ({ blob }) => {
        if (!current) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      },
      () => undefined,
    );
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id, image, download]);

  async function save() {
    if (!download) return;
    setFailed(false);
    try {
      const { blob, fileName } = await download(attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      // The browser starts the download from the URL on click; it is released after the browser has had time to read it.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {preview ? <img src={preview} alt={attachment.fileName} className="max-h-48 w-full rounded-lg object-cover" /> : null}
      <div className={cn("flex items-center gap-2 rounded-xl px-2.5 py-1.5", mine ? "bg-primary-foreground/15" : "bg-muted")}>
        <FileText className="size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{attachment.fileName}</p>
          <p className="text-[11px] opacity-75">{formatAttachmentSize(attachment.byteSize)}</p>
          {failed ? <p role="alert" className="text-[11px] text-danger">Unable to download this file</p> : null}
        </div>
        {download ? (
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 shadow-none" aria-label={`Download ${attachment.fileName}`} onClick={() => void save()}>
            <Download />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
