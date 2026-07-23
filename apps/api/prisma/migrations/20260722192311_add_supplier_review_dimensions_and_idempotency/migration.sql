-- AlterTable
ALTER TABLE "supplier_ops"."supplier_reviews"
ADD COLUMN "idempotency_key" TEXT;

-- CreateTable
CREATE TABLE "supplier_ops"."supplier_review_dimensions" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_review_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ops"."supplier_review_dimension_ratings" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "dimension_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,

    CONSTRAINT "supplier_review_dimension_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_review_dimensions_category_id_active_sort_order_idx"
ON "supplier_ops"."supplier_review_dimensions"("category_id", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_review_dimensions_category_id_slug_key"
ON "supplier_ops"."supplier_review_dimensions"("category_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_review_dimension_ratings_review_id_dimension_id_key"
ON "supplier_ops"."supplier_review_dimension_ratings"("review_id", "dimension_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_reviews_idempotency_key_key"
ON "supplier_ops"."supplier_reviews"("idempotency_key");

-- AddForeignKey
ALTER TABLE "supplier_ops"."supplier_review_dimensions"
ADD CONSTRAINT "supplier_review_dimensions_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "supplier_ops"."supplier_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ops"."supplier_review_dimension_ratings"
ADD CONSTRAINT "supplier_review_dimension_ratings_review_id_fkey"
FOREIGN KEY ("review_id") REFERENCES "supplier_ops"."supplier_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ops"."supplier_review_dimension_ratings"
ADD CONSTRAINT "supplier_review_dimension_ratings_dimension_id_fkey"
FOREIGN KEY ("dimension_id") REFERENCES "supplier_ops"."supplier_review_dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
