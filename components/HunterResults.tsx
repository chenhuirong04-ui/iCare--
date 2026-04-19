import React, { useState, useEffect } from 'react';
import { HunterResult, Supplier, Source, SourcingRequest } from '../types';
import { generateSourcingReport } from '../services/geminiService';
import { generateSupplierExcel } from '../services/excelService';

interface HunterResultsProps {
  initialResult: HunterResult | any;
  sources: Source[];
  onKeywordClick: (keyword: string) => void;
  originalRequest?: SourcingRequest;
}

type FactoryItem = Supplier & {
  id?: string;
  selected?: boolean;
};

type Marketplace1688Item = {
  id?: string;
  title: string;
  shopName?: string;
  type: 'shop' | 'product' | string;
  products?: string[];
  location?: string;
  url: string;
  source?: string;
  sourceType?: '1688' | string;
  matchType?: 'keyword' | 'visual' | string;
  selected?: boolean;
};

export const HunterResults: React.FC<HunterResultsProps> = ({
  initialResult,
  sources,
  onKeywordClick,
  originalRequest
}) => {
  const [factories, setFactories] = useState<FactoryItem[]>([]);
  const [marketplaces1688, setMarketplaces1688] = useState<Marketplace1688Item[]>([]);

  const [filterType, setFilterType] = useState<string>('all');
  const [onlyHighCredibility, setOnlyHighCredibility] = useState(false);
  const [onlyWithContact, setOnlyWithContact] = useState(false);
  const [copyStatus, setCopyStatus] = useState<{ [key: string]: string }>({});
  const [isExpanding, setIsExpanding] = useState(false);
  const [searchDepth, setSearchDepth] = useState<'quick' | 'deep'>('quick');
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const [reachedBoundary, setReachedBoundary] = useState(false);

  useEffect(() => {
    const initialFactories = ((initialResult as any)?.factories || []).map((f: any) => ({
      ...f,
      id: f.id || Math.random().toString(36).substr(2, 9),
      selected: Boolean(f.isOfficialWebsite && f.isCorporateEmail),
    }));

    const initial1688 = ((initialResult as any)?.marketplaces1688 || []).map((m: any) => ({
      ...m,
      id: m.id || Math.random().toString(36).substr(2, 9),
      selected: false,
    }));

    setFactories(initialFactories);
    setMarketplaces1688(initial1688);
    setActiveSources(sources || []);
    setReachedBoundary(false);
  }, [initialResult, sources]);

  const filteredFactories = factories.filter((s) => {
    if (filterType !== 'all' && s.type !== filterType) return false;
    if (onlyWithContact && !s.phone && !s.email && !s.website && !s.whatsapp) return false;
    if (onlyHighCredibility && !(s.isOfficialWebsite && s.isCorporateEmail)) return false;
    return true;
  });

  const getCopyText = (lang: 'cn' | 'en', supplierName: string) => {
    const productName = originalRequest?.query || '相关产品';
    if (lang === 'cn') {
      return `您好，我们是 GLOBALCARE INFO GENERAL TRADING FZCO（GCI），在迪拜采购【${productName}】做长期合作。请问贵司是否支持 OEM/贴牌？请提供：1）MOQ 2）报价（含包装）3）交期 4）认证（如ISO）5）样品。谢谢。——Chris +971 58 556 6809 / chrischen1579@gmail.com`;
    }
    return `Hello, this is GCI (GLOBALCARE INFO GENERAL TRADING FZCO) from Dubai. We are looking for long-term cooperation on 【${productName}】. Do you support OEM/private labeling? Please provide: 1) MOQ 2) Quotation 3) Lead time 4) Certifications 5) Sample policy. Best regards, Chris +971 58 556 6809 / chrischen1579@gmail.com`;
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus({ [id]: '已复制' });
      setTimeout(() => setCopyStatus({}), 2000);
    });
  };

  const handleContinueSearch = async () => {
    if (!originalRequest) return;

    setIsExpanding(true);
    setReachedBoundary(false);

    try {
      const existingFactoryNames = factories.map((s) => s.name);
      const existingDomains = factories
        .map((s) => s.website?.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0])
        .filter(Boolean) as string[];

      const existing1688Urls = marketplaces1688.map((m) => m.url).filter(Boolean);

      const moreResult = await generateSourcingReport(
        originalRequest.query,
        (originalRequest as any).images,
        existingFactoryNames,
        searchDepth,
        undefined
      );

      const nextFactories = ((moreResult as any)?.hunterResult?.factories || [])
        .filter((ns: any) => {
          const cleanName = (ns.name || '').trim();
          const cleanDomain = ns.website?.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
          const isDuplicate =
            existingFactoryNames.some((en) => en.includes(cleanName) || cleanName.includes(en)) ||
            (cleanDomain && existingDomains.includes(cleanDomain));
          return !isDuplicate;
        })
        .map((ns: any) => ({
          ...ns,
          id: ns.id || Math.random().toString(36).substr(2, 9),
          selected: Boolean(ns.isOfficialWebsite && ns.isCorporateEmail),
        }));

      const next1688 = ((moreResult as any)?.hunterResult?.marketplaces1688 || [])
        .filter((m: any) => m.url && !existing1688Urls.includes(m.url))
        .map((m: any) => ({
          ...m,
          id: m.id || Math.random().toString(36).substr(2, 9),
          selected: false,
        }));

      if (nextFactories.length === 0 && next1688.length === 0) {
        setReachedBoundary(true);
      } else {
        if (nextFactories.length > 0) {
          setFactories((prev) => [...prev, ...nextFactories]);
        }
        if (next1688.length > 0) {
          setMarketplaces1688((prev) => [...prev, ...next1688]);
        }
        if ((moreResult as any)?.sources?.length) {
          setActiveSources((prev) => [...prev, ...(moreResult as any).sources]);
        }
      }
    } catch (err) {
      console.error(err);
      alert('扩展搜索失败，请重试。');
    } finally {
      setIsExpanding(false);
    }
  };

  const handleExport = async () => {
    const toExport = filteredFactories.filter((s) => s.selected);
    if (toExport.length === 0) return alert('请先勾选需要导出的供应商。');
    alert(`准备导出 ${toExport.length} 个供应商事实。`);
  };

  const toggleSelect = (id: string) => {
    const s = factories.find((sup) => sup.id === id);
    if (!s) return;

    if (!(s.isOfficialWebsite && s.isCorporateEmail)) {
      if (s.matchType === 'visual' && s.type === '工厂') {
        setFactories((prev) =>
          prev.map((sup) => (sup.id === id ? { ...sup, selected: !sup.selected } : sup))
        );
        return;
      }

      if (!window.confirm('该供应商信用度未达标（非官网/非企邮），确定要将其加入询盘清单吗？')) return;
    }

    setFactories((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const toggleAll = (select: boolean) => {
    if (select) {
      setFactories((prev) =>
        prev.map((s) => ({
          ...s,
          selected:
            (s.isOfficialWebsite && s.isCorporateEmail) ||
            (s.matchType === 'visual' && s.type === '工厂'),
        }))
      );
    } else {
      setFactories((prev) => prev.map((s) => ({ ...s, selected: false })));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Primary Actions Area */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 sticky top-20 z-40 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-1 w-full md:w-auto">
          <h3 className="font-extrabold text-icare-900 text-lg">
            🔍 真实工厂：{factories.length}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            工厂与 1688 结果已分开展示，不再混入同一张卡片
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setSearchDepth('quick')}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                searchDepth === 'quick'
                  ? 'bg-white shadow-sm text-icare-accent'
                  : 'text-slate-500'
              }`}
            >
              快速 (+10)
            </button>
            <button
              onClick={() => setSearchDepth('deep')}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                searchDepth === 'deep'
                  ? 'bg-white shadow-sm text-icare-accent'
                  : 'text-slate-500'
              }`}
            >
              深度 (+30)
            </button>
          </div>

          <button
            onClick={handleContinueSearch}
            disabled={isExpanding || reachedBoundary}
            className={`flex-grow md:flex-grow-0 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all ${
              reachedBoundary
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-icare-accent text-white hover:shadow-xl hover:bg-sky-500 active:scale-95 disabled:opacity-50'
            }`}
          >
            {isExpanding ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : reachedBoundary ? (
              <span>已到达真实边界</span>
            ) : (
              <span>⚡ 继续检索新增结果</span>
            )}
          </button>

          <button
            onClick={handleExport}
            className="flex-grow md:flex-grow-0 flex items-center justify-center gap-2 px-6 py-3 bg-icare-900 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:bg-slate-800 active:scale-95 transition-all"
          >
            📥 批量发送 RFQ
          </button>
        </div>
      </div>

      {reachedBoundary && (
        <div className="bg-orange-50 border-2 border-orange-100 p-6 rounded-2xl flex items-start gap-4 animate-fade-in-up">
          <div className="text-2xl">⚠️</div>
          <div>
            <h4 className="text-sm font-black text-orange-900 uppercase mb-1">
              已到达当前搜索维度的真实边界
            </h4>
            <p className="text-xs text-orange-700 font-medium leading-relaxed">
              在当前条件下，已穷尽发现新的唯一结果。若需获取更多结果，建议：
              <br />• <strong>更换对标图片</strong>
              <br />• <strong>调整搜索词</strong>
              <br />• <strong>放宽筛选条件</strong>
            </p>
          </div>
        </div>
      )}

      {/* Keywords / Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            💡 切换搜索维度
          </h4>
          <div className="flex flex-wrap gap-2">
            {((initialResult as any)?.suggestedKeywords || []).map((kw: string, i: number) => (
              <button
                key={i}
                onClick={() => onKeywordClick(kw)}
                className="text-xs bg-icare-accent/5 text-icare-accent px-3 py-1.5 rounded-full font-bold hover:bg-icare-accent hover:text-white transition-all active:scale-95 border border-icare-accent/10"
              >
                # {kw}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 flex flex-col justify-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 outline-none font-bold shadow-sm"
          >
            <option value="all">所有规模</option>
            <option value="工厂">只看工厂</option>
            <option value="OEM">只看 OEM</option>
            <option value="贸易">只看贸易</option>
          </select>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyHighCredibility}
                onChange={(e) => setOnlyHighCredibility(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-icare-accent focus:ring-icare-accent"
              />
              只看高信誉度
            </label>
            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWithContact}
                onChange={(e) => setOnlyWithContact(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-icare-accent focus:ring-icare-accent"
              />
              只看直连电话
            </label>
          </div>
        </div>
      </div>

      {/* Selection Utility */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
          <button onClick={() => toggleAll(true)} className="hover:text-icare-accent">
            智能勾选优质工厂
          </button>
          <button onClick={() => toggleAll(false)} className="hover:text-icare-900">
            全部取消
          </button>
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase">
          工厂显示: {filteredFactories.length} / 工厂总计: {factories.length} ｜ 1688来源: {marketplaces1688.length}
        </div>
      </div>

      {/* 工厂区 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="font-extrabold text-base text-icare-900">🏭 真实工厂</h4>
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            {filteredFactories.length} Results
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFactories.map((s) => {
            const isHighCred = s.isOfficialWebsite && s.isCorporateEmail;
            const isVisual = s.matchType === 'visual';

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden group flex flex-col ${
                  s.selected
                    ? 'border-icare-accent ring-1 ring-icare-accent/20 shadow-lg'
                    : 'border-slate-200 shadow-sm opacity-90'
                }`}
              >
                <div className="p-5 flex-grow space-y-3 relative">
                  <div className="absolute top-5 right-5 flex flex-col items-end gap-1">
                    <div className="flex gap-1">
                      <span
                        className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                          s.isOfficialWebsite
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        官网 {s.isOfficialWebsite ? '✓' : '✗'}
                      </span>
                      <span
                        className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                          s.isCorporateEmail
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        企邮 {s.isCorporateEmail ? '✓' : '✗'}
                      </span>
                    </div>

                    {isVisual ? (
                      <span className="text-[8px] px-2 py-0.5 bg-icare-gold/20 text-icare-gold border border-icare-gold/30 rounded-full font-black uppercase tracking-widest">
                        图品匹配
                      </span>
                    ) : (
                      <span className="text-[8px] px-2 py-0.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-full font-black uppercase tracking-widest">
                        关键词匹配
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-3 flex-grow pr-24">
                      <input
                        type="checkbox"
                        checked={!!s.selected}
                        onChange={() => toggleSelect(s.id!)}
                        className={`w-5 h-5 mt-0.5 rounded border-slate-300 focus:ring-icare-accent cursor-pointer ${
                          isHighCred || (isVisual && s.type === '工厂')
                            ? 'text-icare-accent'
                            : 'text-slate-400'
                        }`}
                      />
                      <div className="flex-grow">
                        <h4
                          className={`font-black text-base group-hover:text-icare-accent transition-colors truncate ${
                            !isHighCred && !isVisual ? 'text-slate-600' : ''
                          }`}
                          title={s.name}
                        >
                          {s.name}
                        </h4>
                        {s.nameEn && (
                          <p className="text-[10px] text-slate-400 font-medium truncate">
                            {s.nameEn}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] px-2 py-1 rounded font-extrabold uppercase flex-shrink-0 ${
                        s.type === '工厂'
                          ? 'bg-icare-accent/10 text-icare-accent'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {s.type}
                    </span>
                    <div className="text-[10px] flex items-center gap-1.5 text-slate-500 font-bold bg-slate-50 w-fit px-2 py-1 rounded">
                      <span className="text-sm">📍</span> {s.location}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(s.products || []).map((p, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-blue-50/50 text-blue-600 px-2 py-1 rounded border border-blue-100 font-medium"
                      >
                        {p}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                    {s.phone && (
                      <a
                        href={`tel:${s.phone}`}
                        className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors border border-blue-100"
                      >
                        <span className="text-sm">📞</span>
                        <span className="text-[10px] font-extrabold truncate">{s.phone}</span>
                      </a>
                    )}
                    {s.whatsapp && (
                      <a
                        href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors border border-green-100"
                      >
                        <span className="text-sm">💬</span>
                        <span className="text-[10px] font-extrabold truncate">WhatsApp</span>
                      </a>
                    )}
                    {s.email && (
                      <a
                        href={`mailto:${s.email}`}
                        className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors border col-span-2 ${
                          s.isCorporateEmail
                            ? 'text-orange-600 hover:bg-orange-50 border-orange-100'
                            : 'text-slate-400 hover:bg-slate-50 border-slate-100'
                        }`}
                      >
                        <span className="text-sm">✉️</span>
                        <span className="text-[10px] font-extrabold truncate">{s.email}</span>
                      </a>
                    )}
                    {s.website && (
                      <a
                        href={s.website}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors border col-span-2 ${
                          s.isOfficialWebsite
                            ? 'text-icare-accent hover:bg-sky-50 border-sky-100'
                            : 'text-slate-400 hover:bg-slate-50 border-slate-100'
                        }`}
                      >
                        <span className="text-sm">🌐</span>
                        <span className="text-[10px] font-extrabold truncate">{s.website}</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex border-t border-slate-100 bg-slate-50/50">
                  <button
                    onClick={() => handleCopy(`card-cn-${s.id}`, getCopyText('cn', s.name))}
                    className="flex-1 py-3 text-[10px] font-bold text-slate-400 hover:text-icare-900 hover:bg-white transition-all border-r border-slate-100"
                  >
                    {copyStatus[`card-cn-${s.id}`] || '复制中文话术'}
                  </button>
                  <button
                    onClick={() => handleCopy(`card-en-${s.id}`, getCopyText('en', s.name))}
                    className="flex-1 py-3 text-[10px] font-bold text-slate-400 hover:text-icare-900 hover:bg-white transition-all"
                  >
                    {copyStatus[`card-en-${s.id}`] || 'Copy EN Script'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1688区 */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="font-extrabold text-base text-amber-700">🛒 1688 店铺 / 商品</h4>
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            {marketplaces1688.length} Results
          </div>
        </div>

        {marketplaces1688.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-sm text-slate-400">
            当前没有独立的 1688 店铺或商品结果
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketplaces1688.map((m) => {
              const isVisual = m.matchType === 'visual';

              return (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="p-5 flex-grow space-y-3 relative">
                    <div className="absolute top-5 right-5 flex flex-col items-end gap-1">
                      <span className="text-[8px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-black uppercase tracking-widest">
                        1688
                      </span>
                      <span className="text-[8px] px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-full font-black uppercase tracking-widest">
                        {m.type === 'product' ? '商品' : '店铺'}
                      </span>
                      <span className="text-[8px] px-2 py-0.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-full font-black uppercase tracking-widest">
                        {isVisual ? '图品匹配' : '关键词匹配'}
                      </span>
                    </div>

                    <div className="pr-24">
                      <h4
                        className="font-black text-base text-slate-800 truncate"
                        title={m.title}
                      >
                        {m.title}
                      </h4>
                      {m.shopName && (
                        <p className="text-[10px] text-slate-400 font-medium truncate mt-1">
                          {m.shopName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] px-2 py-1 rounded font-extrabold uppercase flex-shrink-0 bg-amber-50 text-amber-700">
                        {m.type === 'product' ? '1688 商品' : '1688 店铺'}
                      </span>
                      {m.location && (
                        <div className="text-[10px] flex items-center gap-1.5 text-slate-500 font-bold bg-slate-50 w-fit px-2 py-1 rounded">
                          <span className="text-sm">📍</span> {m.location}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(m.products || []).map((p, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 font-medium"
                        >
                          {p}
                        </span>
                      ))}
                    </div>

                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg transition-colors border border-amber-100 text-amber-700 hover:bg-amber-50"
                    >
                      <span className="text-sm">🔗</span>
                      <span className="text-[10px] font-extrabold truncate">{m.url}</span>
                    </a>
                  </div>

                  <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div className="text-[10px] text-slate-400 font-bold">
                      独立 1688 来源，不再挂在工厂资料里作为“搜索按钮”
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sources */}
      {activeSources.length > 0 && (
        <div className="pt-10 border-t border-slate-200">
          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Grounding Sources (数据验证来源)
          </h5>
          <div className="flex flex-wrap gap-2">
            {activeSources.map((src, i) => (
              <a
                key={i}
                href={src.uri}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-600 hover:border-icare-accent hover:text-icare-accent transition-all shadow-sm flex items-center gap-2"
              >
                <span className="opacity-40">[{i + 1}]</span>
                <span className="font-medium truncate max-w-[150px]">{src.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
