"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { PrismFigureStrip, PrismListRow, type PrismListFigure, type PrismListTone } from "@prism/ui/action-list";

/**
 * The shared work list (`@prism/ui/action-list`) bound to Next's router, so rows and figures open in-app pages
 * without a full reload. The same rows make up the PMCM Inbox and the supplier's Today.
 */
export { PrismListEmpty as ClientListEmpty, PrismListSection as ClientListSection } from "@prism/ui/action-list";
export type ClientRowTone = PrismListTone;
export type ClientFigure = PrismListFigure;

export function ClientListRow(props: Omit<ComponentProps<typeof PrismListRow>, "link">) {
  return <PrismListRow {...props} link={Link} />;
}

export function ClientFigureStrip(props: Omit<ComponentProps<typeof PrismFigureStrip>, "link">) {
  return <PrismFigureStrip {...props} link={Link} />;
}
