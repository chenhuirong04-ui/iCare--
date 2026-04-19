export interface Source {
  title: string;
  uri: string;
}

export interface Supplier {
  id?: string;
  name: string;
  nameEn?: string;
  type: '工厂' | '贸易' | 'OEM' | '贴牌' | '其他';
  products: string[];
  location: string;
  source: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  selected?: boolean;
  isOfficialWebsite?: boolean;
  isCorporateEmail?: boolean;
  matchType?: 'keyword' | 'visual';
}

export interface Marketplace1688Item {
  id?: string;
  title: string;
  shopName?: string;
  type: 'shop' | 'product' | string;
  products?: string[];
  location?: string;
  url: string;
  source?: string;
  sourceType?: '1688' | string;
  matchType?: 'keyword' | 'visual' | string;
  selected?: boolean;
}

export interface AnalyzedIntent {
  originalQuery?: string;
  factoryKeyword?: string;
  keyword1688?: string;
  maxPrice?: number | null;
  currency?: string;
  priorities?: string[];
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT',
  ABORTED = 'ABORTED'
}

export interface SessionImage {
  id: string;
  url: string;
  data: string;
  mimeType: string;
  sourceModule: 'HUNTER' | 'RFQ' | 'AI' | 'QUOTE';
}

export interface FileMeta {
  file_name: string;
  file_size: number;
  parse_time_ms: number;
}

export interface PriceEntry {
  price_type: string;
  unit_price: number;
  currency: string;
  source: string;
}

export interface GCIPriceEntry extends PriceEntry {
  sell_price?: number;
  margin?: string;
  selected?: boolean;
}

export interface ExtractionItem {
  product_name: string;
  prices: PriceEntry[];
}

export interface GCIItem {
  product_name: string;
  prices: GCIPriceEntry[];
  quantity?: number;
  specs_note?: string;
}

export interface SupplierQuote {
  id: string;
  supplier: {
    name: string;
    currency: string;
  };
  items: ExtractionItem[];
  warnings: string[];
  file_meta: FileMeta;
  created_at: string;
}

export interface GCIQuote {
  id: string;
  supplier_quote_id: string;
  title: string;
  customer_name: string;
  date: string;
  validity: string;
  currency: string;
  trade_terms: string;
  payment_terms: string;
  lead_time: string;
  remarks: string;
  items: GCIItem[];
  status: 'draft' | 'final';
  total_amount: number;
  created_at: string;
}

export type SourcingMode = 'quick' | 'deep';

export interface HunterResult {
  factories: Supplier[];
  marketplaces1688: Marketplace1688Item[];
  analyzedIntent?: AnalyzedIntent;
  suggestedKeywords?: string[];
}

export interface SourcingResult {
  hunterResult: HunterResult;
  sources: Source[];
}

export interface RFQProduct {
  id: string;
  productNameCn: string;
  productNameEn?: string;
  specs?: string;
  quantity: number;
  unit: string;
  confidence?: number;
  material?: string;
  packaging?: string;
  pcsPerCtn?: string;
  ctnSize?: string;
  cbm?: string;
  gw?: string;
  nw?: string;
  productNotes?: string;
}

export interface RFQInquiry {
  id: string;
  targetMarket: string;
  notes: string;
  items: RFQProduct[];
  status: 'Pending_Sourcing' | 'In_Progress' | 'Completed';
  createdAt: string;
  attachments?: string[];
}

export interface SourcingRequest {
  query: string;
  images?: { data: string; mimeType: string }[];
  mode: SourcingMode;
}

export interface QuoteItem {
  productNameCn: string;
  specs?: string;
  quantity: number;
  unit: string;
  gciPrice: number;
  amount: number;
  notes?: string;
}

export interface QuoteMetadata {
  type: string;
  customerName: string;
  quoteNo: string;
  customerContact?: string;
  date: string;
  customerPhone?: string;
  validity: string;
  currency: string;
  totalAmount: number;
  includeVAT: boolean;
  vatAmount: number;
  grandTotal: number;
  paymentTerms: string;
}

export interface RFQMetadata {
  rfqNo: string;
  deadline: string;
  targetMarket: string;
  notes: string;
}
