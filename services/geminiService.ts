import { GoogleGenAI, Type } from "@google/genai";
import ExcelJS from "exceljs";
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

function clean1688Keyword(text: string): string {
  if (!text) return "";

  return text
    .replace(/[，,。.!！？?；;：:“”"'‘’（）()\[\]{}<>]/g, " ")
    .replace(
      /\b(供应商|厂家|工厂|价格|成本|控制|人民币|以下|以内|优先|出口|经验|寻找|请寻找|有出口经验|为优先|采购|找|需要)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackAnalyzeSearchIntent(q: string): SearchIntentAnalysis {
  const cleanQuery = clean1688Keyword(q);
  const priceMatch =
    q.match(/(?:人民币|RMB|CNY)?\s*(\d+(?:\.\d+)?)\s*元(?:以下|以内|之内)?/i) ||
    q.match(/(?:低于|小于|不高于|不超过)\s*(\d+(?:\.\d+)?)/i);

  const maxPrice = priceMatch ? Number(priceMatch[1]) : null;

  const keyword1688 =
    cleanQuery
      .replace(/供应商|厂家|工厂/g, " ")
      .replace(/\s+/g, " ")
      .trim() || q;

  const factoryKeyword = keyword1688.includes("供应商")
    ? keyword1688
    : `${keyword1688} 供应商`;

  const priorities: string[] = [];
  if (/出口经验/i.test(q)) priorities.push("有出口经验优先");
  if (/工厂|厂家|制造商|OEM/i.test(q)) priorities.push("工厂优先");

  return {
    originalQuery: q,
    factoryKeyword,
    keyword1688,
    maxPrice,
    currency: "CNY",
    priorities,
  };
}

async function analyzeSearchIntent(q: string): Promise<SearchIntentAnalysis> {
  const ai = getAI();

  const prompt = `
你是“采购搜索意图分析器”。你的任务是把用户的自然语言采购需求，拆成适合执行搜索的结构化字段。

要求：
1. factoryKeyword：适合搜索工厂/制造商/供应商的关键词，偏B2B表达。
2. keyword1688：适合搜索1688商品的短关键词，只保留核心商品词，不要整句需求。
3. maxPrice：如果用户提到“X元以下/以内/不超过X元”，提取数字；没有就返回 null。
4. currency：如果提到人民币/CNY/RMB，则返回 CNY；否则默认 CNY。
5. priorities：提取非搜索词的业务优先条件，比如“有出口经验优先”“工厂优先”。

规则：
- keyword1688 必须尽量短，最好 2~8 个字。
- 不要把“6元以下”“有出口经验优先”放进 keyword1688。
- factoryKeyword 可以更像B2B搜索词，比如“塑料饭盒供应商”“一次性餐盒厂家”。
- 只返回 JSON，不要任何解释。

用户原始需求：
${q}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
            priorities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["factoryKeyword", "keyword1688", "currency", "priorities"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    return {
      originalQuery: q,
      factoryKeyword:
        parsed.factoryKeyword?.trim() || fallbackAnalyzeSearchIntent(q).factoryKeyword,
      keyword1688:
        clean1688Keyword(parsed.keyword1688 || "") ||
        fallbackAnalyzeSearchIntent(q).keyword1688,
      maxPrice:
        typeof parsed.maxPrice === "number" && !Number.isNaN(parsed.maxPrice)
          ? parsed.maxPrice
          : fallbackAnalyzeSearchIntent(q).maxPrice,
      currency: parsed.currency || "CNY",
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
    };
  } catch (err) {
    return fallbackAnalyzeSearchIntent(q);
  }
}

function build1688Url(keyword: string, maxPrice?: number | null): string {
  const cleaned = clean1688Keyword(keyword);
  const safeKeyword = cleaned || keyword || "";
  const pricePart =
    typeof maxPrice === "number" && !Number.isNaN(maxPrice)
      ? `&priceStart=0&priceEnd=${maxPrice}`
      : "";

  return `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(
    safeKeyword
  )}${pricePart}`;
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

        if (
          !detectedSupplier &&
          /supplier|vendor|from|供应商|厂家|公司|抬:/i.test(lower)
        ) {
          const v = getCellText(row.getCell(colNum + 1)).trim();
          if (v.length > 2) detectedSupplier = v;
        }

        if (
          !detectedCurrency &&
          /currency|货币|usd|aed|cny|rmb|eur|gbp/i.test(lower)
        ) {
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
): Promise<any> => {
  if (signal?.aborted) {
    throw new Error("操作已取消");
  }

  const ai = getAI();
  const hasImages = i && i.length > 0;
  const intent = await analyzeSearchIntent(q);

  const prompt = `
你是“中国产品供应链搜索分流器”。

用户原始需求：${q}
已分析出的工厂搜索词：${intent.factoryKeyword}
已分析出的1688商品词：${intent.keyword1688}
价格上限：${intent.maxPrice ?? "未指定"}
优先条件：${intent.priorities.join("、") || "无"}
搜索模式：${m}

你的任务不是只找工厂，而是要把结果拆成两个独立池子返回：

1) factories：
- 真实工厂 / 制造商 / OEM 工厂
- 优先有独立官网、企业邮箱、制造属性明确
- 必须排除已知重复主体：${ex.join(", ") || "无"}
- 请优先围绕工厂搜索词：${intent.factoryKeyword}

2) marketplaces1688：
- 1688 店铺或 1688 商品结果
- 它们是独立结果，不属于任何工厂卡片的附属项
- 如果搜到的是 1688 店铺，type 写 "shop"
- 如果搜到的是 1688 商品，type 写 "product"
- 名称尽量用店铺名或商品标题
- 请优先围绕 1688 商品词：${intent.keyword1688}

核心规则：
- factories 和 marketplaces1688 必须分开返回
- 不允许把同一个主体同时塞进两个数组冒充两个结果
- 如果某个工厂没有官网，不要硬写官网
- 如果当前条件下某一类搜不到，可以返回空数组
- 允许两类结果数量不一样
- 优先保证真实性，不要为了凑数编造

${hasImages ? "这是对标图搜索模式，请结合图片识别对应产品并搜索源头工厂与1688店铺。" : ""}

返回 JSON，格式必须严格如下：
{
  "factories": [...],
  "marketplaces1688": [...],
  "suggestedKeywords": [...]
}
`;

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

  const resp = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        parts,
      },
    ],
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
                type: {
                  type: Type.STRING,
                  enum: ["工厂", "制造商", "OEM", "贴牌", "其他"],
                },
                products: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                location: { type: Type.STRING },
                source: { type: Type.STRING },
                sourceType: {
                  type: Type.STRING,
                  enum: ["official", "google"],
                },
                phone: { type: Type.STRING },
                whatsapp: { type: Type.STRING },
                email: { type: Type.STRING },
                website: { type: Type.STRING },
                isOfficialWebsite: { type: Type.BOOLEAN },
                isCorporateEmail: { type: Type.BOOLEAN },
                matchType: {
                  type: Type.STRING,
                  enum: ["keyword", "visual"],
                },
              },
              required: [
                "name",
                "products",
                "location",
                "sourceType",
                "isOfficialWebsite",
                "isCorporateEmail",
                "matchType",
              ],
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
                type: {
                  type: Type.STRING,
                  enum: ["shop", "product"],
                },
                products: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                location: { type: Type.STRING },
                url: { type: Type.STRING },
                source: { type: Type.STRING },
                sourceType: {
                  type: Type.STRING,
                  enum: ["1688"],
                },
                matchType: {
                  type: Type.STRING,
                  enum: ["keyword", "visual"],
                },
              },
              required: ["title", "url", "type", "sourceType", "matchType"],
            },
          },
          suggestedKeywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  let hunterResult: {
    factories?: any[];
    marketplaces1688?: any[];
    suggestedKeywords?: string[];
  };

  try {
    hunterResult = JSON.parse(
      resp.text ||
        '{"factories":[],"marketplaces1688":[],"suggestedKeywords":[]}'
    );
  } catch (err) {
    hunterResult = {
      factories: [],
      marketplaces1688: [],
      suggestedKeywords: [],
    };
  }

  const normalizedFactories = (hunterResult.factories || []).map(
    (f: any, idx: number) => ({
      id: f.id || `factory-${idx + 1}`,
      name: f.name || "",
      nameEn: f.nameEn || "",
      type: f.type || "工厂",
      products: Array.isArray(f.products) ? f.products.filter(Boolean) : [],
      location: f.location || "",
      source: f.source || f.website || "",
      sourceType: f.sourceType === "official" ? "official" : "google",
      phone: f.phone || "",
      whatsapp: f.whatsapp || "",
      email: f.email || "",
      website: f.website || "",
      isOfficialWebsite: Boolean(f.website) && f.isOfficialWebsite !== false,
      isCorporateEmail: Boolean(f.email) && f.isCorporateEmail !== false,
      matchType: f.matchType === "visual" ? "visual" : "keyword",
    })
  );

  const normalized1688 = (hunterResult.marketplaces1688 || [])
    .map((item: any, idx: number) => {
      const baseKeyword =
        clean1688Keyword(intent.keyword1688) ||
        (Array.isArray(item.products) && item.products[0]) ||
        item.title ||
        item.shopName ||
        q;

      return {
        id: item.id || `1688-${idx + 1}`,
        title: item.title || item.shopName || "",
        shopName: item.shopName || "",
        type: item.type === "product" ? "product" : "shop",
        products: Array.isArray(item.products) ? item.products.filter(Boolean) : [],
        location: item.location || "",
        url: build1688Url(baseKeyword, intent.maxPrice),
        source: build1688Url(baseKeyword, intent.maxPrice),
        sourceType: "1688",
        matchType: item.matchType === "visual" ? "visual" : "keyword",
      };
    })
    .filter((item: any) => item.url);

  const sources: Source[] =
    (resp.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .filter((c: any) => c.web)
      .map((c: any) => ({
        title: c.web.title,
        uri: c.web.uri,
      }));

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
