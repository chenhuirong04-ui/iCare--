
const BASE_URL = "https://script.google.com/macros/s/AKfycbzmyUtJonSdmAb8ZPkn09iSft8H2GAHsgeDJhkpeqKtpbXil5dCmGi9D0vFLU0WYPE6/exec";
const APP_KEY = "icare_sourcing";

interface CloudResponse {
  ok: boolean;
  data?: any;
  error?: string;
}

async function cloudFetch(action: string, table: string, payload: any = null, params: any = {}, attempt = 0): Promise<CloudResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({
        key: APP_KEY,
        action,
        table,
        data: payload,
        ...params
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const result = await response.json();
    return { ok: true, data: result };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (attempt === 0) return cloudFetch(action, table, payload, params, 1);
    return { ok: false, error: err.message || 'Unknown cloud error' };
  }
}

export const cloudUpsert = (table: string, rows: any[]) => cloudFetch('upsert', table, rows);
export const cloudQuery = (table: string, params: any = {}) => cloudFetch('query', table, null, params);
export const cloudRemove = (table: string, ids: string[]) => cloudFetch('remove', table, ids);

export const cloudExportAll = async (table: string): Promise<any[]> => {
  let all: any[] = [];
  let page = 1;
  const limit = 100;
  
  while (true) {
    const res = await cloudQuery(table, { page, limit });
    if (!res.ok || !res.data || !Array.isArray(res.data) || res.data.length === 0) break;
    all = all.concat(res.data);
    if (res.data.length < limit) break;
    page++;
  }
  return all;
};
