export interface VariantOption {
  id: string;
  name: string; // e.g. "Dorado", "Plateado", "Rojo", "Talle M", "Modelo A"
  images?: string[]; // Independent images for this specific variant option!
  stock?: number; // Individual stock for this variant option
  wholesalePrice?: number; // Optional price override
  retailPrice?: number;
  cashPrice?: number; // Optional general cash price override (backward-compatibility)
  retailCashPrice?: number; // Optional retail cash price override
  wholesaleCashPrice?: number; // Optional wholesale cash price override
  sku?: string;
}

export interface VariantType {
  id: string;
  name: string; // e.g. "Color / Modelo", "Tamaño / Medida", "Diseño"
  options: VariantOption[];
}

export interface SizeVariant {
  id: string;
  name: string; // e.g. "Mediano", "Grande", "Chico", "Talle M", "Talle L"
  images?: string[]; // Optional images for size variant
  stock?: number; // Individual stock for size variant
  wholesalePrice: number;
  retailPrice: number;
  cashPrice?: number; // Optional cash price override (backward-compatibility)
  retailCashPrice?: number; // Optional retail cash price override
  wholesaleCashPrice?: number; // Optional wholesale cash price override
  sku?: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductReview {
  id?: string;
  rating?: number;
  author?: string;
  text: string;
  date?: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  category: string; // 'Bijuteria' | 'Tecnología' | 'Juguetes' | 'Perfumes' | 'Textil'
  subcategory?: string;
  images: string[];
  additionalImage?: string; // Imagen adicional / Banner lifestyle debajo de la descripción
  lifestyleTagline?: string;
  lifestyleTitle?: string;
  lifestyleSubtitle?: string;
  minWholesaleQty: number; // e.g. 3
  wholesalePrice: number; // Base wholesale price
  retailPrice: number; // Base retail price
  cashPrice?: number; // Base cash price (backward-compatibility)
  retailCashPrice?: number; // Base retail cash price (Precio en efectivo minorista)
  wholesaleCashPrice?: number; // Base wholesale cash price (Precio en efectivo mayorista)
  colors?: string[]; // e.g. ['Dorado', 'Plateado'] (backwards compatible)
  sizeVariants?: SizeVariant[]; // e.g. [{ id: '1', name: 'Mediano', wholesalePrice: 1250, retailPrice: 1800 }]
  variantTypes?: VariantType[]; // Rich 2-type variant system with per-option images
  stock: number;
  soldCount?: number;
  rating?: number;
  reviewsCount?: number;
  reviews?: ProductReview[]; // Lista de comentarios y opiniones
  specs?: ProductSpec[];
  isBestSeller?: boolean;
  createdAt?: string;
}

export interface CartItem {
  id: string; // Composite key
  productId: string;
  product: Product;
  selectedColor?: string;
  selectedSizeVariant?: SizeVariant;
  selectedVariants?: Record<string, string>; // e.g. { "Color": "Dorado", "Tamaño": "Grande" }
  selectedImage?: string; // The exact image corresponding to the selected variant
  variantText?: string;
  quantity: number;
  // Computed values
  unitPrice: number;
  cashUnitPrice?: number;
  isWholesale: boolean;
  totalPrice: number;
  totalCashPrice?: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  title: string;
  image: string;
  variantText: string;
  quantity: number;
  unitPrice: number;
  cashUnitPrice?: number;
  totalPrice: number;
  totalCashPrice?: number;
  isWholesale: boolean;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "M28452"
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  deliveryOption: 'pickup' | 'delivery';
  shippingMethodName?: string; // e.g. "Uber Moto (llega hoy)", "Envío Flex (llega mañana)", "Correo Argentino (llega 1 a 4 días)"
  deliveryAddress?: {
    street: string;
    number: string;
    floor?: string;
    city: string;
    postalCode: string;
    province: string;
    receiverName?: string;
  };
  paymentMethod: 'transfer' | 'cash';
  items: OrderItem[];
  subtotal: number;
  wholesaleDiscount: number;
  cashDiscount: number;
  shippingCost: number;
  total: number;
  status: 'pending_payment' | 'preparing' | 'shipped' | 'completed' | 'cancelled';
  createdAt: string;
  emailSentToCustomer?: boolean;
  emailSentToAdmin?: boolean;
}

export interface UserProfile {
  id: string; // matches auth.users.id
  email: string;
  fullName: string;
  phone?: string;
  dni?: string;
  street?: string;
  streetNumber?: string;
  floor?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  receiverName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string; // Dedicated independent image (URL or uploaded file)
  sortOrder: number; // For ordering
  isVisible: boolean; // Toggle visibility
  description?: string;
  createdAt?: string;
}

export type ViewMode = 'home' | 'category' | 'product_detail' | 'cart' | 'checkout' | 'confirmation' | 'admin' | 'quick_buy' | 'info';

// ---------------- ANALYTICS & VISIT STATS TYPES ---------------- //
export interface SiteVisit {
  id: string;
  visitorId: string;
  sessionId: string;
  timestamp: string; // ISO string
  path: string;
  pageTitle?: string;
  referrer: string;
  source: string; // "Directo" | "Google" | "Instagram" | "WhatsApp" | "Facebook" | "TikTok" | "Otro"
  device: 'mobile' | 'desktop' | 'tablet';
  isNewVisitor: boolean; // true if first time visitor
  isNewSession: boolean; // true if new visit/session (not reload)
}

export interface PageStat {
  path: string;
  title: string;
  views: number;
  uniqueVisitors: number;
  percentage: number;
}

export interface SourceStat {
  source: string;
  visits: number;
  percentage: number;
}

export interface DayStat {
  date: string; // YYYY-MM-DD
  displayDate: string; // "09 Sep"
  visits: number;
  uniqueVisitors: number;
  pageViews: number;
}

export interface AnalyticsMetrics {
  totalVisits: number;
  todayVisits: number;
  weekVisits: number;
  monthVisits: number;
  yearVisits: number;
  uniqueVisitors: number;
  returningVisits: number;
  totalPageViews: number;
  topPages: PageStat[];
  trafficSources: SourceStat[];
  dailyEvolution: DayStat[];
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
}
