"use client";

import { useEffect, useState } from "react";
import { paymentDetailsCommands } from "../data/payment-details-repository";

export type QrImage = { status: "none" } | { status: "loading" } | { status: "ready"; url: string } | { status: "error"; message: string };

/** Loads a stored payment QR into a local object URL, which is released when the image changes or the screen closes. */
export function useQrImage(imageId: string | null): QrImage {
  const [image, setImage] = useState<QrImage>({ status: "none" });
  useEffect(() => {
    if (!imageId) {
      setImage({ status: "none" });
      return;
    }
    let active = true;
    let url: string | null = null;
    setImage({ status: "loading" });
    paymentDetailsCommands.qrImage(imageId)
      .then(({ blob }) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImage({ status: "ready", url });
      })
      .catch((reason: unknown) => {
        if (active) setImage({ status: "error", message: reason instanceof Error ? reason.message : "The QR could not be loaded." });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageId]);
  return image;
}
