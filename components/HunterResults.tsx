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
  const [analyzedIntent, setAnalyzedIntent] = useState<any>(null);

  useEffect(() => {
    setFactories(Array.isArray((initialResult as any)?.factories) ? (initialResult as any).factories : []);
    setAnalyzedIntent((initialResult as any)?.analyzedIntent || null);
  }, [initialResult]);

  const safeFactories = useMemo(
    () =>
      factories.map((f: any, index: number) => ({
        id: `${String(f?.name || 'factory')}-${index}`,
        name: String(f?.name || 'Unnamed Factory'),
        location: String(f?.location || ''),
        website: String(f?.website || f?.url || ''),
        description: String(f?.description || f?.summary || ''),
        tags: Array.isArray(f?.tags) ? f.tags.filter(Boolean) : [],
      })),
    [factories]
  );

  const handleOpenFactorySearch = () => {
    const keyword = analyzedIntent?.factoryKeyword || originalRequest?.query || '';
    if (!String(keyword).trim()) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, '_blank', 'noopener,noreferrer');
  };

  const InfoCard = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-sm text-slate-900 break-words">{value || '-'}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[#0B1A33] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-300">iCare Factory Search</div>
            <h2 className="mt-2 text-2xl font-semibold">
              {originalRequest?.query || analyzedIntent?.factoryKeyword || 'Factory Search Results'}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              当前版本仅保留工厂搜索，已移除 1688 干扰逻辑。
            </p>
          </div>

          <button
            onClick={handleOpenFactorySearch}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[#0B1A33] transition hover:opacity-90"
          >
            打开工厂搜索
          </button>
        </div>
      </section>

      {analyzedIntent && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="工厂关键词" value={analyzedIntent.factoryKeyword} />
          <InfoCard label="原始需求" value={analyzedIntent.originalQuery || originalRequest?.query || '-'} />
          <InfoCard label="价格上限" value={analyzedIntent.maxPrice ?? '-'} />
          <InfoCard
            label="优先条件"
            value={
              Array.isArray(analyzedIntent.priorities) && analyzedIntent.priorities.length > 0
                ? analyzedIntent.priorities.join(' / ')
                : '-'
            }
          />
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-[#F7F8FA] p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">工厂结果</h3>
            <p className="mt-1 text-sm text-slate-500">共 {safeFactories.length} 条</p>
          </div>
        </div>

        {safeFactories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            当前没有工厂结果
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {safeFactories.map((factory) => (
              <div
                key={factory.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">{factory.name}</h4>
                  {factory.location && <div className="mt-1 text-sm text-slate-500">{factory.location}</div>}
                </div>

                {factory.description && (
                  <p className="mt-4 text-sm leading-6 text-slate-600">{factory.description}</p>
                )}

                {factory.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {factory.tags.map((tag: string, index: number) => (
                      <button
                        key={`${factory.id}-tag-${index}`}
                        onClick={() => onKeywordClick(tag)}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
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
                      className="inline-flex items-center rounded-lg bg-[#0B1A33] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
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
    </div>
  );
};
