import React, { useEffect, useMemo, useState } from 'react';
import { HunterResult, Source, SourcingRequest } from '../types';

interface HunterResultsProps {
  initialResult: HunterResult | any;
  sources: Source[];
  onKeywordClick: (keyword: string) => void;
  originalRequest?: SourcingRequest;
}

type FactoryCard = {
  id: string;
  name: string;
  location: string;
  website: string;
  description: string;
  tags: string[];
};

type MarketplaceCard = {
  id: string;
  title: string;
  keyword: string;
  url: string;
};

const cleanText = (value: unknown) => String(value ?? '').trim();

const build1688SearchUrl = (keyword: string, maxPrice?: number | null): string => {
  const params = new URLSearchParams();
  params.set('keywords', cleanText(keyword));

  if (typeof maxPrice === 'number' && !Number.isNaN(maxPrice) && maxPrice > 0) {
    params.set('beginPrice', '0');
    params.set('endPrice', String(maxPrice));
  }

  return `https://s.1688.com/selloffer/offer_search.htm?${params.toString()}`;
};

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

  const safeFactories = useMemo<FactoryCard[]>(
    () =>
      factories.map((f: any, index: number) => ({
        id: `${cleanText(f?.name) || 'factory'}-${index}`,
        name: cleanText(f?.name) || 'Unnamed Factory',
        location: cleanText(f?.location),
        website: cleanText(f?.website || f?.url),
        description: cleanText(f?.description || f?.summary),
        tags: Array.isArray(f?.tags) ? f.tags.filter(Boolean).map((t: any) => cleanText(t)) : [],
      })),
    [factories]
  );

  const safe1688 = useMemo<MarketplaceCard[]>(
    () =>
      marketplaces1688.map((m: any, index: number) => {
        const keyword =
          cleanText(m?.keyword) ||
          cleanText(analyzedIntent?.keyword1688) ||
          cleanText(originalRequest?.query);

        return {
          id: `${cleanText(m?.title || keyword || '1688')}-${index}`,
          title: cleanText(m?.title) || keyword || '1688 Search Result',
          keyword,
          url: build1688SearchUrl(
            keyword,
            typeof analyzedIntent?.maxPrice === 'number' ? analyzedIntent.maxPrice : null
          ),
        };
      }),
    [marketplaces1688, analyzedIntent, originalRequest]
  );

  const top1688Url = useMemo(() => {
    const keyword =
      cleanText(analyzedIntent?.keyword1688) ||
      cleanText(originalRequest?.query) ||
      cleanText(safe1688[0]?.keyword);

    if (!keyword) return '';

    return build1688SearchUrl(
      keyword,
      typeof analyzedIntent?.maxPrice === 'number' ? analyzedIntent.maxPrice : null
    );
  }, [analyzedIntent, originalRequest, safe1688]);

  const handleOpenFactorySearch = () => {
    const keyword = cleanText(analyzedIntent?.factoryKeyword) || cleanText(originalRequest?.query);
    if (!keyword) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpen1688Search = () => {
    if (!top1688Url) {
      alert('当前没有可用的1688搜索链接');
      return;
    }
    window.open(top1688Url, '_blank', 'noopener,noreferrer');
  };

  const InfoItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-900 break-words">{value || '-'}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              iCare Sourcing Result
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {cleanText(originalRequest?.query) || cleanText(analyzedIntent?.keyword1688) || 'Sourcing Results'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Factory search 与 1688 search 分开展示，顶部与卡片统一使用可打开的搜索链接。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleOpenFactorySearch}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
            >
              🔎 工厂搜索
            </button>

            <button
              onClick={handleOpen1688Search}
              className="inline-flex items-center justify-center rounded-xl bg-[#0B1633] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              🛒 打开1688
            </button>
          </div>
        </div>
      </section>

      {analyzedIntent && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoItem label="工厂关键词" value={cleanText(analyzedIntent?.factoryKeyword)} />
          <InfoItem label="1688关键词" value={cleanText(analyzedIntent?.keyword1688)} />
          <InfoItem label="价格上限" value={analyzedIntent?.maxPrice ?? '-'} />
          <InfoItem
            label="优先条件"
            value={
              Array.isArray(analyzedIntent?.priorities) && analyzedIntent.priorities.length > 0
                ? analyzedIntent.priorities.join(' / ')
                : '-'
            }
          />
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">🏭 工厂结果</h3>
            <p className="mt-1 text-sm text-slate-500">共 {safeFactories.length} 条</p>
          </div>
        </div>

        {safeFactories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">
            当前没有工厂结果
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {safeFactories.map((factory) => (
              <div
                key={factory.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">{factory.name}</h4>
                    {factory.location && <p className="mt-1 text-sm text-slate-500">{factory.location}</p>}
                  </div>
                </div>

                {factory.description && (
                  <p className="mt-4 text-sm leading-6 text-slate-600">{factory.description}</p>
                )}

                {factory.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {factory.tags.map((tag, index) => (
                      <button
                        key={`${factory.id}-${index}`}
                        onClick={() => onKeywordClick(tag)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {factory.website && (
                  <div className="mt-5">
                    <a
                      href={factory.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900 ring-1 ring-slate-200 transition hover:bg-slate-100"
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

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">🛒 1688 结果</h3>
            <p className="mt-1 text-sm text-slate-500">共 {safe1688.length} 条</p>
          </div>
        </div>

        {safe1688.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-400">
            当前没有1688结果
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {safe1688.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-slate-900">{item.title}</h4>

                  {item.keyword && (
                    <button
                      onClick={() => onKeywordClick(item.keyword)}
                      className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                    >
                      {item.keyword}
                    </button>
                  )}
                </div>

                <div className="mt-5">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-xl bg-[#0B1633] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    打开1688搜索
                  </a>
                </div>

                <div className="mt-4 break-all text-xs leading-5 text-slate-400">
                  {item.url}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
