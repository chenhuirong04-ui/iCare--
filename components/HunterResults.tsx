import React from "react";

type Supplier = {
  name: string;
  country?: string;
  city?: string;
  products?: string;
  website?: string | null;
  phone?: string;
  email?: string;
};

export const HunterResults = ({ initialResult }: any) => {
  const results: Supplier[] = initialResult?.factories || [];

  if (!results || results.length === 0) {
    return (
      <div style={{ marginTop: 24, color: "#666" }}>
        没有找到供应商结果
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ marginBottom: 12 }}>工厂结果</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {results.map((item, index) => (
          <div
            key={index}
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #eee",
            }}
          >
            <h3 style={{ marginBottom: 8 }}>{item.name}</h3>

            <p style={{ color: "#666", fontSize: 14 }}>
              {item.country || "未知国家"}
              {item.city ? ` · ${item.city}` : ""}
            </p>

            {item.products && (
              <p style={{ marginTop: 8, fontSize: 14 }}>
                主营：{item.products}
              </p>
            )}

            {item.phone && (
              <p style={{ fontSize: 13, color: "#888" }}>
                电话：{item.phone}
              </p>
            )}

            {item.email && (
              <p style={{ fontSize: 13, color: "#888" }}>
                邮箱：{item.email}
              </p>
            )}

            {item.website && item.website.startsWith("http") && (
              <a
                href={item.website}
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
                查看官网
              </a>
            )}

            {!item.website && (
              <p style={{ fontSize: 12, color: "#aaa", marginTop: 10 }}>
                未识别到官网
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
