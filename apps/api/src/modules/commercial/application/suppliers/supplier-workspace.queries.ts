import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PrismPmcmSupplierCertificationSummary,
  PrismPmcmSupplierDirectoryRow,
  PrismPmcmSupplierEngagementFacts,
  PrismPmcmSupplierRecord,
  PrismPmcmSupplierScorecard,
} from '@prism/types';
import type { PmcmSupplierDirectoryQuery, PmcmSupplierHistoryQuery, PmcmSupplierProfileQuery, PmcmSupplierRecordsQuery } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';

interface DirectoryRow {
  totalCount: number;
  id: string | null;
  name: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  tier: string | null;
  bniMember: boolean | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  averageRating: number | null;
  reviewCount: number | null;
  lastReviewedAt: Date | null;
  rejected: number | null;
  expired: number | null;
  submitted: number | null;
  verified: number | null;
  unknown: number | null;
  attention: PrismPmcmSupplierCertificationSummary['attention'] | null;
}

interface ProfileMetricsRow {
  averageRating: number | null;
  reviewCount: number;
  lastReviewedAt: Date | null;
  rejected: number;
  expired: number;
  submitted: number;
  verified: number;
  unknown: number;
  scorecards: PrismPmcmSupplierScorecard[] | string;
}

interface RecordsRow {
  totalCount: number;
  reviews: number;
  reliabilityNotes: number;
  certifications: number;
  chartStartDate: string;
  chartEndDate: string;
  items: PrismPmcmSupplierRecord[] | string;
  dailyBuckets: Array<{ date: string; count: number }> | string;
}

interface EngagementRow {
  totalCount: number;
  supplierTier: string;
  eventId: string | null;
  lastRequestAt: Date | null;
  hasConfirmedAssignment: boolean | null;
  hasAssessment: boolean | null;
  requestCount: number | null;
  hasMoreRequests: boolean | null;
  requests: PrismPmcmSupplierEngagementFacts['requests'] | string | null;
}

function jsonValue<T>(value: T | string): T {
  return typeof value === 'string' ? JSON.parse(value) as T : value;
}

function certificationSummary(row: Partial<Pick<DirectoryRow, 'rejected' | 'expired' | 'submitted' | 'verified' | 'unknown' | 'attention'>>): PrismPmcmSupplierCertificationSummary {
  const rejected = Number(row.rejected ?? 0);
  const expired = Number(row.expired ?? 0);
  const submitted = Number(row.submitted ?? 0);
  const verified = Number(row.verified ?? 0);
  const unknown = Number(row.unknown ?? 0);
  const attention = row.attention ?? (rejected ? 'rejected' : expired ? 'expired' : submitted ? 'submitted' : unknown ? 'unknown' : verified ? 'verified' : 'none');
  return { rejected, expired, submitted, verified, unknown, attention };
}

function periodStart(asOf: Date, period: PmcmSupplierProfileQuery['period'] | PmcmSupplierRecordsQuery['period']): Date | null {
  if (period === 'all') return null;
  const date = new Date(asOf);
  date.setTime(date.getTime() - (period === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000);
  return date;
}

const certificationStatusCte = (asOf: Date, supplierId?: string) => Prisma.sql`
  certification_status AS (
    SELECT
      cert.supplier_id,
      CASE
        WHEN lower(cert.status) = 'rejected' THEN 'rejected'
        WHEN lower(cert.status) = 'expired' THEN 'expired'
        WHEN lower(cert.status) IN ('verified', 'submitted')
          AND cert.expires_at IS NOT NULL
          AND cert.expires_at::date < timezone('Asia/Manila', ${asOf}::timestamptz)::date THEN 'expired'
        WHEN lower(cert.status) = 'submitted' THEN 'submitted'
        WHEN lower(cert.status) = 'verified' THEN 'verified'
        ELSE 'unknown'
      END AS effective_status
    FROM commercial.supplier_certifications cert
    WHERE (${supplierId ?? null}::text IS NULL OR cert.supplier_id = ${supplierId ?? null})
  ),
  certification_summary AS (
    SELECT
      supplier_id,
      count(*) FILTER (WHERE effective_status = 'rejected')::int AS rejected,
      count(*) FILTER (WHERE effective_status = 'expired')::int AS expired,
      count(*) FILTER (WHERE effective_status = 'submitted')::int AS submitted,
      count(*) FILTER (WHERE effective_status = 'verified')::int AS verified,
      count(*) FILTER (WHERE effective_status = 'unknown')::int AS unknown,
      min(CASE effective_status
        WHEN 'rejected' THEN 1 WHEN 'expired' THEN 2 WHEN 'submitted' THEN 3
        WHEN 'unknown' THEN 4 WHEN 'verified' THEN 5 ELSE 6 END) AS attention_rank
    FROM certification_status
    GROUP BY supplier_id
  )`;

const certificationAttentionSql = Prisma.raw(`CASE COALESCE(cert.attention_rank, 6)
  WHEN 1 THEN 'rejected' WHEN 2 THEN 'expired' WHEN 3 THEN 'submitted'
  WHEN 4 THEN 'unknown' WHEN 5 THEN 'verified' ELSE 'none' END`);

@Injectable()
export class SupplierWorkspaceQueries {
  constructor(private readonly prisma: PrismaService) {}

  async listDirectory(query: PmcmSupplierDirectoryQuery, asOf: Date): Promise<{
    rows: PrismPmcmSupplierDirectoryRow[];
    totalCount: number;
  }> {
    const orderColumn = {
      name: Prisma.raw('filtered.name'),
      rating: Prisma.raw('filtered.average_rating'),
      last_review: Prisma.raw('filtered.last_reviewed_at'),
      certifications: Prisma.raw('filtered.attention_rank'),
    }[query.sort];
    const orderDirection = query.direction === 'desc' ? Prisma.raw('DESC') : Prisma.raw('ASC');
    const orderBy = Prisma.sql`${orderColumn} ${orderDirection} NULLS LAST, filtered.id ASC`;
    const queryText = query.q.trim();

    // QUERY_AUDIT_RAW_SQL: one parameterized statement computes exact matching totals and pages after all filters and all-history aggregates.
    const rows = await this.prisma.$queryRaw<DirectoryRow[]>(Prisma.sql`
      WITH ${certificationStatusCte(asOf)},
      review_summary AS (
        SELECT supplier_id, round(avg(rating)::numeric, 1)::float8 AS average_rating,
          count(*)::int AS review_count, max(created_at) AS last_reviewed_at
        FROM commercial.supplier_reviews
        GROUP BY supplier_id
      ),
      filtered AS (
        SELECT supplier.id, supplier.name, supplier.category_id AS "categoryId",
          category.name AS "categoryName", category.slug AS "categorySlug", supplier.tier,
          supplier.bni_member AS "bniMember", supplier.contact_name AS "contactName",
          supplier.email, supplier.phone, review.average_rating,
          COALESCE(review.review_count, 0)::int AS review_count,
          review.last_reviewed_at,
          COALESCE(cert.rejected, 0)::int AS rejected,
          COALESCE(cert.expired, 0)::int AS expired,
          COALESCE(cert.submitted, 0)::int AS submitted,
          COALESCE(cert.verified, 0)::int AS verified,
          COALESCE(cert.unknown, 0)::int AS unknown,
          COALESCE(cert.attention_rank, 6) AS attention_rank,
          ${certificationAttentionSql} AS attention
        FROM commercial.suppliers supplier
        JOIN commercial.supplier_categories category ON category.id = supplier.category_id
        LEFT JOIN review_summary review ON review.supplier_id = supplier.id
        LEFT JOIN certification_summary cert ON cert.supplier_id = supplier.id
        WHERE (${queryText} = '' OR concat_ws(' ', supplier.name, supplier.contact_name, supplier.email, category.name) ILIKE '%' || ${queryText} || '%')
          AND (${query.categoryId ?? null}::text IS NULL OR supplier.category_id = ${query.categoryId ?? null})
          AND (${query.tier ?? null}::text IS NULL OR supplier.tier = ${query.tier ?? null})
          AND (${query.rating} = 'all'
            OR (${query.rating} = 'unrated' AND COALESCE(review.review_count, 0) = 0)
            OR (${query.rating} = '4.0' AND review.average_rating >= 4.0)
            OR (${query.rating} = '4.5' AND review.average_rating >= 4.5))
      ),
      totals AS (SELECT count(*)::int AS total_count FROM filtered)
      SELECT totals.total_count AS "totalCount", page.id, page.name, page."categoryId",
        page."categoryName", page."categorySlug", page.tier, page."bniMember",
        page."contactName", page.email, page.phone, page.average_rating AS "averageRating",
        page.review_count AS "reviewCount", page.last_reviewed_at AS "lastReviewedAt",
        page.rejected, page.expired, page.submitted, page.verified, page.unknown, page.attention
      FROM totals
      LEFT JOIN LATERAL (
        SELECT filtered.*, row_number() OVER (ORDER BY ${orderBy}) AS row_number
        FROM filtered
        ORDER BY ${orderBy}
        LIMIT ${query.pageSize} OFFSET ${query.page * query.pageSize}
      ) page ON TRUE
      ORDER BY page.row_number`);

    const totalCount = Number(rows[0]?.totalCount ?? 0);
    return {
      totalCount,
      rows: rows.filter((row): row is DirectoryRow & { id: string } => row.id !== null).map((row) => ({
        id: row.id,
        name: row.name ?? '',
        categoryId: row.categoryId ?? '',
        categoryName: row.categoryName ?? '',
        categorySlug: row.categorySlug ?? '',
        tier: row.tier ?? 'pending_first_event',
        bniMember: Boolean(row.bniMember),
        contactName: row.contactName ?? '',
        email: row.email ?? '',
        phone: row.phone ?? '',
        rating: { average: row.averageRating === null ? null : Number(row.averageRating), count: Number(row.reviewCount ?? 0) },
        lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
        certifications: certificationSummary(row),
      })),
    };
  }

  async getProfileMetrics(supplierId: string, categoryId: string, period: PmcmSupplierProfileQuery['period'], asOf: Date) {
    const startAt = periodStart(asOf, period);
    // QUERY_AUDIT_RAW_SQL: aggregate all reviews, current active dimensions, latest rating attribution, and certification metadata for one supplier.
    const rows = await this.prisma.$queryRaw<ProfileMetricsRow[]>(Prisma.sql`
      WITH ${certificationStatusCte(asOf, supplierId)},
      review_summary AS (
        SELECT round(avg(rating)::numeric, 1)::float8 AS average_rating,
          count(*)::int AS review_count, max(created_at) AS last_reviewed_at
        FROM commercial.supplier_reviews WHERE supplier_id = ${supplierId}
      ),
      scorecard_rows AS (
        SELECT dimension.id AS dimension_id, dimension.name AS dimension_name,
          dimension.sort_order,
          count(review.id)::int AS sample_count,
          round(avg(CASE WHEN review.id IS NOT NULL THEN rating.rating END)::numeric, 1)::float8 AS average,
          latest.rating AS latest_rating, latest.reviewed_by AS latest_reviewed_by,
          latest.created_at AS latest_created_at
        FROM commercial.supplier_review_dimensions dimension
        LEFT JOIN commercial.supplier_review_dimension_ratings rating
          ON rating.dimension_id = dimension.id
        LEFT JOIN commercial.supplier_reviews review
          ON review.id = rating.review_id AND review.supplier_id = ${supplierId}
          AND (${startAt}::timestamptz IS NULL OR (review.created_at >= ${startAt}::timestamptz AND review.created_at <= ${asOf}::timestamptz))
        LEFT JOIN LATERAL (
          SELECT latest_rating.rating, latest_review.reviewed_by, latest_review.created_at
          FROM commercial.supplier_review_dimension_ratings latest_rating
          JOIN commercial.supplier_reviews latest_review ON latest_review.id = latest_rating.review_id
          WHERE latest_rating.dimension_id = dimension.id AND latest_review.supplier_id = ${supplierId}
            AND (${startAt}::timestamptz IS NULL OR (latest_review.created_at >= ${startAt}::timestamptz AND latest_review.created_at <= ${asOf}::timestamptz))
          ORDER BY latest_review.created_at DESC, latest_review.id DESC LIMIT 1
        ) latest ON TRUE
        WHERE dimension.category_id = ${categoryId} AND dimension.active = true
        GROUP BY dimension.id, dimension.name, dimension.sort_order,
          latest.rating, latest.reviewed_by, latest.created_at
      ),
      selected_certifications AS (
        SELECT certification_summary.* FROM certification_summary WHERE supplier_id = ${supplierId}
      )
      SELECT review_summary.average_rating AS "averageRating",
        review_summary.review_count AS "reviewCount", review_summary.last_reviewed_at AS "lastReviewedAt",
        COALESCE(selected_certifications.rejected, 0)::int AS rejected,
        COALESCE(selected_certifications.expired, 0)::int AS expired,
        COALESCE(selected_certifications.submitted, 0)::int AS submitted,
        COALESCE(selected_certifications.verified, 0)::int AS verified,
        COALESCE(selected_certifications.unknown, 0)::int AS unknown,
        COALESCE(jsonb_agg(jsonb_build_object(
          'dimensionId', scorecard.dimension_id,
          'dimensionName', scorecard.dimension_name,
          'average', scorecard.average,
          'sampleCount', scorecard.sample_count,
          'latest', CASE WHEN scorecard.latest_rating IS NULL THEN NULL ELSE jsonb_build_object(
            'rating', scorecard.latest_rating, 'reviewedBy', scorecard.latest_reviewed_by,
            'createdAt', scorecard.latest_created_at) END
        ) ORDER BY scorecard.sort_order, scorecard.dimension_id)
          FILTER (WHERE scorecard.dimension_id IS NOT NULL), '[]'::jsonb) AS scorecards
      FROM review_summary
      LEFT JOIN selected_certifications ON true
      LEFT JOIN scorecard_rows scorecard ON true
      GROUP BY review_summary.average_rating, review_summary.review_count, review_summary.last_reviewed_at,
        selected_certifications.rejected, selected_certifications.expired, selected_certifications.submitted,
        selected_certifications.verified, selected_certifications.unknown`);

    const row = rows[0];
    return {
      rating: { average: row?.averageRating === null || row?.averageRating === undefined ? null : Number(row.averageRating), count: Number(row?.reviewCount ?? 0) },
      lastReviewedAt: row?.lastReviewedAt?.toISOString() ?? null,
      certifications: certificationSummary(row ?? { rejected: 0, expired: 0, submitted: 0, verified: 0, unknown: 0, attention: 'none' }),
      scorecards: jsonValue(row?.scorecards ?? []),
    };
  }

  async listRecords(supplierId: string, query: PmcmSupplierRecordsQuery, asOf: Date) {
    const startAt = periodStart(asOf, query.period);
    // QUERY_AUDIT_RAW_SQL: one statement derives the exact period counts, bounded history page, and Manila-day chart buckets.
    const rows = await this.prisma.$queryRaw<RecordsRow[]>(Prisma.sql`
      WITH all_records AS (
        SELECT review.id, 'review'::text AS kind, review.created_at AS occurred_at,
          review.notes AS text, review.reviewed_by AS actor_name, review.event_id
        FROM commercial.supplier_reviews review WHERE review.supplier_id = ${supplierId}
        UNION ALL
        SELECT note.id, 'reliability_note'::text, note.created_at, note.note, note.created_by, note.event_id
        FROM commercial.supplier_reliability_notes note WHERE note.supplier_id = ${supplierId}
        UNION ALL
        SELECT cert.id, 'certification'::text, cert.uploaded_at,
          concat_ws(' · ', nullif(cert.file_name, ''), nullif(cert.document_type, '')),
          NULL::text, NULL::text
        FROM commercial.supplier_certifications cert WHERE cert.supplier_id = ${supplierId}
      ),
      period_records AS (
        SELECT * FROM all_records
        WHERE (${startAt}::timestamptz IS NULL OR occurred_at >= ${startAt}::timestamptz)
          AND (${query.period} = 'all' OR occurred_at <= ${asOf}::timestamptz)
      ),
      summary AS (
        SELECT count(*)::int AS total_count,
          count(*) FILTER (WHERE kind = 'review')::int AS reviews,
          count(*) FILTER (WHERE kind = 'reliability_note')::int AS reliability_notes,
          count(*) FILTER (WHERE kind = 'certification')::int AS certifications
        FROM period_records
      ),
      chart_bounds AS (
        SELECT CASE WHEN ${query.period} = 'all'
          THEN (timezone('Asia/Manila', ${asOf}::timestamptz)::date - 89)
          ELSE timezone('Asia/Manila', ${startAt ?? asOf}::timestamptz)::date END AS start_date,
          timezone('Asia/Manila', ${asOf}::timestamptz)::date AS end_date
      ),
      chart AS (
        SELECT days.day::date AS day,
          count(records.id)::int AS count
        FROM chart_bounds bounds
        CROSS JOIN LATERAL generate_series(bounds.start_date::timestamp, bounds.end_date::timestamp, interval '1 day') days(day)
        LEFT JOIN all_records records ON records.occurred_at >= (days.day AT TIME ZONE 'Asia/Manila')
          AND records.occurred_at < ((days.day + interval '1 day') AT TIME ZONE 'Asia/Manila')
          AND records.occurred_at <= ${asOf}::timestamptz
          AND (${query.period} = 'all' OR records.occurred_at >= ${startAt ?? asOf}::timestamptz)
        GROUP BY days.day
      )
      SELECT summary.total_count AS "totalCount", summary.reviews,
        summary.reliability_notes AS "reliabilityNotes", summary.certifications,
        to_char(chart_bounds.start_date, 'YYYY-MM-DD') AS "chartStartDate",
        to_char(chart_bounds.end_date, 'YYYY-MM-DD') AS "chartEndDate",
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', item.id, 'kind', item.kind, 'occurredAt', item.occurred_at,
          'text', item.text, 'actorName', item.actor_name, 'eventId', item.event_id)
          ORDER BY item.occurred_at DESC,
            CASE item.kind WHEN 'review' THEN 1 WHEN 'reliability_note' THEN 2 ELSE 3 END,
            item.id DESC)
          FROM (SELECT * FROM period_records ORDER BY occurred_at DESC,
            CASE kind WHEN 'review' THEN 1 WHEN 'reliability_note' THEN 2 ELSE 3 END, id DESC
            LIMIT ${query.pageSize} OFFSET ${query.page * query.pageSize}) item), '[]'::jsonb) AS items,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'count', count) ORDER BY day) FROM chart), '[]'::jsonb) AS "dailyBuckets"
      FROM summary CROSS JOIN chart_bounds`);
    const row = rows[0];
    const items = jsonValue(row?.items ?? []);
    const dailyBuckets = jsonValue(row?.dailyBuckets ?? []);
    return {
      rows: items,
      totalCount: Number(row?.totalCount ?? 0),
      counts: {
        reviews: Number(row?.reviews ?? 0),
        reliabilityNotes: Number(row?.reliabilityNotes ?? 0),
        certifications: Number(row?.certifications ?? 0),
        total: Number(row?.totalCount ?? 0),
      },
      chartStartDate: row?.chartStartDate ?? '',
      chartEndDate: row?.chartEndDate ?? '',
      dailyBuckets: dailyBuckets.map((bucket) => ({ ...bucket, count: Number(bucket.count) })),
    };
  }

  async listEngagementFacts(supplierId: string, query: PmcmSupplierHistoryQuery) {
    // QUERY_AUDIT_RAW_SQL: one grouped query preserves every event-level eligibility flag and caps only preview rows.
    const rows = await this.prisma.$queryRaw<EngagementRow[]>(Prisma.sql`
      WITH supplier AS (
        SELECT id, tier FROM commercial.suppliers WHERE id = ${supplierId}
      ),
      ranked_requests AS (
        SELECT request.id, request.event_id, request.category, request.status,
          request.assignment_status, request.readiness_status, request.event_day_status,
          request.created_at,
          row_number() OVER (PARTITION BY request.event_id ORDER BY request.created_at DESC, request.id ASC) AS request_rank
        FROM commercial.quote_requests request
        WHERE request.supplier_id = ${supplierId}
      ),
      event_groups AS (
        SELECT request.event_id, max(request.created_at) AS last_request_at,
          bool_or(request.assignment_status = 'confirmed') AS has_confirmed_assignment,
          EXISTS (SELECT 1 FROM commercial.supplier_reviews review
            WHERE review.supplier_id = ${supplierId} AND review.event_id = request.event_id) AS has_assessment,
          count(*)::int AS request_count,
          bool_or(request.request_rank > 50) AS has_more_requests,
          jsonb_agg(jsonb_build_object(
            'id', request.id, 'category', request.category, 'status', request.status,
            'assignmentStatus', request.assignment_status,
            'readinessStatus', request.readiness_status,
            'eventDayStatus', request.event_day_status
          ) ORDER BY request.created_at DESC, request.id ASC) FILTER (WHERE request.request_rank <= 50) AS requests
        FROM ranked_requests request
        GROUP BY request.event_id
      ),
      totals AS (SELECT count(*)::int AS total_count FROM event_groups),
      page AS (
        SELECT event_groups.*, row_number() OVER (ORDER BY last_request_at DESC, event_id ASC) AS row_number
        FROM event_groups
        ORDER BY last_request_at DESC, event_id ASC
        LIMIT ${query.pageSize} OFFSET ${query.page * query.pageSize}
      )
      SELECT totals.total_count AS "totalCount", supplier.tier AS "supplierTier",
        page.event_id AS "eventId", page.last_request_at AS "lastRequestAt",
        page.has_confirmed_assignment AS "hasConfirmedAssignment", page.has_assessment AS "hasAssessment",
        page.request_count AS "requestCount", page.has_more_requests AS "hasMoreRequests",
        page.requests
      FROM supplier CROSS JOIN totals
      LEFT JOIN page ON true
      ORDER BY page.row_number`);
    const first = rows[0];
    const items = rows.filter((row) => row.eventId !== null).map((row) => ({
      eventId: row.eventId!,
      lastRequestAt: row.lastRequestAt?.toISOString() ?? '',
      hasConfirmedAssignment: Boolean(row.hasConfirmedAssignment),
      hasAssessment: Boolean(row.hasAssessment),
      requests: jsonValue(row.requests ?? []),
      requestCount: Number(row.requestCount ?? 0),
      hasMoreRequests: Boolean(row.hasMoreRequests),
    }));
    return {
      rows: items,
      totalCount: Number(first?.totalCount ?? 0),
      supplierTier: first?.supplierTier ?? 'pending_first_event',
    };
  }
}
