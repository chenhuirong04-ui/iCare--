import React from "react";

type AnySupplier = any;

function isValidUrl(url?: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function toProductsText(products: any) {
  if (!products) return "";
  if (Array.isArray(products)) return products.filter(Boolean).join("、");
  return String(products);
}

function getGoogleSearchUrl(item: AnySupplier) {
  const q = [
    item.name,
    item.location,
    item.country,
    "supplier manufacturer official website contact",
  ]
    .filter(Boolean)
    .join(" ");

  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function getSuppliersFromProps(props: any): AnySupplier[] {
  if (Array.isArray(props.results)) return props.results;
  if (Array.isArray(props.factories)) return props.factories;
  if (Array.isArray(props.result?.hunterResult?.factories)) return props.result.hunterResult.factories;
  if (Array.isArray(props.hunterResult?.factories)) return props.hunterResult.factories;
  return [];
}

export const HunterResults = (props: any) => {
  const suppliers = getSuppliersFromProps(props);

  if (!suppliers || suppliers.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          background: "#08162d",
          color: "#fff",
          borderRadius: 14,
          padding: "22px 28px",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.75 }}>
          ICARE FACTORY SEARCH
        </div>
        <h2 style={{ margin: "10px 0 6px", fontSize: 24 }}>
          工厂结果
        </h2>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>
          当前只展示 AI 提取到的供应商线索；官网必须人工核验，不再生成假官网。
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {suppliers.map((item: AnySupplier, index: number) => {
          const productsText = toProductsText(item.products);
          const websiteIsValid = isValidUrl(item.website);
          const googleUrl = getGoogleSearchUrl(item);

          return (
            <div
              key={item.id || index}
              style={{
                padding: 20,
                borderRadius: 14,
                background: "#fff",
                border: "1px solid #e5e7eb",
                boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#0f172a" }}>
                {item.name || item.nameEn || "未命名供应商"}
              </h3>

              <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: 14 }}>
                {item.location || item.country || "未知地区"}
              </p>

              {productsText && (
                <p style={{ margin: "8px 0", fontSize: 14, color: "#334155" }}>
                  <strong>主营产品：</strong>{productsText}
                </p>
              )}

              {item.type && (
                <p style={{ margin: "8px 0", fontSize: 14, color: "#334155" }}>
                  <strong>类型：</strong>{item.type}
                </p>
              )}

              {item.exportMarkets && (
                <p style={{ margin: "8px 0", fontSize: 14, color: "#334155" }}>
                  <strong>出口市场：</strong>{item.exportMarkets}
                </p>
              )}

              {item.shippingNote && (
                <p style={{ margin: "8px 0", fontSize: 14, color: "#334155" }}>
                  <strong>运输备注：</strong>{item.shippingNote}
                </p>
              )}

              {item.phone && (
                <p style={{ margin: "8px 0", fontSize: 14, color: "#334155" }}>
                  <strong>电话：</strong>{item.phone}
                </p>
              )}

              {item.whatsapp && (
                <p style={{ margin: "8px 0", fontSize: 14, color: "#334155" }}>
                  <strong>WhatsApp：</strong>{item.whatsapp}
                </p>
              )}

              {item.email && (
                <p style={{ margin: "8px 0", fontSize: 14, color: "#334155" }}>
                  <strong>邮箱：</strong>{item.email}
                </p>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                {websiteIsValid && (
                  <a
                    href={item.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "#0f172a",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: 13,
                    }}
                  >
                    查看官网
                  </a>
                )}

                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "#f1f5f9",
                    color: "#0f172a",
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  Google核验
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
