// ⭐️ 已清理：不再前端拼1688搜索链接，只使用后端返回URL

import React, { useState, useEffect } from 'react';
import { HunterResult, Supplier, Source, SourcingRequest } from '../types';

interface HunterResultsProps {
  initialResult: HunterResult | any;
  sources: Source[];
  onKeywordClick: (keyword: string) => void;
  originalRequest?: SourcingRequest;
}

export const HunterResults: React.FC<HunterResultsProps> = ({
  initialResult,
  sources,
  onKeywordClick,
  originalRequest
}) => {
  const [factories, setFactories] = useState<any[]>([]);
  const [marketplaces1688, setMarketplaces1688] = useState<any[]>([]);
  const [analyzedIntent, setAnalyzedIntent] = useState<any>(null);

  useEffect(() => {
    setFactories((initialResult as any)?.factories || []);
    setMarketplaces1688((initialResult as any)?.marketplaces1688 || []);
    setAnalyzedIntent((initialResult as any)?.analyzedIntent || null);
  }, [initialResult]);

  const handleOpenFactorySearch = () => {
    const keyword = analyzedIntent?.factoryKeyword || originalRequest?.query || '';
    window.open(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, '_blank');
  };

  const handleOpen1688Search = () => {
    const first = marketplaces1688.find((m: any) => m.url);

    if (first?.url) {
      window.open(first.url, '_blank');
    } else {
      alert('当前没有可用的1688直达链接');
    }
  };

  return (
    <div className="space-y-6">

      {/* 🔍 分析区 */}
      {analyzedIntent && (
        <div className="bg-white p-5 rounded-xl border">
          <div className="grid grid-cols-2 gap-4">
            <div>工厂词：{analyzedIntent.factoryKeyword}</div>
            <div>1688词：{analyzedIntent.keyword1688}</div>
            <div>价格：{analyzedIntent.maxPrice}</div>
            <div>优先：{analyzedIntent.priorities?.join(' / ')}</div>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={handleOpenFactorySearch}>
              🔎 工厂搜索
            </button>

            <button onClick={handleOpen1688Search}>
              🛒 打开1688
            </button>
          </div>
        </div>
      )}

      {/* 🏭 工厂 */}
      <div>
        <h3>工厂 {factories.length}</h3>
        {factories.map((f, i) => (
          <div key={i} className="border p-3 rounded mb-2">
            {f.name}
          </div>
        ))}
      </div>

      {/* 🛒 1688 */}
      <div>
        <h3>1688 {marketplaces1688.length}</h3>

        {marketplaces1688.length === 0 ? (
          <div className="text-gray-400">
            当前没有1688直达链接
          </div>
        ) : (
          marketplaces1688.map((m, i) => (
            <div key={i} className="border p-3 rounded mb-2">
              <div>{m.title}</div>

              {m.url ? (
                <a href={m.url} target="_blank">
                  🔗 打开1688链接
                </a>
              ) : (
                <div className="text-gray-400">无可用链接</div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
};
