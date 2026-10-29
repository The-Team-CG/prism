"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PrismApiError } from "@prism/api-client";
import {
  pmcmSupplierDirectoryQuerySchema,
  type PmcmSupplierDirectoryQuery,
  type PmcmSupplierHistoryQuery,
  type PmcmSupplierProfileQuery,
  type PmcmSupplierRecordsQuery,
  type PrismPmcmSupplierCertificationsPage,
  type PrismPmcmSupplierDirectoryPage,
  type PrismPmcmSupplierEngagement,
  type PrismPmcmSupplierPage,
  type PrismPmcmSupplierProfile,
  type PrismPmcmSupplierRecordsPage,
  type PrismPmcmSupplierReviewsPage,
  type PrismSupplierCategory,
} from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { normalizeSupplierDirectoryRoute } from "../model/suppliers-directory-rules";
import { loadSupplierCategories, loadSupplierDirectory } from "../use-cases/load-supplier-directory";
import {
  loadSupplierCertifications,
  loadSupplierDetail,
  loadSupplierEngagements,
  loadSupplierRecords,
  loadSupplierReviews,
} from "../use-cases/load-supplier-detail";
import { submitSupplierAction, type SupplierActionDraft } from "../use-cases/submit-supplier-action";
import type { SupplierActionResult } from "../use-cases/save-supplier-action";

const FRESH_FOR_MS = 30_000;
const EMPTY_HISTORY_QUERY: PmcmSupplierHistoryQuery = { page: 0, pageSize: 25 };

type ReadState<T> = {
  key: string;
  data: T | null;
  loading: boolean;
  error: string | null;
};

const initialReadState = <T,>(): ReadState<T> => ({ key: "", data: null, loading: false, error: null });

function actorKey(session: EventSession | null) {
  if (!session) return "";
  return `${session.id}:${session.sessionVersion ?? 0}:${session.signedInAt}`;
}

function readError(error: unknown) {
  if (error instanceof PrismApiError && error.status === 404) return "Supplier not found.";
  return error instanceof Error ? error.message : "Unable to load supplier data.";
}

function isAuthorizationError(error: unknown): error is PrismApiError {
  return error instanceof PrismApiError && (error.status === 401 || error.status === 403);
}

function privateRead<T>(state: ReadState<T>, key: string) {
  return state.key === key ? state : initialReadState<T>();
}

function routeQueryString(query: PmcmSupplierDirectoryQuery, supplierId: string | null) {
  const params = new URLSearchParams();
  params.set("q", query.q);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.tier) params.set("tier", query.tier);
  params.set("rating", query.rating);
  params.set("sort", query.sort);
  params.set("direction", query.direction);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (supplierId) params.set("supplierId", supplierId);
  return params.toString();
}

export function useSupplierDirectoryViewModel({ view, session }: { view: string; session: EventSession | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const ownerKey = actorKey(session);
  const canRead = session?.role === "pmcm-admin";
  const [categories, setCategories] = useState<PrismSupplierCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [query, setQuery] = useState<PmcmSupplierDirectoryQuery>(() => pmcmSupplierDirectoryQuerySchema.parse({}));
  const queryRef = useRef(query);
  const [searchDraft, setSearchDraft] = useState("");
  const [directoryState, setDirectoryState] = useState<ReadState<PrismPmcmSupplierDirectoryPage>>(initialReadState);
  const [profileState, setProfileState] = useState<ReadState<PrismPmcmSupplierProfile>>(initialReadState);
  const [engagementsState, setEngagementsState] = useState<ReadState<PrismPmcmSupplierPage<PrismPmcmSupplierEngagement>>>(initialReadState);
  const [reviewsState, setReviewsState] = useState<ReadState<PrismPmcmSupplierReviewsPage>>(initialReadState);
  const [certificationsState, setCertificationsState] = useState<ReadState<PrismPmcmSupplierCertificationsPage>>(initialReadState);
  const [recordsState, setRecordsState] = useState<ReadState<PrismPmcmSupplierRecordsPage>>(initialReadState);
  const [profilePeriod, setProfilePeriod] = useState<PmcmSupplierProfileQuery["period"]>("all");
  const [recordsPeriod, setRecordsPeriod] = useState<PmcmSupplierRecordsQuery["period"]>("30d");
  const [engagementPage, setEngagementPage] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionResult, setActionResult] = useState<SupplierActionResult | null>(null);
  const lastRefreshAt = useRef(0);
  const activeRequestIds = useRef<Record<string, number>>({});
  const refreshController = useRef<AbortController | null>(null);
  const supplierId = searchParams.get("supplierId") || null;

  const route = useMemo(
    () => normalizeSupplierDirectoryRoute(view, new URLSearchParams(searchKey), categories),
    [categories, searchKey, view],
  );

  const currentDirectory = privateRead(directoryState, ownerKey);
  const profileKey = `${ownerKey}:${supplierId ?? ""}`;
  const currentProfile = privateRead(profileState, profileKey);
  const currentEngagements = privateRead(engagementsState, profileKey);
  const currentReviews = privateRead(reviewsState, profileKey);
  const currentCertifications = privateRead(certificationsState, profileKey);
  const currentRecords = privateRead(recordsState, profileKey);

  function replaceUrl(nextQuery: PmcmSupplierDirectoryQuery, nextSupplierId = supplierId, mode: "push" | "replace" = "replace") {
    const queryString = routeQueryString(nextQuery, nextSupplierId);
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    if (mode === "push") router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  }

  const updateQuery = useCallback((patch: Partial<PmcmSupplierDirectoryQuery>) => {
    const next = pmcmSupplierDirectoryQuerySchema.parse({ ...queryRef.current, ...patch });
    queryRef.current = next;
    setQuery(next);
    replaceUrl(next);
  }, [pathname, router, supplierId]);

  const openSupplier = useCallback((nextSupplierId: string) => {
    replaceUrl(queryRef.current, nextSupplierId, "push");
  }, [pathname, router, supplierId]);

  const closeSupplier = useCallback(() => {
    replaceUrl(queryRef.current, null, "replace");
  }, [pathname, router, supplierId]);

  const clearPrivateReads = useCallback(() => {
    for (const key of ["directory", "profile", "engagements", "reviews", "certifications", "records"]) {
      activeRequestIds.current[key] = (activeRequestIds.current[key] ?? 0) + 1;
    }
    setDirectoryState(initialReadState());
    setProfileState(initialReadState());
    setEngagementsState(initialReadState());
    setReviewsState(initialReadState());
    setCertificationsState(initialReadState());
    setRecordsState(initialReadState());
  }, []);

  useEffect(() => {
    if (!canRead || !ownerKey) {
      setCategories([]);
      setCategoriesLoaded(false);
      clearPrivateReads();
      return;
    }
    const controller = new AbortController();
    setCategoriesLoaded(false);
    loadSupplierCategories(controller.signal)
      .then((result) => {
        setCategories(result);
        setCategoriesError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCategoriesError(readError(error));
        if (isAuthorizationError(error)) clearPrivateReads();
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoriesLoaded(true);
      });
    return () => controller.abort();
  }, [canRead, ownerKey, clearPrivateReads]);

  useEffect(() => {
    if (!categoriesLoaded) return;
    queryRef.current = route.query;
    setQuery((current) => Object.keys(route.query).every((key) => current[key as keyof PmcmSupplierDirectoryQuery] === route.query[key as keyof PmcmSupplierDirectoryQuery]) ? current : route.query);
  }, [categoriesLoaded, route.query, searchKey]);

  useEffect(() => {
    if (categoriesLoaded) setSearchDraft(route.query.q);
  }, [categoriesLoaded, route.query.q]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchDraft !== queryRef.current.q) updateQuery({ q: searchDraft, page: 0 });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchDraft, updateQuery]);

  useEffect(() => {
    if (!canRead || !ownerKey || !categoriesLoaded) return;
    const requestKey = "directory";
    const requestId = (activeRequestIds.current[requestKey] ?? 0) + 1;
    activeRequestIds.current[requestKey] = requestId;
    const controller = new AbortController();
    setDirectoryState((current) => ({
      key: ownerKey,
      data: current.key === ownerKey ? current.data : null,
      loading: true,
      error: null,
    }));
    loadSupplierDirectory(query, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || activeRequestIds.current[requestKey] !== requestId) return;
        setDirectoryState({ key: ownerKey, data, loading: false, error: null });
        lastRefreshAt.current = Date.now();
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || activeRequestIds.current[requestKey] !== requestId) return;
        if (isAuthorizationError(error)) {
          clearPrivateReads();
          setDirectoryState(initialReadState());
          return;
        }
        setDirectoryState((current) => ({
          key: ownerKey,
          data: current.key === ownerKey ? current.data : null,
          loading: false,
          error: readError(error),
        }));
      });
    return () => controller.abort();
  }, [canRead, ownerKey, categoriesLoaded, query, refreshVersion, clearPrivateReads]);

  useEffect(() => {
    if (!canRead || !ownerKey || !supplierId) {
      setProfileState(initialReadState());
      setEngagementsState(initialReadState());
      setReviewsState(initialReadState());
      setCertificationsState(initialReadState());
      setRecordsState(initialReadState());
      return;
    }
    const key = `${ownerKey}:${supplierId}`;
    const requestId = (activeRequestIds.current.profile ?? 0) + 1;
    activeRequestIds.current.profile = requestId;
    const controller = new AbortController();
    setProfileState((current) => ({
      key,
      data: current.key === key ? current.data : null,
      loading: true,
      error: null,
    }));
    loadSupplierDetail(supplierId, { period: profilePeriod }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || activeRequestIds.current.profile !== requestId) return;
        setProfileState({ key, data, loading: false, error: null });
        lastRefreshAt.current = Date.now();
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || activeRequestIds.current.profile !== requestId) return;
        if (isAuthorizationError(error)) {
          clearPrivateReads();
          return;
        }
        setProfileState((current) => ({
          key,
          data: current.key === key ? current.data : null,
          loading: false,
          error: readError(error),
        }));
      });
    return () => controller.abort();
  }, [canRead, ownerKey, supplierId, profilePeriod, refreshVersion, clearPrivateReads]);

  useEffect(() => {
    setEngagementPage(0);
  }, [supplierId]);

  useEffect(() => {
    if (!canRead || !ownerKey || !supplierId) return;
    const key = `${ownerKey}:${supplierId}`;
    const controller = new AbortController();
    const loadSection = <T,>(requestKey: string, promise: Promise<T>, setter: Dispatch<SetStateAction<ReadState<T>>>) => {
      const requestId = (activeRequestIds.current[requestKey] ?? 0) + 1;
      activeRequestIds.current[requestKey] = requestId;
      setter((current) => ({ key, data: current.key === key ? current.data : null, loading: true, error: null }));
      promise.then((data) => {
        if (controller.signal.aborted || activeRequestIds.current[requestKey] !== requestId) return;
        setter({ key, data, loading: false, error: null });
      }).catch((error: unknown) => {
        if (controller.signal.aborted || activeRequestIds.current[requestKey] !== requestId) return;
        if (isAuthorizationError(error)) {
          clearPrivateReads();
          return;
        }
        setter((current) => ({ key, data: current.key === key ? current.data : null, loading: false, error: readError(error) }));
      });
    };
    loadSection("engagements", loadSupplierEngagements(supplierId, { ...EMPTY_HISTORY_QUERY, page: engagementPage }, controller.signal), setEngagementsState);
    loadSection("reviews", loadSupplierReviews(supplierId, EMPTY_HISTORY_QUERY, controller.signal), setReviewsState);
    loadSection("certifications", loadSupplierCertifications(supplierId, EMPTY_HISTORY_QUERY, controller.signal), setCertificationsState);
    loadSection("records", loadSupplierRecords(supplierId, { ...EMPTY_HISTORY_QUERY, period: recordsPeriod }, controller.signal), setRecordsState);
    return () => controller.abort();
  }, [canRead, ownerKey, supplierId, engagementPage, recordsPeriod, refreshVersion, clearPrivateReads]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAt.current >= FRESH_FOR_MS) {
        setRefreshVersion((version) => version + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const refresh = useCallback(async () => {
    if (!canRead || !ownerKey) return;
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    const selectedId = supplierId;
    const selectedKey = `${ownerKey}:${selectedId ?? ""}`;
    const refreshOne = async <T,>(
      requestKey: string,
      load: (signal: AbortSignal) => Promise<T>,
      setter: Dispatch<SetStateAction<ReadState<T>>>,
      stateKey: string,
    ) => {
      const requestId = (activeRequestIds.current[requestKey] ?? 0) + 1;
      activeRequestIds.current[requestKey] = requestId;
      setter((current) => ({ key: stateKey, data: current.key === stateKey ? current.data : null, loading: true, error: null }));
      try {
        const data = await load(controller.signal);
        if (!controller.signal.aborted && activeRequestIds.current[requestKey] === requestId) {
          setter({ key: stateKey, data, loading: false, error: null });
        }
      } catch (error) {
        if (controller.signal.aborted || activeRequestIds.current[requestKey] !== requestId) return;
        setter((current) => ({ key: stateKey, data: current.key === stateKey ? current.data : null, loading: false, error: readError(error) }));
        throw error;
      }
    };
    const jobs = [refreshOne("directory", (signal) => loadSupplierDirectory(queryRef.current, signal), setDirectoryState, ownerKey)];
    if (selectedId) {
      jobs.push(refreshOne("profile", (signal) => loadSupplierDetail(selectedId, { period: profilePeriod }, signal), setProfileState, selectedKey));
      jobs.push(refreshOne("engagements", (signal) => loadSupplierEngagements(selectedId, { ...EMPTY_HISTORY_QUERY, page: engagementPage }, signal), setEngagementsState, selectedKey));
      jobs.push(refreshOne("reviews", (signal) => loadSupplierReviews(selectedId, EMPTY_HISTORY_QUERY, signal), setReviewsState, selectedKey));
      jobs.push(refreshOne("certifications", (signal) => loadSupplierCertifications(selectedId, EMPTY_HISTORY_QUERY, signal), setCertificationsState, selectedKey));
      jobs.push(refreshOne("records", (signal) => loadSupplierRecords(selectedId, { ...EMPTY_HISTORY_QUERY, period: recordsPeriod }, signal), setRecordsState, selectedKey));
    }
    const results = await Promise.allSettled(jobs);
    if (controller.signal.aborted) return;
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed) {
      if (isAuthorizationError(failed.reason)) clearPrivateReads();
      throw failed.reason;
    }
    lastRefreshAt.current = Date.now();
    setActionResult((current) => current?.saved && current.refreshFailed ? { saved: true, refreshFailed: false } : current);
  }, [canRead, ownerKey, supplierId, profilePeriod, recordsPeriod, engagementPage, clearPrivateReads]);

  const submitAction = useCallback(async (action: SupplierActionDraft) => {
    if (!canRead) return { saved: false, message: "PMCM access is required." } as const;
    setActionSaving(true);
    setActionResult(null);
    try {
      const visibleEngagements = currentEngagements.data?.items ?? [];
      const result = await submitSupplierAction(action, {
        refresh,
        eligibleReviewEventIds: visibleEngagements.filter((item) => item.canReview).map((item) => item.eventId),
        eligiblePromotionEventIds: visibleEngagements.filter((item) => item.canPromote).map((item) => item.eventId),
      });
      setActionResult(result);
      return result;
    } finally {
      setActionSaving(false);
    }
  }, [canRead, currentEngagements.data, refresh]);

  return {
    canRead,
    view: route.view,
    query,
    searchDraft,
    setSearchDraft,
    updateQuery,
    categories,
    categoriesLoaded,
    categoriesError,
    directory: currentDirectory.data,
    directoryLoading: currentDirectory.loading || (!currentDirectory.data && canRead),
    directoryError: currentDirectory.error,
    selectedSupplierId: supplierId,
    openSupplier,
    closeSupplier,
    profile: currentProfile.data,
    profileLoading: currentProfile.loading || (!currentProfile.data && Boolean(supplierId) && canRead),
    profileError: currentProfile.error,
    engagements: currentEngagements.data,
    engagementsLoading: currentEngagements.loading,
    engagementsError: currentEngagements.error,
    engagementPage,
    setEngagementPage,
    reviews: currentReviews.data,
    reviewsLoading: currentReviews.loading,
    reviewsError: currentReviews.error,
    certifications: currentCertifications.data,
    certificationsLoading: currentCertifications.loading,
    certificationsError: currentCertifications.error,
    records: currentRecords.data,
    recordsLoading: currentRecords.loading,
    recordsError: currentRecords.error,
    profilePeriod,
    setProfilePeriod,
    recordsPeriod,
    setRecordsPeriod,
    refresh,
    actionSaving,
    actionResult,
    submitAction,
  };
}
