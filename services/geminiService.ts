import { GoogleGenAI, Type } from "@google/genai";
import ExcelJS from "exceljs";
import "text-encoding-gbk";
import {
  SupplierQuote,
  GCIQuote,
  ExtractionItem,
  GCIItem,
  PriceEntry,
  SourcingMode,
  RFQProduct,
  Source,
} from "../types";
import { persistenceService } from "./persistenceService";

const PRICE_HEADERS = [
  "PRICE","UNIT PRICE","UNITPRICE","U/PRICE","RATE","FOB","USD","AED","CNY",
  "RMB","AMOUNT","单价","价格","报盘","COST","MOQ",
];

const PRODUCT_HEADERS = [
  "ITEM","PRODUCT","DESCRIPTION","NAME","品名","产品","描述","货物","规格",
];

const BANNED_FEATURES =
  /[×\*x]|cm|mm|kg|size|dimension|meas|备注|条款|说明|Note|Remarks|Payment|Term|Total/i;

const DIMENSION_PATTERN = /\d+[\s]*[x×\*][\s]*\d+/i;

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// ── 目标供应商国家/地区配置 ──────────────────────────────────────────
const TARGET_REGIONS = [
  { code: "CN", name: "中国", note: "空运优先（海运受限）", flag: "🇨🇳" },
  { code: "TR", name: "土耳其", note: "伊斯坦布尔/伊兹密尔工业区", flag: "🇹🇷" },
  { code: "IN", name: "印度", note: "古吉拉特/马哈拉施特拉/泰米尔纳德", flag: "🇮🇳" },
  { code: "PK", name: "巴基斯坦", note: "卡拉奇/拉合尔/锡亚尔科特", flag: "🇵🇰" },
  { code: "JO", name: "约旦", note: "安曼工业区", flag: "🇯🇴" },
  { code: "EG", name: "埃及", note: "开罗/亚历山大/十月六日城", flag: "🇪🇬" },
  { code: "VN", name: "越南", note: "胡志明市/河内/平阳省", flag: "🇻🇳" },
  { code: "MY", name: "马来西亚", note: "雪兰莪/柔佛/槟城", flag: "🇲🇾" },
];

const REGION_CONTEXT = TARGET_REGIONS.map(
  (r) => `${r.flag} ${r.name}（${r.note}）`
).join("、");
// ────────────────────────────────────────────────────────────────────

type SearchIntentAnalysis = {
  originalQuery: string;
  factoryKeyword: string;
  keyword1688: string;
  maxPrice: number | null;
  currency: string;
  priorities: string[];
};

function getAI(): GoogleGenAI {
  if (!GEMINI_API_KEY || !String(GEMINI_API_KEY).trim()) {
    throw new Error(
      "缺少 Gemini API Key。请在 Vercel 环境变量中配置 VITE_GEMINI_API_KEY。"
    );
  }
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function getCellText(cell: ExcelJS.Cell): string {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object" && "richText" in cell.value) {
    return cell.value.richText.map((rt) => rt.text).join("");
  }
  if (typeof cell.value === "object" && "result" in cell.value) {
    return String(cell.value.result || "");
  }
  return String(cell.value || "");
}

function cleanKeyword(text: string): string {
  if (!text) return "";
  return text
    .replace(/[，,。.!！？?；;：:"""'''（）()\[\]{}<>]/g, " ")
    .replace(
      /\b(供应商|厂家|工厂|价格|成本|控制|人民币|以下|以内|优先|出口|经验|寻找|请寻找|有出口经验|为优先|采购|找|需要)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url?: string): string {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  return trimmed;
}

function fallbackAnalyzeSearchIntent(q: string): SearchIntentAnalysis {
  const cleanQuery = cleanKeyword(q);
  const priceMatch =
    q.match(/(?:人民币|RMB|CNY)?\s*(\d+(?:\.\d+)?)\s*元(?:以下|以内|之内)?/i) ||
    q.match(/(?:低于|小于|不高于|不超过)\s*(\d+(?:\.\d+)?)/i);
  const maxPrice = priceMatch ? Number(priceMatch[1]) : null;
  const baseKeyword = cleanQuery.replace(/\s+/g, " ").trim() || q;
  const factoryKeyword = `${baseKeyword} manufacturer exporter supplier factory`;
  const priorities: string[] = [];
  if (/出口经验/i.test(q)) priorities.push("export experienced preferred");
  if (/中东|迪拜|UAE|Saudi/i.test(q)) priorities.push("export to Middle East / Dubai preferred");
  return {
    originalQuery: q,
    factoryKeyword,
    keyword1688: baseKeyword,
    maxPrice,
    currency: "USD",
    priorities,
  };
}

async function analyzeSearchIntent(q: string): Promise<SearchIntentAnalysis> {
  const ai = getAI();
  const prompt = `
你是"全球采购搜索意图分析器"。目标市场：迪拜/UAE进口商，需要在以下国家寻找可出口工厂：
${REGION_CONTEXT}

把用户采购需求拆成结构化字段：
1. factoryKeyword：B2B英文搜索词，适合搜索各国工厂/制造商
2. keyword1688：中文短关键词（2-8字），用于搜索中国平台（空运优先）
3. maxPrice：价格上限数字，没有则返回 null
4. currency：USD（默认）或其他明确货币
5. priorities：业务优先条件

只返回 JSON，不要解释。

用户需求：${q}
`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalQuery: { type: Type.STRING },
            factoryKeyword: { type: Type.STRING },
            keyword1688: { type: Type.STRING },
            maxPrice: { type: Type.NUMBER, nullable: true as any },
            currency: { type: Type.STRING },
            priorities: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["factoryKeyword", "keyword1688", "currency", "priorities"],
        },
      },
    });
    const parsed = JSON.parse(response.text || "{}");
    return {
      originalQuery: q,
      factoryKeyword: parsed.factoryKeyword?.trim() || fallbackAnalyzeSearchIntent(q).factoryKeyword,
      keyword1688: cleanKeyword(parsed.keyword1688 || "") || fallbackAnalyzeSearchIntent(q).keyword1688,
      maxPrice: typeof parsed.maxPrice === "number" ? parsed.maxPrice : null,
      currency: parsed.currency || "USD",
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
    };
  } catch {
    return fallbackAnalyzeSearchIntent(q);
  }
}

async function parseExcelBinary(buffer: ArrayBuffer): Promise<{
  supplier: { name: string; currency: string };
  items: ExtractionItem[];
  warnings: string[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const items: ExtractionItem[] = [];
  const warnings: string[] = [];
  let detectedSupplier = "";
  let detectedCurrency = "";

  for (const worksheet of workbook.worksheets) {
    let headerRowIdx = -1;
    let nameColIdx = -1;
    let priceColIndices: { col: number; label: string }[] = [];

    const metaLimit = Math.min(worksheet.rowCount, 15);
    for (let i = 1; i <= metaLimit; i++) {
      const row = worksheet.getRow(i);
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const raw = getCellText(cell).trim();
        const lower = raw.toLowerCase();
        if (!detectedSupplier && /supplier|vendor|from|供应商|厂家|公司|抬:/i.test(lower)) {
          const v = getCellText(row.getCell(colNum + 1)).trim();
          if (v.length > 2) detectedSupplier = v;
        }
        if (!detectedCurrency && /currency|货币|usd|aed|cny|rmb|eur|gbp/i.test(lower)) {
          const m = (raw + getCellText(row.getCell(colNum + 1))).toUpperCase().match(/USD|AED|CNY|RMB|EUR|GBP/);
          if (m) detectedCurrency = m[0];
        }
      });
    }

    const searchLimit = Math.min(worksheet.rowCount, 50);
    for (let i = 1; i <= searchLimit; i++) {
      const row = worksheet.getRow(i);
      let foundName = false;
      let tempPriceCols: { col: number; label: string }[] = [];
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const text = getCellText(cell).trim();
        const lower = text.toLowerCase().replace(/[\s_\-\/]/g, "");
        if (PRODUCT_HEADERS.some((k) => lower.includes(k.toLowerCase()))) {
          foundName = true;
          nameColIdx = colNum;
        }
        if (PRICE_HEADERS.some((k) => lower.includes(k.toLowerCase().replace(/[\s_\-\/]/g, "")))) {
          tempPriceCols.push({ col: colNum, label: text });
        }
      });
      if (foundName && tempPriceCols.length > 0) {
        headerRowIdx = i;
        priceColIndices = tempPriceCols;
        break;
      }
    }

    if (headerRowIdx === -1 || nameColIdx === -1) continue;

    for (let i = headerRowIdx + 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const productName = getCellText(row.getCell(nameColIdx)).trim();
      if (!productName || productName.length < 2 || BANNED_FEATURES.test(productName)) continue;
      const prices: PriceEntry[] = [];
      priceColIndices.forEach((pCol) => {
        const rawVal = getCellText(row.getCell(pCol.col)).trim();
        const cleanVal = rawVal.replace(/[^\d.]/g, "");
        const num = parseFloat(cleanVal);
        const isNumeric = !isNaN(num) && /^\d*(\.\d+)?$/.test(cleanVal);
        const isExcluded = BANNED_FEATURES.test(rawVal) || DIMENSION_PATTERN.test(rawVal);
        if (isNumeric && !isExcluded) {
          prices.push({
            price_type: pCol.label || "单价",
            unit_price: num,
            currency: (rawVal.match(/USD|AED|CNY|RMB|EUR|GBP/i)?.[0] || detectedCurrency || "USD").toUpperCase(),
            source: `${worksheet.name}!${row.getCell(pCol.col).address}`,
          });
        }
      });
      if (prices.length > 0) {
        items.push({ product_name: productName, prices });
      } else {
        warnings.push(`Sheet: ${worksheet.name} | 行: ${i} | 品名: ${productName.slice(0, 20)}`);
      }
    }
  }

  return {
    supplier: { name: detectedSupplier || "未识别供应商", currency: detectedCurrency || "USD" },
    items,
    warnings,
  };
}

async function parseAIBinary(file: File): Promise<{
  supplier: { name: string; currency: string };
  items: ExtractionItem[];
  warnings: string[];
}> {
  const ai = getAI();
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
 const prompt = `你是供应商报价全量事实提取器。任务：100%还原文件中的产品与价格对应关系，只返回JSON，不要任何解释。`;
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ parts: [{ text: prompt }, { inlineData: { data: base64, mimeType: file.type } }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          supplier: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, currency: { type: Type.STRING } } },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                product_name: { type: Type.STRING },
                prices: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      price_type: { type: Type.STRING },
                      unit_price: { type: Type.NUMBER },
                      currency: { type: Type.STRING },
                      source: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
          warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });
  const parsed = JSON.parse(response.text || "{}");
  return {
    supplier: { name: parsed.supplier?.name || "未识别供应商", currency: (parsed.supplier?.currency || "USD").toUpperCase() },
    items: parsed.items || [],
    warnings: parsed.warnings || [],
  };
}

export const executeSupplierQuoteParse = async (file: File): Promise<SupplierQuote> => {
  const startTime = Date.now();
  if (!file || file.size < 10240) throw new Error("二进制数据量过低，请上传正式报价单 (>10KB)");
  let result: { supplier: { name: string; currency: string }; items: ExtractionItem[]; warnings: string[] };
  if (file.name.match(/\.(xlsx|xlsm|csv)$/i)) {
    result = await parseExcelBinary(await file.arrayBuffer());
  } else {
    result = await parseAIBinary(file);
  }
  const quote: SupplierQuote = {
    id: `FACT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    supplier: result.supplier,
    items: result.items,
    warnings: result.warnings,
    file_meta: { file_name: file.name, file_size: file.size, parse_time_ms: Date.now() - startTime },
    created_at: new Date().toISOString(),
  };
  await persistenceService.saveSupplierQuote(quote);
  return quote;
};

export const createGCIQuote = async (supplier_fact_id: string, customer_name: string): Promise<GCIQuote> => {
  const history = await persistenceService.getSupplierQuotes();
  const supplierFact = history.find((q: any) => q.id === supplier_fact_id);
  if (!supplierFact) throw new Error("无法生成：供应商事实记录不存在。");
  const gciItems: GCIItem[] = supplierFact.items.map((it: any) => ({
    product_name: it.product_name,
    prices: it.prices.map((p: any, idx: number) => ({ ...p, sell_price: undefined, margin: "", selected: idx === 0 })),
    quantity: 1,
    specs_note: "",
  }));
  const newGciQuote: GCIQuote = {
    id: `GCI-Q-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    supplier_quote_id: supplier_fact_id,
    title: `Quotation for ${customer_name}`,
    customer_name: customer_name || "待定义客户",
    date: new Date().toISOString().split("T")[0],
    validity: "30 Days",
    currency: supplierFact.supplier.currency,
    trade_terms: "CIF Dubai",
    payment_terms: "30% Deposit, 70% Before Shipment",
    lead_time: "25-35 Days",
    remarks: "Standard GCI Terms Apply. Shipped to Dubai/UAE.",
    items: gciItems,
    status: "draft",
    total_amount: 0,
    created_at: new Date().toISOString(),
  };
  await persistenceService.saveGCIQuote(newGciQuote);
  return newGciQuote;
};

// ── 核心：全球供应商搜索 ─────────────────────────────────────────────
export const generateSourcingReport = async (
  q: string,
  i: any[] = [],
  ex: string[] = [],
  m: SourcingMode = "quick",
  signal?: AbortSignal
): Promise<any> => {
  if (signal?.aborted) throw new Error("操作已取消");

  const ai = getAI();
  const hasImages = i && i.length > 0;
  const intent = await analyzeSearchIntent(q);

  const prompt = `
你是"GCI 全球供应链搜索专家"。
GCI（GlobalCare Info General Trading FZCO）是迪拜/阿联酋的进出口贸易公司，需要在全球寻找可出口到迪拜的工厂和供应商。

用户采购需求：${q}
工厂搜索关键词：${intent.factoryKeyword}
价格上限：${intent.maxPrice ? `${intent.maxPrice} ${intent.currency}` : "未指定"}
业务优先条件：${intent.priorities.join("、") || "无"}
搜索模式：${m}

【目标供应商国家（按优先级）】
${REGION_CONTEXT}

⚠️ 重要说明：
- 中国工厂仍可寻找，但目前海运受限，请在备注中注明"建议空运"
- 其他国家工厂可正常海运到迪拜
- 所有供应商必须具备出口资质，能出货到迪拜/UAE
- 优先寻找有中东市场经验的工厂

任务：把结果分成两个独立池子：

1) factories（工厂/制造商）：
- 真实工厂、制造商、OEM 工厂
- 覆盖多个国家，不要只找一个国家
- 排除已知重复：${ex.join(", ") || "无"}
- 中国工厂在 shippingNote 字段注明"建议空运至迪拜"
- 其他国家正常备注

2) marketplaces1688（中国平台）：
- 1688 / 阿里巴巴国际站 的店铺或商品
- 标注为空运渠道

核心规则：
- 必须覆盖至少 3 个不同国家的工厂
- 不允许把同一个主体同时放进两个数组
- 优先保证真实性，不要编造
- 如果找到联系方式（电话/邮箱/WhatsApp）必须填写
- 在 location 字段标注"国旗 城市, 国家"格式，如"🇹🇷 伊斯坦布尔, 土耳其"

${hasImages ? "这是图片搜源模式，请结合图片识别产品类型后全球搜索。" : ""}

返回严格 JSON，格式如下：
{
  "factories": [...],
  "marketplaces1688": [...],
  "suggestedKeywords": [...]
}
`;

  const parts: any[] = [{ text: prompt }];
  if (hasImages) {
    i.forEach((img) => {
      parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
    });
  }

  const resp = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ parts }],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          factories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                nameEn: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["工厂", "制造商", "OEM", "贴牌", "其他"] },
                products: { type: Type.ARRAY, items: { type: Type.STRING } },
                location: { type: Type.STRING },
                country: { type: Type.STRING },
                source: { type: Type.STRING },
                sourceType: { type: Type.STRING, enum: ["official", "google"] },
                phone: { type: Type.STRING },
                whatsapp: { type: Type.STRING },
                email: { type: Type.STRING },
                website: { type: Type.STRING },
                isOfficialWebsite: { type: Type.BOOLEAN },
                isCorporateEmail: { type: Type.BOOLEAN },
                matchType: { type: Type.STRING, enum: ["keyword", "visual"] },
                shippingNote: { type: Type.STRING },
                exportMarkets: { type: Type.STRING },
              },
              required: ["name", "products", "location", "sourceType", "isOfficialWebsite", "isCorporateEmail", "matchType"],
            },
          },
          marketplaces1688: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                shopName: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["shop", "product"] },
                products: { type: Type.ARRAY, items: { type: Type.STRING } },
                location: { type: Type.STRING },
                url: { type: Type.STRING },
                source: { type: Type.STRING },
                sourceType: { type: Type.STRING, enum: ["1688"] },
                matchType: { type: Type.STRING, enum: ["keyword", "visual"] },
                shippingNote: { type: Type.STRING },
              },
              required: ["title", "type", "sourceType", "matchType"],
            },
          },
          suggestedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  let hunterResult: { factories?: any[]; marketplaces1688?: any[]; suggestedKeywords?: string[] };
  try {
    hunterResult = JSON.parse(resp.text || '{"factories":[],"marketplaces1688":[],"suggestedKeywords":[]}');
  } catch {
    hunterResult = { factories: [], marketplaces1688: [], suggestedKeywords: [] };
  }

  const normalizedFactories = (hunterResult.factories || []).map((f: any, idx: number) => ({
    id: f.id || `factory-${idx + 1}`,
    name: f.name || "",
    nameEn: f.nameEn || "",
    type: f.type || "工厂",
    products: Array.isArray(f.products) ? f.products.filter(Boolean) : [],
    location: f.location || "",
    country: f.country || "",
    source: f.source || f.website || "",
    sourceType: f.sourceType === "official" ? "official" : "google",
    phone: f.phone || "",
    whatsapp: f.whatsapp || "",
    email: f.email || "",
    website: f.website || "",
    isOfficialWebsite: Boolean(f.website) && f.isOfficialWebsite !== false,
    isCorporateEmail: Boolean(f.email) && f.isCorporateEmail !== false,
    matchType: f.matchType === "visual" ? "visual" : "keyword",
    shippingNote: f.shippingNote || "",
    exportMarkets: f.exportMarkets || "",
  }));

  const normalized1688 = (hunterResult.marketplaces1688 || [])
    .map((item: any, idx: number) => {
      const rawUrl = normalizeUrl(item.url);
      const rawSource = normalizeUrl(item.source);
      return {
        id: item.id || `1688-${idx + 1}`,
        title: item.title || item.shopName || "",
        shopName: item.shopName || "",
        type: item.type === "product" ? "product" : "shop",
        products: Array.isArray(item.products) ? item.products.filter(Boolean) : [],
        location: item.location || "🇨🇳 中国",
        url: rawUrl || rawSource || "",
        source: rawSource || rawUrl || "",
        sourceType: "1688",
        matchType: item.matchType === "visual" ? "visual" : "keyword",
        shippingNote: item.shippingNote || "建议空运至迪拜",
      };
    })
    .filter((item: any) => item.url);

  const sources: Source[] = (resp.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
    .filter((c: any) => c.web)
    .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));

  return {
    hunterResult: {
      factories: normalizedFactories,
      marketplaces1688: normalized1688,
      suggestedKeywords: hunterResult.suggestedKeywords || [],
      analyzedIntent: intent,
    },
    sources,
  };
};
// ────────────────────────────────────────────────────────────────────

export const analyzeRFQImages = async (i: any): Promise<RFQProduct[]> => {
  const ai = getAI();
  const parts = i.map((img: any) => ({ inlineData: { data: img.data, mimeType: img.mimeType } }));
  parts.unshift({ text: "提取 RFQ 产品事实清单。包含中文名、规格、数量、单位、材质、包装形式、每箱数量、外箱尺寸、毛重、净重、备注。返回 JSON 数组。" } as any);
  const resp = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING }, productNameCn: { type: Type.STRING },
            productNameEn: { type: Type.STRING }, specs: { type: Type.STRING },
            quantity: { type: Type.NUMBER }, unit: { type: Type.STRING },
            material: { type: Type.STRING }, packaging: { type: Type.STRING },
            pcsPerCtn: { type: Type.STRING }, ctnSize: { type: Type.STRING },
            gw: { type: Type.STRING }, nw: { type: Type.STRING },
            productNotes: { type: Type.STRING },
          },
          required: ["id", "productNameCn"],
        },
      },
    },
  });
  try { return JSON.parse(resp.text || "[]"); } catch { return []; }
};

export const parseRFQList = async (base64: string, mimeType: string): Promise<RFQProduct[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ parts: [{ text: "从文件中提取产品清单事实。返回 JSON 数组。包含：id, productNameCn, specs, quantity, unit, material, packaging, pcsPerCtn, ctnSize, gw, nw, productNotes。" }, { inlineData: { data: base64, mimeType } }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING }, productNameCn: { type: Type.STRING },
            productNameEn: { type: Type.STRING }, specs: { type: Type.STRING },
            quantity: { type: Type.NUMBER }, unit: { type: Type.STRING },
            material: { type: Type.STRING }, packaging: { type: Type.STRING },
            pcsPerCtn: { type: Type.STRING }, ctnSize: { type: Type.STRING },
            gw: { type: Type.STRING }, nw: { type: Type.STRING },
            productNotes: { type: Type.STRING },
          },
          required: ["id", "productNameCn"],
        },
      },
    },
  });
  try { return JSON.parse(response.text || "[]"); } catch { return []; }
};
