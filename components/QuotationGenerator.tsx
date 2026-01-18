
import React, { useState, useEffect, useRef } from 'react';
import { executeSupplierQuoteParse } from '../services/geminiService';
import { SupplierQuote, ExtractionItem, PriceEntry } from '../types';
import { persistenceService } from '../services/persistenceService';

export const QuotationGenerator: React.FC = () => {
  // 核心应用状态
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [currentParse, setCurrentParse] = useState<SupplierQuote | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  
  const [history, setHistory] = useState<SupplierQuote[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // 搜索与过滤状态
  const [searchQuery, setSearchQuery] = useState('');
  
  // 视图控制
  const [viewingRecord, setViewingRecord] = useState<SupplierQuote | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const factHistory = await persistenceService.getSupplierQuotes();
    setHistory(factHistory);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setError(null);
    if (f) {
      setActiveFile(f);
      setCurrentParse(null);
    }
  };

  const startParse = async () => {
    if (!activeFile) return;
    setIsParsing(true);
    setError(null);
    try {
      const result = await executeSupplierQuoteParse(activeFile);
      setCurrentParse(result);
      await loadHistory();
    } catch (err: any) {
      setError(`解析失败: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const formatPrice = (p: number | undefined | null) => {
    if (p === undefined || p === null) return "-";
    return new Intl.NumberFormat('zh-CN', { 
      minimumFractionDigits: 3, 
      maximumFractionDigits: 5 
    }).format(p);
  };

  // 事实库搜索过滤逻辑
  const filteredHistory = history.filter(item => 
    item.supplier.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12 py-10 px-4">
      
      {/* 模块 1：供应商报价事实解析 (锁死图2样式预览) */}
      <section className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h3 className="text-xl font-black text-icare-900 uppercase tracking-tighter mb-8 flex items-center gap-2">
          <span className="w-2 h-2 bg-icare-accent rounded-full animate-pulse"></span> 1. 供应商报价事实解析与实时预览
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div 
              onClick={() => !isParsing && fileInputRef.current?.click()}
              className={`h-64 border-4 border-dashed rounded-[2rem] flex flex-col items-center justify-center cursor-pointer transition-all ${isParsing ? 'bg-slate-50 opacity-50 cursor-wait' : 'hover:border-icare-accent hover:bg-slate-50 border-slate-200'}`}
            >
              <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xlsm,.pdf,image/*" onChange={handleFileChange} />
              {activeFile ? (
                <div className="text-center animate-fade-in-up">
                  <p className="text-5xl mb-4">📄</p>
                  <p className="text-base font-black text-icare-900 truncate max-w-[300px]">{activeFile.name}</p>
                  <div className="flex gap-2 justify-center mt-3">
                    <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{(activeFile.size/1024).toFixed(1)} KB</span>
                    <span className="text-[10px] font-black bg-icare-accent/10 px-2 py-1 rounded text-icare-accent uppercase">{activeFile.name.split('.').pop()}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-5xl mb-4 opacity-20">📁</p>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest leading-relaxed">请选择供应商原始报价单<br/><span className="text-[10px] opacity-60">PDF / XLSX / JPG</span></p>
                </div>
              )}
            </div>

            <button 
              disabled={!activeFile || isParsing}
              onClick={startParse}
              className="w-full py-6 bg-icare-900 text-white rounded-2xl font-black shadow-lg hover:bg-icare-800 disabled:bg-slate-100 disabled:text-slate-300 transition-all uppercase tracking-[0.2em] text-lg active:scale-95"
            >
              {isParsing ? 'AI 正在捕捉价格事实...' : '执行 100% 事实解析'}
            </button>
            {error && <p className="text-xs text-red-500 font-bold bg-red-50 p-4 rounded-xl border border-red-100">{error}</p>}
          </div>

          {/* 右侧实时事实预览 (图2 样式锁死区) */}
          <div className="report-scroll overflow-y-auto max-h-[450px] pr-2 space-y-4">
             {currentParse ? (
                <>
                  <div className="bg-icare-900 text-white p-5 rounded-2xl mb-6 flex justify-between items-center shadow-xl border border-white/5 animate-fade-in-up">
                    <div>
                       <p className="text-[9px] font-black text-icare-gold uppercase tracking-[0.3em] mb-1">捕捉供应商 (Identified)</p>
                       <p className="text-base font-black truncate">{currentParse.supplier.name}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">主币种</p>
                       <p className="text-lg font-black text-icare-gold uppercase">{currentParse.supplier.currency}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5">
                     {currentParse.items.map((it, i) => (
                       <div key={i} className="bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm hover:border-icare-accent transition-all animate-fade-in-up" style={{animationDelay: `${i*0.08}s`}}>
                          <div className="flex items-start gap-4 mb-5">
                             <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl grayscale opacity-40">📦</div>
                             <h5 className="text-base font-black text-icare-900 leading-tight pt-1">{it.product_name}</h5>
                          </div>
                          <div className="space-y-3">
                            {it.prices.map((p, pi) => (
                              <div key={pi} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                 <div className="space-y-1">
                                    <p className="text-[10px] font-black text-icare-accent uppercase tracking-wider">{p.price_type}</p>
                                    <p className="text-[9px] text-slate-400 font-mono font-bold">SOURCE: {p.source}</p>
                                 </div>
                                 <div className="text-right">
                                    <p className="font-black text-green-600 font-mono text-lg tracking-tighter">
                                       {formatPrice(p.unit_price)} <span className="text-[10px] ml-0.5">{p.currency}</span>
                                    </p>
                                 </div>
                              </div>
                            ))}
                          </div>
                       </div>
                     ))}
                  </div>
                </>
             ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 p-12 border-4 border-dashed border-slate-100 rounded-[3rem]">
                   <p className="text-4xl mb-4">🔍</p>
                   <p className="text-slate-400 font-black uppercase tracking-widest text-xs text-center leading-relaxed">等待数据注入...<br/>解析后将在此呈现 100% 价格事实</p>
                </div>
             )}
          </div>
        </div>
      </section>

      {/* 模块 2：供应商报价事实库 (含搜索与详情) */}
      <section className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-200 shadow-inner">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
           <h3 className="text-xl font-black text-icare-900 uppercase tracking-tighter flex items-center gap-2">
              <span className="w-2 h-2 bg-slate-400 rounded-full"></span> 2. 供应商报价事实库
           </h3>
           
           <div className="relative w-full md:w-96">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input 
                 type="text" 
                 placeholder="按供应商名称搜索..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-icare-accent/10 focus:border-icare-accent outline-none transition-all"
              />
           </div>
        </div>

        <div className="grid grid-cols-1 gap-5 max-h-[600px] overflow-y-auto pr-3 report-scroll">
          {filteredHistory.length === 0 ? (
            <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
               <p className="text-5xl mb-4 opacity-10">🗄️</p>
               <p className="text-slate-300 font-black uppercase text-xs tracking-[0.3em]">库中暂无匹配记录</p>
            </div>
          ) : (
            filteredHistory.map(q => (
              <div 
                key={q.id} 
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-transparent hover:border-icare-accent hover:shadow-lg transition-all group flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                <div className="flex gap-6 items-center">
                  <div className="w-14 h-14 bg-icare-900 text-icare-gold rounded-2xl flex items-center justify-center font-black text-[10px] shadow-xl rotate-3 group-hover:rotate-0 transition-all">FACT</div>
                  <div>
                    <h4 className="text-lg font-black text-icare-900 leading-tight">{q.supplier.name}</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                       <p className="text-[10px] text-slate-400 font-bold uppercase">文件: <span className="text-slate-600">{q.file_meta.file_name}</span></p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">币种: <span className="text-icare-accent">{q.supplier.currency}</span></p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">产品数: <span className="text-slate-900">{q.items.length}</span></p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">时间: <span className="text-slate-500">{new Date(q.created_at || q.createdAt).toLocaleDateString()}</span></p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingRecord(q)} 
                  className="bg-icare-900 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-icare-800 active:scale-95 transition-all shadow-md"
                >
                  查看完整明细
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 详情回看 Modal (固定事实明细展示) */}
      {viewingRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-icare-900/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-2xl font-black text-icare-900">{viewingRecord.supplier.name}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                   事实 ID: {viewingRecord.id} | 解析于: {new Date(viewingRecord.created_at || viewingRecord.createdAt).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setViewingRecord(null)} className="text-slate-400 hover:text-icare-900 p-4 bg-white rounded-full shadow-lg hover:scale-110 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg>
              </button>
            </div>
            <div className="flex-grow overflow-y-auto p-12 report-scroll space-y-8 bg-slate-50/20">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {viewingRecord.items.map((it: any, i: number) => (
                    <div key={i} className="bg-white p-7 rounded-[2rem] border border-slate-200 space-y-5 shadow-sm">
                       <p className="text-base font-black text-icare-900 leading-tight border-l-4 border-icare-accent pl-4">{it.product_name}</p>
                       <div className="space-y-3">
                          {it.prices.map((p: any, pi: number) => (
                            <div key={pi} className="flex justify-between items-center bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100">
                               <div className="space-y-1">
                                  <p className="text-[10px] font-black text-icare-accent uppercase">{p.price_type}</p>
                                  <p className="text-[9px] text-slate-400 font-mono font-bold">证据: {p.source}</p>
                               </div>
                               <p className="text-xl font-black text-green-600 font-mono tracking-tighter">{formatPrice(p.unit_price)} <span className="text-xs">{p.currency}</span></p>
                            </div>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
            <div className="px-12 py-8 border-t border-slate-100 flex justify-end gap-4 bg-slate-50">
              <button 
                 onClick={() => setViewingRecord(null)} 
                 className="px-12 py-4 bg-icare-900 text-white text-xs font-black rounded-2xl shadow-xl hover:bg-icare-800 transition-all uppercase tracking-widest active:scale-95"
              >
                 关闭预览
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部合规声明 (装饰) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-12 border-t border-slate-200">
        <div className="bg-red-50 p-10 rounded-[3rem] border border-red-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl font-black">P0</div>
          <h5 className="text-[13px] font-black text-red-600 uppercase mb-4 tracking-widest flex items-center gap-3">
             <span className="w-2.5 h-2.5 bg-red-600 rounded-full"></span> 价格事实 100% 还原
          </h5>
          <p className="text-[11px] text-red-400 font-bold leading-relaxed uppercase tracking-widest">
            强制拷贝并呈现供应商报价单中的所有价格维度。任何单价均附带原始单元格地址证据 source 追溯，确保采购证据链条的完整性。
          </p>
        </div>
        <div className="bg-icare-accent/5 p-10 rounded-[3rem] border border-icare-accent/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl font-black">P1</div>
          <h5 className="text-[13px] font-black text-icare-accent uppercase mb-4 tracking-widest flex items-center gap-3">
             <span className="w-2.5 h-2.5 bg-icare-accent rounded-full"></span> 数据物理隔离守卫
          </h5>
          <p className="text-[11px] text-icare-accent/60 font-bold leading-relaxed uppercase tracking-widest">
            系统仅负责供应商事实解析与入库管理。当前阶段禁止任何非事实性数据的回写，确保采购核心事实库的“原始性”与“只读性”。
          </p>
        </div>
      </div>
    </div>
  );
};
