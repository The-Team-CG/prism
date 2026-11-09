"use client";

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

type TitleSetter = (title: string | null) => void;

const DocumentTitleContext = createContext<TitleSetter>(() => undefined);

/**
 * The one writer of a portal's browser tab title. Next's metadata title is re-applied on navigation and overwrites a
 * page's own title, so the root layout names no title and this element renders it from page state instead.
 */
export function DocumentTitleProvider({ defaultTitle, children }: { defaultTitle: string; children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return (
    <DocumentTitleContext.Provider value={setTitle}>
      <title>{title ?? defaultTitle}</title>
      {children}
    </DocumentTitleContext.Provider>
  );
}

/** Names the open page in the tab. Leaving the page, or changing its title, restores the default or the new title. */
export function useDocumentTitle(title: string | undefined) {
  const setTitle = useContext(DocumentTitleContext);
  useLayoutEffect(() => {
    if (!title) return;
    setTitle(title);
    return () => setTitle(null);
  }, [setTitle, title]);
}
