
const BASE_URL = "https://script.google.com/macros/s/AKfycbzmyUtJonSdmAb8ZPkn09iSft8H2GAHsgeDJhkpeqKtpbXil5dCmGi9D0vFLU0WYPE6/exec";
const APP_KEY = "icare_sourcing";

interface CloudResponse {
  ok: boolean;
  data?: any;
  error?: string;
}

async function cloudRequest(action: string, data: any = null, attempt = 0): Promise<CloudResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({
        key: APP_KEY,
        action,
        table: 'snapshots',
        data: action === 'upsert' ? [{ id: 'latest', ...data }] : null
      }),
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const result = await response.json();
    return { ok: true, data: result };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (attempt === 0) return cloudRequest(action, data, 1);
    return { ok: false, error: err.message };
  }
}

export const pushSnapshot = (state: any) => cloudRequest('upsert', state);
export const pullLatestSnapshot = async () => {
  const res = await cloudRequest('query');
  return res.ok && Array.isArray(res.data) ? res.data.find((d: any) => d.id === 'latest') : null;
};
