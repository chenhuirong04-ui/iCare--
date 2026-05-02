import React from "react";

type Supplier = {
  name: string;
  country?: string;
  city?: string;
  location?: string;
  products?: string | string[];
  phone?: string;
  email?: string;
};

const productsToText = (products?: string | string[]) => {
  if (!products) return "";
  if (Array.isArray(products)) return products.filter(Boolean).join("、");
  return products;
};

const googleVerifyUrl = (item: Supplier) => {
  const query = [
    item.name,
    item.location || item.country || item.city,
    "supplier manufacturer official website contact",
  ]
    .filter(Boolean)
    .join(" ");

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
};

export const HunterResults = ({ initialResult }: any) => {
  const results: Supplier[] = initialResult?.factories || [];

  if (!results || results.length === 0) {
    return (
      <div style={{ marginTop: 24, color: "#666" }}>
        没有找到供应商结果。请换更具体的关键词，例如：hotel amenities supplier UAE / Turkey / Jordan。
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24, width: "100%" }}>
      <h2 style={{ marginBottom: 12 }}>工厂结果</h2>

      <p style={{ marginBottom: 16, color: "#777", fontSize: 13 }}>
        当前结果为 AI 提取线索；不再显示未核验官网，请通过 Google 核验确认公司真实性与联系方式。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {results.map((item, index) => {
          const productsText = productsToText(item.products);

          return (
            <div
              key={index}
              style={{
                padding: 16,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid #eee",
              }}
            >
              <h3 style={{ marginBottom: 8 }}>{item.name || "未命名供应商"}</h3>

              <p style={{ color: "#666", fontSize: 14 }}>
                {item.location || item.country || "未知地区"}
                {item.city ? ` · ${item.city}` : ""}
              </p>

              {productsText && (
                <p style={{ marginTop: 8, fontSize: 14 }}>
                  <strong>主营：</strong>{productsText}
                </p>
              )}

              {item.phone && (
                <p style={{ fontSize: 13, color: "#888" }}>
                  <strong>电话：</strong>{item.phone}
                </p>
              )}

              {item.email && (
                <p style={{ fontSize: 13, color: "#888" }}>
                  <strong>邮箱：</strong>{item.email}
                </p>
              )}

              <a
                href={googleVerifyUrl(item)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  padding: "6px 12px",
                  background: "#0b1a2c",
                  color: "#fff",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: 13,
                }}
              >
                🔍 Google核验
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};
