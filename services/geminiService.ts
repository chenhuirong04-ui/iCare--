import { GoogleGenAI, Type } from "@google/genai";
import ExcelJS from "exceljs";
const SUPPLY_SYSTEM_PROMPT = `
你是一个中国供应链采购专家。

用户会输入一个产品需求，请你帮他拆解成可用于搜索工厂的关键词。

请输出 JSON：

{
  "product": "",
  "category": "",
  "targetMarket": "",
  "priceLevel": "",
  "keywords1688": [],
  "keywordsGoogle": [],
  "factoryType": "",
  "notes": ""
}

要求：
- keywords1688：适合1688搜索（中文）
- keywordsGoogle：适合Google搜索（英文）
- 尽量给5-8个关键词组合
- 要贴近真实采购，而不是学术词
`;
import {
  SupplierQuote,
  GCIQuote,
  ExtractionItem,
  GCIItem,
  PriceEntry,
  SourcingMode,
  SourcingResult,
  RFQProduct,
  Source,
} from "../types";
import { persistenceService } from "./persistenceService";

const PRICE_HEADERS = [
  "PRICE",
  "UNIT PRICE",
  "UNITPRICE",
  "U/PRICE",
  "RATE",
  "FOB",
  "USD",
  "AED",
  "CNY",
  "RMB",
  "AMOUNT",
  "单价",
  "价格",
  "报盘",
  "COST",
  "MOQ",
];

const PRODUCT_HEADERS = [
  "ITEM",
  "PRODUCT",
  "DESCRIPTION",
  "NAME",
  "品名",
  "产品",
  "描述",
  "货物",
  "规格",
];

const BANNED_FEATURES =
  /[×\*x]|cm|mm|kg|size|dimension|meas|备注|条款|说明|Note|Remarks|Payment|Term|Total/i;

const DIMENSION_PATTERN = /\d+[\s]*[x×\*][\s]*\d+/i;

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function getAI(): GoogleGenAI {
  if (!GEMINI_API_KEY || !String(GEMINI_API_KEY).trim()) {
    throw new Error(
      "缺少 Gemini API Key。请在 Vercel 环境变量中配置 VITE_GEMINI_API_KEY。"
    );
  }

  return new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
  });
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

async function parseExcelBinary(
  buffer: ArrayBuffer
): Promise<{
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
          const m = (raw + getCellText(row.getCell(colNum + 1)))
            .toUpperCase()
            .match(/USD|AED|CNY|RMB|EUR|GBP/);
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

        if (
          PRICE_HEADERS.some((k) =>
            lower.includes(k.toLowerCase().replace(/[\s_\-\/]/g, ""))
          )
        ) {
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

      if (
        !productName ||
        productName.length < 2 ||
        BANNED_FEATURES.test(productName)
      ) {
        continue;
      }

      const prices: PriceEntry[] = [];

      priceColIndices.forEach((pCol) => {
        const rawVal = getCellText(row.getCell(pCol.col)).trim();
        const cleanVal = rawVal.replace(/[^\d.]/g, "");
        const num = parseFloat(cleanVal);
        const isNumeric = !isNaN(num) && /^\d*(\.\d+)?$/.test(cleanVal);
        const isExcluded =
          BANNED_FEATURES.test(rawVal) || DIMENSION_PATTERN.test(rawVal);

        if (isNumeric && !isExcluded) {
          prices.push({
            price_type: pCol.label || "单价",
            unit_price: num,
            currency: (
              rawVal.match(/USD|AED|CNY|RMB|EUR|GBP/i)?.[0] ||
              detectedCurrency ||
              "USD"
            ).toUpperCase(),
            source: `${worksheet.name}!${row.getCell(pCol.col).address}`,
          });
        }
      });

      if (prices.length > 0) {
        items.push({
          product_name: productName,
          prices,
        });
      } else {
        warnings.push(
          `Sheet: ${worksheet.name} | 行: ${i} | 状态: 忽略 | 品名: ${productName.slice(
            0,
            20
          )}`
        );
      }
    }
  }

  return {
    supplier: {
      name: detectedSupplier || "未识别供应商",
      currency: detectedCurrency || "USD",
    },
    items,
    warnings,
  };
}

async function parseAIBinary(
  file: File
): Promise<{
  supplier: { name: string; currency: string };
  items: ExtractionItem[];
  warnings: string[];
}> {
  const ai = getAI();
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  const prompt =
    "你是“供应商报价全量事实提取器”。任务：100%还原文件中的产品与价格对应关系，只返回JSON，不要任何解释。";

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: base64, mimeType: file.type } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          supplier: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              currency: { type: Type.STRING },
            },
          },
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
          warnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  const parsed = JSON.parse(response.text || "{}");

  return {
    supplier: {
      name: parsed.supplier?.name || "未识别供应商",
      currency: (parsed.supplier?.currency || "USD").toUpperCase(),
    },
    items: parsed.items || [],
    warnings: parsed.warnings || [],
  };
}

export const executeSupplierQuoteParse = async (
  file: File
): Promise<SupplierQuote> => {
  const startTime = Date.now();

  if (!file || file.size < 10240) {
    throw new Error("二进制数据量过低，请上传正式报价单 (>10KB)");
  }

  let result: {
    supplier: { name: string; currency: string };
    items: ExtractionItem[];
    warnings: string[];
  };

  if (file.name.match(/\.(xlsx|xlsm|csv)$/i)) {
    const buffer = await file.arrayBuffer();
    result = await parseExcelBinary(buffer);
  } else {
    result = await parseAIBinary(file);
  }

  const quote: SupplierQuote = {
    id: `FACT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    supplier: result.supplier,
    items: result.items,
    warnings: result.warnings,
    file_meta: {
      file_name: file.name,
      file_size: file.size,
      parse_time_ms: Date.now() - startTime,
    },
    created_at: new Date().toISOString(),
  };

  await persistenceService.saveSupplierQuote(quote);

  return quote;
};

export const createGCIQuote = async (
  supplier_fact_id: string,
  customer_name: string
): Promise<GCIQuote> => {
  const history = await persistenceService.getSupplierQuotes();
  const supplierFact = history.find((q: any) => q.id === supplier_fact_id);

  if (!supplierFact) {
    throw new Error("无法生成：供应商事实记录不存在。");
  }

  const gciItems: GCIItem[] = supplierFact.items.map((it: any) => ({
    product_name: it.product_name,
    prices: it.prices.map((p: any, idx: number) => ({
      ...p,
      sell_price: undefined,
      margin: "",
      selected: idx === 0,
    })),
    quantity: 1,
    specs_note: "",
  }));

  const newGciQuote: GCIQuote = {
    id: `GCI-Q-${new Date()
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, "")}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`,
    supplier_quote_id: supplier_fact_id,
    title: `Quotation for ${customer_name}`,
    customer_name: customer_name || "待定义客户",
    date: new Date().toISOString().split("T")[0],
    validity: "30 Days",
    currency: supplierFact.supplier.currency,
    trade_terms: "FOB",
    payment_terms: "30% Deposit, 70% Before Shipment",
    lead_time: "25-30 Days",
    remarks: "Standard GCI Terms Apply.",
    items: gciItems,
    status: "draft",
    total_amount: 0,
    created_at: new Date().toISOString(),
  };

  await persistenceService.saveGCIQuote(newGciQuote);

  return newGciQuote;
};

export const generateSourcingReport = async (
  q: string,
  i: any[] = [],
  ex: string[] = [],
  m: SourcingMode = "quick",
  signal?: AbortSignal
): Promise<SourcingResult> => {
  if (signal?.aborted) {
    throw new Error("操作已取消");
  }

  const ai = getAI();
  const hasImages = i && i.length > 0;

  const prompt = `寻找供应商: ${q}. 模式: ${m}.

【真实结果边界约束】:
1. 你必须仅返回真实存在的、可验证的制造型企业主体。
2. 禁止通过重复主体、换来源名、或列出同一公司的不同平台链接来填充数量。
3. 必须排除以下已知的供应商主体(去重列表): [${ex.join(", ")}]。
4. 如果在当前搜索条件下没有发现新的唯一工厂主体，请返回空数组。
5. 优先定位真实的制造型工厂（Factory/Manufacturer），而非贸易商。

${hasImages ? "【对标图品搜索模式】: 请分析提供的对标产品图片，定位对应的真实源头厂。" : ""}

关键分析任务：
- 判定官网：检查 website 是否为独立官方域名。
- 判定邮箱：检查 email 是否为企业域名邮箱。
- 判定匹配类型 (matchType): 'visual' 或 'keyword'。

返回 JSON 格式，必须包含 suppliers 数组。`;

  const parts: any[] = [{ text: prompt }];

  if (hasImages) {
    i.forEach((img) => {
      parts.push({
        inlineData: {
          data: img.data,
          mimeType: img.mimeType,
        },
      });
    });
  }

  // ===== 新逻辑：关键词生成 =====

const keywordPrompt = `
用户需求：${q}

请你把这个需求转化为适合搜索中国工厂的关键词。

返回 JSON：

{
  "keywords1688": [],
  "keywordsGoogle": []
}

要求：
- keywords1688：中文，适合1688
- keywordsGoogle：英文，适合Google
- 每个给5个关键词
`;

const keywordResp = await ai.models.generateContent({
  model: "gemini-3.1-pro-preview",
  contents: [{ parts: [{ text: keywordPrompt }] }],
  config: {
    responseMimeType: "application/json",
  },
});

let keywords = { keywords1688: [], keywordsGoogle: [] };

try {
  keywords = JSON.parse(keywordResp.text || "{}");
} catch {}

const suppliers = (keywords.keywords1688 || []).map((k: string) => ({
  name: `建议搜索: ${k}`,
  type: "建议",
  products: [k],
  location: "中国",
  source: "1688",
  isOfficialWebsite: false,
  isCorporateEmail: false,
  matchType: "keyword",
}));

const hunterResult = {
  suppliers,
  suggestedKeywords: keywords.keywords1688 || [],
};

const sources: Source[] = [];

return { hunterResult, sources };
  let hunterResult: {
    suppliers: any[];
    suggestedKeywords: string[];
  };

  try {
    hunterResult = JSON.parse(
      resp.text || '{"suppliers":[],"suggestedKeywords":[]}'
    );
  } catch (err) {
    hunterResult = { suppliers: [], suggestedKeywords: [] };
  }

  const sources: Source[] =
    (resp.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .filter((c: any) => c.web)
      .map((c: any) => ({
        title: c.web.title,
        uri: c.web.uri,
      }));

  return { hunterResult, sources };
};

export const analyzeRFQImages = async (i: any): Promise<RFQProduct[]> => {
  const ai = getAI();

  const parts = i.map((img: any) => ({
    inlineData: {
      data: img.data,
      mimeType: img.mimeType,
    },
  }));

  parts.unshift({
    text:
      "提取 RFQ 产品事实清单。包含中文名、规格、数量、单位、材质/材质等级(material)、包装形式(packaging)、每箱数量(pcsPerCtn)、外箱尺寸(ctnSize)、毛重(gw)、净重(nw)、备注(productNotes)。哪怕只看到名字也必须列出。返回 JSON 数组。",
  } as any);

  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts,
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            productNameCn: { type: Type.STRING },
            productNameEn: { type: Type.STRING },
            specs: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            material: { type: Type.STRING },
            packaging: { type: Type.STRING },
            pcsPerCtn: { type: Type.STRING },
            ctnSize: { type: Type.STRING },
            gw: { type: Type.STRING },
            nw: { type: Type.STRING },
            productNotes: { type: Type.STRING },
          },
          required: ["id", "productNameCn"],
        },
      },
    },
  });

  try {
    return JSON.parse(resp.text || "[]");
  } catch (e) {
    console.error("AI RFQ Parsing Error:", e);
    return [];
  }
};

export const parseRFQList = async (
  base64: string,
  mimeType: string
): Promise<RFQProduct[]> => {
  const ai = getAI();

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text:
              "从文件中提取产品清单事实。返回 JSON 数组。包含：id, productNameCn, specs, quantity, unit, material, packaging, pcsPerCtn, ctnSize, gw, nw, productNotes。",
          },
          { inlineData: { data: base64, mimeType } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            productNameCn: { type: Type.STRING },
            productNameEn: { type: Type.STRING },
            specs: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            material: { type: Type.STRING },
            packaging: { type: Type.STRING },
            pcsPerCtn: { type: Type.STRING },
            ctnSize: { type: Type.STRING },
            gw: { type: Type.STRING },
            nw: { type: Type.STRING },
            productNotes: { type: Type.STRING },
          },
          required: ["id", "productNameCn"],
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};
