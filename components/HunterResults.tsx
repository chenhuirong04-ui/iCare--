import React, { useEffect, useMemo, useState } from 'react';
import { HunterResult, Source, SourcingRequest } from '../types';

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
    setFactories(Array.isArray((initialResult as any)?.factories) ? (initialResult as any).factories : []);
    setMarketplaces1688(
      Array.isArray((initialResult as any)?.marketplaces1688) ? (initialResult as any).marketplaces1688 : []
    );
    setAnalyzedIntent((initialResult as any)?.analyzedIntent || null);
  }, [initialResult]);

  const safeFactories = useMemo(
    () =>
      factories.map((f: any, index: number) => ({
        id: `${f?.name || 'factory'}-${index}`,
        name: String(f?.name || 'Unnamed Factory'),
        location: String(f?.location || ''),
        website: String(f?.website || f?.url || ''),
        description: String(f?.description || f?.summary || ''),
        tags: Array.isArray(f?.tags) ? f.tags.filter(Boolean) : [],
      })),
    [factories]
  );

  const safe1688 = useMemo(
    () =>
      marketplaces1688.map((m: any, index: number) => ({
        id: `${m?.title || m?.keyword || '1688'}-${index}`,
        title: String(m?.title || m?.keyword || '1688 Item'),
        keyword: String(m?.keyword || ''),
        url: String(m?.url || '').trim(),
      })),
    [marketplaces1688]
  );

  const top1688Url = useMemo(() => {
    const firstValid = safe1688.find((item) => item.url);
    return firstValid?.url || '';
  }, [safe1688]);

  const handleOpenFactorySearch = () => {
    const keyword = analyzedIntent?.factoryKeyword || originalRequest?.query || '';
    if (!keyword.trim()) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpen1688Search = () => {
    if (!top1688Url) {
      alert('当前没有可用的1688直达链接');
      return;
    }
    window.open(top1688Url, '_blank', 'noopener,noreferrer');
  };

  const StatCard = ({
    label,
    value,
  }: {
    label: string;
    value: React.ReactNode;
  }) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-sm text-gray-900 break-words">{value || '-'}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
              iCare Sourcing Result
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              {originalRequest?.query || analyzedIntent?.keyword1688 || 'Sourcing Results'}
            </h2>
            <p className="text-sm text-gray-500">
              工厂搜索与 1688 结果已分开展示，顶部入口与卡片入口保持一致。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleOpenFactorySearch}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              🔎 工厂搜索
            </button>

            <button
              onClick={handleOpen1688Search}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
            >
              🛒 打开1688
            </button>
          </div>
        </div>
      </section>

      {analyzedIntent && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="工厂关键词" value={analyzedIntent.factoryKeyword} />
          <StatCard label="1688关键词" value={analyzedIntent.keyword1688} />
          <StatCard label="价格上限" value={analyzedIntent.maxPrice ?? '-'} />
          <StatCard
            label="优先条件"
            value={
              Array.isArray(analyzedIntent.priorities) && analyzedIntent.priorities.length > 0
                ? analyzedIntent.priorities.join(' / ')
                : '-'
            }
          />
        </section>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🏭 工厂结果</h3>
            <p className="mt-1 text-sm text-gray-500">共 {safeFactories.length} 条</p>
          </div>
        </div>

        {safeFactories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-400">
            当前没有工厂结果
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {safeFactories.map((factory) => (
              <div
                key={factory.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">{factory.name}</h4>
                    {factory.location && (
                      <div className="mt-1 text-sm text-gray-500">{factory.location}</div>
                    )}
                  </div>
                </div>

                {factory.description && (
                  <p className="mt-4 text-sm leading-6 text-gray-600">{factory.description}</p>
                )}

                {factory.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {factory.tags.map((tag: string, index: number) => (
                      <button
                        key={`${factory.id}-tag-${index}`}
                        onClick={() => onKeywordClick(tag)}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-200"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {factory.website && (
                  <div className="mt-4">
                    <a
                      href={factory.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-medium text-gray-900 underline underline-offset-4"
                    >
                      查看官网
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🛒 1688 结果</h3>
            <p className="mt-1 text-sm text-gray-500">共 {safe1688.length} 条</p>
          </div>
        </div>

        {safe1688.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-400">
            当前没有1688直达链接
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {safe1688.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="space-y-2">
                  <h4 className="text-base font-semibold text-gray-900">{item.title}</h4>
                  {item.keyword && (
                    <button
                      onClick={() => onKeywordClick(item.keyword)}
                      className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                    >
                      {item.keyword}
                    </button>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                    >
                      打开1688链接
                    </a>
                  ) : (
                    <div className="text-sm text-gray-400">无可用链接</div>
                  )}
                </div>

                {item.url && (
                  <div className="mt-4 break-all text-xs leading-5 text-gray-400">
                    {item.url}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
