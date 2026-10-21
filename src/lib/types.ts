// Shared DTO types — THE contract between backend API and frontend.
// Backend routes must return exactly these shapes (see docs/contracts.md).

export type Role = "CUSTOMER" | "STAFF" | "ADMIN";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface UserDTO {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  createdAt: string;
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  brand: { slug: string; name: string; nameEn: string };
  category: { slug: string; name: string };
  image: string | null;
  priceToman: number;
  originalPriceToman: number | null;
  discountPercent: number;
  ratingAvg: number;
  ratingCount: number;
  stock: number;
  isFeatured: boolean;
  isNew: boolean;
  soldCount: number;
  isActive: boolean;
}

export interface ProductAttributeValue {
  group?: string;
  key: string;
  value: string;
}

export interface ProductVariantOption {
  id: string;
  name: string; // e.g. "رنگ"
  value: string;
  extraPriceToman: number;
  stock: number;
}

/**
 * Public review shape (product page «دیدگاه‌ها» tab).
 * adminReply / isVerifiedPurchase are optional: the product API includes them
 * when the backend provides them (moderation reply + verified-purchase badge).
 */
export interface ReviewDTO {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  userName: string;
  createdAt: string;
  /** پاسخ مدیر/فروشگاه به این دیدگاه (moderation reply) */
  adminReply?: string | null;
  /** خرید تأییدشده — reviewer has a non-cancelled order containing the product */
  isVerifiedPurchase?: boolean;
}

export interface ProductDetail extends ProductCard {
  nameEn: string | null;
  sku: string;
  model: string | null;
  shortDescription: string | null;
  description: string;
  warrantyMonths: number | null;
  attributes: ProductAttributeValue[];
  colorOptions: { name: string; hex: string }[];
  variants: ProductVariantOption[];
  images: { url: string; alt: string }[];
  viewCount: number;
  related: ProductCard[];
  reviews: ReviewDTO[];
  ratingBreakdown: { star: number; count: number }[];
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SuggestResponse {
  products: { slug: string; name: string; image: string | null; priceToman: number; brand: string }[];
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
}

export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  variantText: string | null;
  slug: string;
  name: string;
  image: string | null;
  unitPriceToman: number;
  originalPriceToman: number | null;
  quantity: number;
  lineTotalToman: number;
  stock: number;
  maxQuantity: number;
}

export interface CartPayload {
  lines: CartLine[];
  itemCount: number;
  subtotalToman: number;
  savingsToman: number;
}

export interface CouponValidation {
  valid: boolean;
  message: string;
  code?: string;
  discountToman: number;
}

export interface ShippingMethodDTO {
  id: string;
  name: string;
  description: string | null;
  costToman: number;
  freeThresholdToman: number | null;
  estimatedDays: string | null;
}

export interface AddressDTO {
  id: string;
  title: string;
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  line: string;
  isDefault: boolean;
}

export interface OrderItemDTO {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string | null;
  productSku: string | null;
  variantText: string | null;
  image: string | null;
  unitPriceToman: number;
  originalPriceToman: number | null;
  quantity: number;
  lineTotalToman: number;
}

export interface OrderDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  customerPhone: string;
  shippingAddress: {
    receiverName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    line: string;
  };
  shippingMethod: { id: string; name: string; costToman: number } | null;
  shippingCostToman: number;
  subtotalToman: number;
  discountToman: number;
  totalToman: number;
  couponCode: string | null;
  paymentProvider: string;
  note: string | null;
  adminNote: string | null;
  trackingCode: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDTO[];
  statusHistory: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; createdAt: string }[];
  payments: { id: string; amountToman: number; status: PaymentStatus; provider: string; refId: string | null; createdAt: string }[];
}

export interface WishlistPayload {
  items: ProductCard[];
}

// ─── Admin DTOs ────────────────────────────────────────────────────────────

export interface AdminStats {
  ordersTotal: number;
  revenueToman: number;
  pendingOrders: number;
  customersCount: number;
  lowStock: { id: string; name: string; slug: string; stock: number; lowStockThreshold: number }[];
  bestSellers: { id: string; name: string; slug: string; soldCount: number; priceToman: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    totalToman: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: string;
  }[];
  recentAudit: { id: string; actorName: string | null; action: string; entity: string; entityId: string | null; createdAt: string }[];
}

export interface AdminProductRow extends ProductCard {
  sku: string;
  model: string | null;
  categoryName: string;
  costPrice: number | null;
  costCurrency: string | null;
  isPriceManual: boolean;
  viewCount: number;
  updatedAt: string;
}

export interface AdminProductDetail {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  sku: string;
  model: string | null;
  categoryId: string;
  brandId: string;
  shortDescription: string | null;
  description: string;
  priceToman: number;
  originalPriceToman: number | null;
  isPriceManual: boolean;
  costPrice: number | null;
  costCurrency: string | null;
  stock: number;
  lowStockThreshold: number;
  warrantyMonths: number | null;
  colorOptions: { name: string; hex: string }[];
  attributes: ProductAttributeValue[];
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
  images: { id: string; url: string; alt: string }[];
  variants: ProductVariantOption[];
}

export interface PricingRuleDTO {
  id: string;
  name: string;
  scopeType: "GLOBAL" | "CATEGORY" | "BRAND" | "PRODUCT";
  categoryId: string | null;
  brandId: string | null;
  productId: string | null;
  marginPercent: number;
  extraCostToman: number;
  roundingStepToman: number;
  isActive: boolean;
  affectedCount: number;
}

export interface ExchangeRateDTO {
  id: string;
  currency: string;
  rateToman: number;
  source: string;
  note: string | null;
  isActive: boolean;
  recordedAt: string;
  isStale: boolean;
}

export interface PricingPreviewRow {
  productId: string;
  name: string;
  sku: string;
  brand: string;
  costPrice: number | null;
  costCurrency: string | null;
  currentPriceToman: number;
  proposedPriceToman: number;
  changed: boolean;
  skipReason: string | null; // stale/missing rate, manual price…
}

export interface PricingPreviewResponse {
  rows: PricingPreviewRow[];
  changedCount: number;
  skippedCount: number;
  appliedRuleIds: string[];
  staleCurrencies: string[];
}

export interface PriceHistoryRow {
  id: string;
  productName: string;
  productSlug: string;
  oldPriceToman: number;
  newPriceToman: number;
  reason: string;
  source: string;
  createdAt: string;
}

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalToman: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  itemsCount: number;
  createdAt: string;
}

export interface InventoryMovementRow {
  id: string;
  productName: string;
  productSlug: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  reason: string;
  refOrderNumber: string | null;
  createdAt: string;
}

export interface CouponDTO {
  id: string;
  code: string;
  type: "PERCENT" | "AMOUNT";
  value: number;
  minOrderToman: number | null;
  maxDiscountToman: number | null;
  usageLimit: number | null;
  timesUsed: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export interface TorobFeedItem {
  product_id: string;
  product_name: string;
  brand: string;
  category: string;
  price_toman: number;
  availability: "in_stock" | "out_of_stock";
  page_url: string;
  image_url: string;
  sku: string;
  warranty_months: number | null;
}

export interface TorobFeedResponse {
  generator: string;
  generated_at: string;
  count: number;
  note: string;
  items: TorobFeedItem[];
}

// ─── Users management & review moderation (Task 7-b) ───────────────────────

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Row of GET /api/admin/users (ADMIN only). No sensitive fields ever. */
export interface AdminUserRowDTO {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  ordersCount: number;
  /** Sum of totalToman over non-CANCELLED orders */
  totalSpentToman: number;
  lastOrderAt: string | null;
}

export interface AdminUserOrderRowDTO {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalToman: number;
  createdAt: string;
}

/** GET /api/admin/users/[id] → { user: AdminUserDetailDTO } */
export interface AdminUserDetailDTO extends AdminUserRowDTO {
  recentOrders: AdminUserOrderRowDTO[];
}

/** Row of GET /api/admin/reviews (STAFF/ADMIN moderation queue). */
export interface AdminReviewDTO {
  id: string;
  product: { id: string; slug: string; name: string };
  user: { id: string; name: string; phone: string };
  rating: number;
  title: string | null;
  comment: string;
  status: ReviewStatus;
  adminReply: string | null;
  isVerifiedPurchase: boolean;
  createdAt: string;
  /** آخرین تصمیم مودریشن (null = هنوز بررسی نشده) */
  reviewedAt: string | null;
}

/** GET /api/admin/reviews response — counts are global (for tab badges). */
export interface AdminReviewsListResponse extends ListResponse<AdminReviewDTO> {
  counts: { PENDING: number; APPROVED: number; REJECTED: number };
}
