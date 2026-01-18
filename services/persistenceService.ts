
import { pushSnapshot, pullLatestSnapshot } from './cloudSync';

const KEYS = {
  RFQ: 'RFQ_Inquiry_DB',
  SUPPLIER_QUOTES: 'supplier_quote_history',
  GCI_QUOTES: 'gci_quote_history'
};

const syncToCloud = async () => {
  const state = {
    [KEYS.RFQ]: JSON.parse(localStorage.getItem(KEYS.RFQ) || '[]'),
    [KEYS.SUPPLIER_QUOTES]: JSON.parse(localStorage.getItem(KEYS.SUPPLIER_QUOTES) || '[]'),
    [KEYS.GCI_QUOTES]: JSON.parse(localStorage.getItem(KEYS.GCI_QUOTES) || '[]')
  };
  await pushSnapshot(state);
};

const syncFromCloud = async (targetKey: string) => {
  const snapshot = await pullLatestSnapshot();
  if (snapshot) {
    Object.keys(KEYS).forEach(k => {
      const storageKey = (KEYS as any)[k];
      if (snapshot[storageKey]) {
        localStorage.setItem(storageKey, JSON.stringify(snapshot[storageKey]));
      }
    });
    return snapshot[targetKey] || [];
  }
  return [];
};

const ensureIdAndTimestamps = (item: any) => {
  if (!item.id) {
    item.id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  const now = new Date().toISOString();
  if (!item.created_at && !item.createdAt) item.created_at = now;
  item.updated_at = now;
  return item;
};

async function saveRecord(localKey: string, record: any) {
  const processed = ensureIdAndTimestamps(record);
  const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
  const existingIdx = localData.findIndex((r: any) => r.id === processed.id);
  if (existingIdx > -1) {
    localData[existingIdx] = processed;
  } else {
    localData.unshift(processed);
  }
  localStorage.setItem(localKey, JSON.stringify(localData.slice(0, 500)));
  // 异步同步云端
  syncToCloud();
  return processed;
}

async function getRecords(localKey: string) {
  const local = localStorage.getItem(localKey);
  if (!local || local === '[]') {
    return await syncFromCloud(localKey);
  }
  return JSON.parse(local);
}

export const persistenceService = {
  saveRFQ: (rfq: any) => saveRecord(KEYS.RFQ, rfq),
  getRFQs: () => getRecords(KEYS.RFQ),
  
  saveSupplierQuote: (quote: any) => saveRecord(KEYS.SUPPLIER_QUOTES, quote),
  getSupplierQuotes: () => getRecords(KEYS.SUPPLIER_QUOTES),
  
  saveGCIQuote: (quote: any) => saveRecord(KEYS.GCI_QUOTES, quote),
  getGCIQuotes: () => getRecords(KEYS.GCI_QUOTES),
  
  exportFullHistory: async (type: keyof typeof KEYS) => {
    return await getRecords(KEYS[type]);
  }
};
