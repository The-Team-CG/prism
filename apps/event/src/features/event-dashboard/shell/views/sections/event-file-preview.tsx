"use client";

import type { PrismEvent } from "@prism/types";
import type { EventFileHubItem } from "./event-file-types";

const phpMoney = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });


export function EventFilePreview({ event, item }: { event: PrismEvent; item: EventFileHubItem }) {
  return (
    <div className="min-h-[30rem] bg-[#f8fbf8] p-5">
      <div className="mx-auto max-w-3xl rounded-md border border-border bg-white p-7 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-2xl font-black text-foreground">
              {item.kind === "invoice" ? "Invoice" : item.kind === "floorplan" ? "Floor Plan" : item.category}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.meta}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-primary">P.R.I.S.M.</p>
            <p className="mt-1 text-xs text-muted-foreground">PMCM Event Operations</p>
            <p className="text-xs text-muted-foreground">{event.eventDate}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 border-y border-border py-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Event</p>
            <p className="mt-2 text-sm font-black text-foreground">{event.eventName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{event.clientName}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">File owner</p>
            <p className="mt-2 text-sm font-black text-foreground">{item.owner}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.date}</p>
          </div>
        </div>

        {item.kind === "floorplan" ? (
          <div className="mt-7 overflow-hidden rounded-md border border-border bg-[#fff6ee]">
            <div className="relative aspect-16/9 bg-[linear-gradient(#eadbd3_1px,transparent_1px),linear-gradient(90deg,#eadbd3_1px,transparent_1px)] bg-size-[24px_24px]">
              <div className="absolute left-[12%] top-[18%] h-[24%] w-[28%] rounded-sm border border-primary/35 bg-primary/10" />
              <div className="absolute right-[14%] top-[16%] h-[18%] w-[22%] rounded-sm border border-(--prism-amber)/45 bg-(--prism-amber)/15" />
              <div className="absolute bottom-[18%] left-[18%] grid grid-cols-6 gap-2">
                {Array.from({ length: 24 }).map((_, index) => (
                  <span key={index} className="size-3 rounded-full bg-(--prism-success)/60" />
                ))}
              </div>
              <div className="absolute bottom-[14%] right-[14%] h-3 w-32 rounded-full bg-primary/70" />
            </div>
          </div>
        ) : (
          <div className="mt-7 overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[1fr_6rem_7rem] bg-muted/45 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              <span>Item</span>
              <span>Qty</span>
              <span className="text-right">Amount</span>
            </div>
            {[
              ["Event planning document", "1", item.amount ? phpMoney.format(item.amount) : "Attached"],
              ["Client and operations reference", "1", item.status],
              ["PMCM audit-safe copy", "1", item.extension],
            ].map(([labelText, qty, amount]) => (
              <div key={labelText} className="grid grid-cols-[1fr_6rem_7rem] border-t border-border px-4 py-3 text-xs">
                <span className="font-semibold text-foreground">{labelText}</span>
                <span className="text-muted-foreground">{qty}</span>
                <span className="text-right font-bold text-foreground">{amount}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {["Status", "Category", "Source"].map((labelText) => (
            <div key={labelText} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{labelText}</p>
              <p className="mt-1 truncate text-xs font-black text-foreground">
                {labelText === "Status" ? item.status : labelText === "Category" ? item.category : item.subtitle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

