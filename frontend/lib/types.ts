export interface Product {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  currency: string;
  imageUrl: string;
  imageAlt?: string;
  category: string;
  groupId?: string;
  subcategory: string;
  inStock: boolean;
  isNonStock: boolean;
  isHidden?: boolean;
  hasWarranty?: boolean;
  warrantyDuration?: number;
  serialTracking?: boolean;
  barcode?: string;
  taxable?: boolean;
  specs: any[];
  description?: string;
  minTier: number;
  viewCount?: number;
  stockOnHand?: number;
}

export interface ProductImage {
  id: number;
  productId: string;
  imageUrl: string;
  sortOrder: number;
  isPrimary: number;
}

export interface ProductGroup {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string;
  hasWarranty?: boolean;
  warrantyDuration?: number;
  serials?: string[];
}

export interface Order {
  id: number;
  customerId: number;
  customerName?: string;
  customerEmail?: string;
  status: string;
  paymentMethod?: string;
  subtotal: number;
  shippingFee: number;
  total?: number;
  shippingName?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingCounty?: string;
  shippingPostcode?: string;
  shippingPhone?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  items?: OrderItem[];
  couponId?: number | null;
  discountAmount?: number;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  hasWarranty?: number;
  warrantyDuration?: number;
  serialNumber?: string;
  cancelled?: number;
}

export interface RepairTicket {
  id: string;
  customerId: number;
  deviceType: string;
  deviceBrand?: string;
  deviceModel: string;
  issueDescription: string;
  status: string;
  etaAt: string;
  createdAt: string;
  symptoms?: string[];
  totalCost?: number;
  laborCost?: number;
  partsCost?: number;
  hardwareValue?: number;
  quoteSentAt?: string | null;
  quoteRespondedAt?: string | null;
  quoteResponse?: string | null;
  updates?: RepairUpdate[];
}

export interface RepairUpdate {
  id: number;
  message: string;
  updateType: string;
  staffName?: string;
  createdAt: string;
  customerVisible: boolean;
}

export interface WishlistItem {
  id: number;
  customerId: number;
  productId: string;
  notes: string;
  createdAt: string;
  productName?: string;
  productPrice?: number;
  productImage?: string;
}

export interface Quote {
  id: number;
  customerId: number;
  quoteNumber: string;
  status: string;
  notes: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

export interface QuoteItem {
  id: number;
  quoteId: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Message {
  id: number;
  customerId: number;
  providerId: number;
  productId?: string;
  subject: string;
  body: string;
  senderRole: string;
  readAt: string | null;
  createdAt: string;
}

export interface County {
  id: number;
  name: string;
  fee: number;
}

export interface Settings {
  storeName: string;
  storePhone: string;
  storeEmail: string;
  currency: string;
  storeLogo: string;
  storeFavicon: string;
  taxRate: number;
  mpesaTillNumber: string;
  mpesaConfigured: boolean;
  backupImagesToDb: boolean;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  cloudinaryFolder: string;
  logoPosition?: string;
  springboardMenu?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  priceAnnual: number | null;
  maxProducts: number;
  maxBranches: number;
  features: string;
  isActive?: boolean;
  syncToOthers?: boolean;
}

export interface Provider {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
  createdAt: string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_active: number;
  last_login: string | null;
  created_at: string;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  dbPath: string;
  settings: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  managerId: number | null;
  managerName: string;
  isActive: boolean;
  planId: string | null;
  createdAt: string;
}
