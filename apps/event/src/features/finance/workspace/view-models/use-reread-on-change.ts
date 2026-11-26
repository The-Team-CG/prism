"use client";

import { useEffect, useRef } from "react";
import { useInvalidate, type Resource } from "@prism/portal-query";

/**
 * Reads a resource again whenever `changes` changes, for a read that other records on the page can make out of date.
 * Not on mount: the read the page (or its route prefetch) just made is already current.
 */
export function useRereadOnChange<Params, Data>(resource: Resource<Params, Data>, params: Params, changes: string) {
  const invalidate = useInvalidate();
  const seen = useRef(changes);
  useEffect(() => {
    if (seen.current === changes) return;
    seen.current = changes;
    void invalidate(resource, params);
  }, [changes, invalidate, params, resource]);
}
