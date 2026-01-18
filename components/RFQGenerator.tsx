
import React, { useState, useRef, useEffect } from 'react';
import { RFQProduct, RFQInquiry, SessionImage } from '../types';
import { analyzeRFQImages, parseRFQList } from '../services/geminiService';
import { generateRFQExcel } from '../services/excelService';
import { persistenceService } from '../services/persistenceService';

interface RFQGeneratorProps {
  sessionImages?: SessionImage[];
}

export const RFQGenerator: React.FC<RFQGeneratorProps> = ({ sessionImages = [] }) => {
  // --- BUILD TAG (Verification) ---
  const BUILD_TAG = "BUILD: RFQ_CLOUD_SYNC_V1";

  // --- Core State ---
  const [images, setImages] = useState<SessionImage[]>([]);
  const [items, setItems] = useState<RFQProduct[]>([]);
  const [targetMarket, setTargetMarket] = useState('');
  const [notes, setNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [currentRfqNo, setCurrentRfqNo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listInputRef = useRef<HTMLInputElement>(null);

  // Persistence Logic
  const commitToDB = async (rfqNo: string, currentItems: RFQProduct[], market: string, remark: string, attachments: string[]) => {
    try {
      const record: any = {
        id: rfqNo,
        targetMarket: market,
        notes: remark,
        items: currentItems,
        status: 'Pending_Sourcing',
        attachments: attachments
      };
      await persistenceService.saveRFQ(record);
      console.log(`[RFQ_SYNC] Committed: ${rfqNo}`);
    } catch (e) {
      console.error("Storage Sync Error:", e);
    }
  };

  // --- Auto-Ingest Engine ---
  const processAndAnalyze = async (newImages: SessionImage[]) => {
    if (newImages.length === 0) return;
    setAnalyzing(true);

    const rfqNo = currentRfqNo || `INQ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    if (!currentRfqNo) setCurrentRfqNo(rfqNo);

    try {
      // Step 1: Request AI Analysis
      const payload = newImages.map(img => ({ data: img.data, mimeType: img.mimeType }));
      const result = await analyzeRFQImages(payload);

      // Step 2: Merge items & update UI
      const updatedItems = [...items, ...(result && result.length > 0 ? result : [{
        id: Math.random().toString(36).substr(2, 9),
        productNameCn: "待定义产品 (图片已采集)",
        quantity: 0,
        unit: 'pcs'
      }])];
      setItems(updatedItems);

      // Step 3: Auto-Commit to DB (Async Cloud First)
      await commitToDB(rfqNo, updatedItems, targetMarket, notes, [...images, ...newImages].map(img => img.id));
    } catch (err) {
      console.error("Ingestion Analysis Failed:", err);
      const fallbackItems = [...items, {
        id: Math.random().toString(36).substr(2, 9),
        productNameCn: "解析异常产品 (图片已存库)",
        quantity: 0,
        unit: 'pcs'
      }];
      setItems(fallbackItems);
      await commitToDB(rfqNo, fallbackItems, targetMarket, notes, [...images, ...newImages].map(img => img.id));
    } finally {
      setAnalyzing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const processed = await Promise.all(
      files.map(async (file) => {
        const data = await fileToBase64(file);
        return {
          id: Math.random().toString(36).substr(2, 9),
          url: URL.createObjectURL(file),
          data,
          mimeType: file.type,
          sourceModule: 'RFQ' as const
        };
      })
    );

    setImages(prev => [...prev, ...processed]);
    await processAndAnalyze(processed);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      const processed = await Promise.all(files.map(async (file) => {
        const data = await fileToBase64(file);
        return { id: Math.random().toString(36).substr(2, 9), url: URL.createObjectURL(file), data, mimeType: file.type, sourceModule: 'RFQ' as const };
      }));
      setImages(prev => [...prev, ...processed]);
      await processAndAnalyze(processed);
    }
  };

  const handleConfirmAndExport = async () => {
    if (items.length === 0 || !currentRfqNo) return alert("请先上传图片事实。");
    setAnalyzing(true);
    try {
      await commitToDB(currentRfqNo, items, targetMarket, notes, images.map(img => img.id));
      await generateRFQExcel(items, { rfqNo: currentRfqNo, targetMarket, notes, deadline: '' }, images);
      alert(`✅ RFQ ${currentRfqNo} 已归档并导出。已针对中国供应商优化模板字段。`);
    } catch (e) {
      alert("导出失败，请检查网络。");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 p-4">
      {/* Verification Debug Tag */}
      <div className="fixed top-2 right-2 bg-icare-accent text-white text-[9px] px-2 py-1 rounded font-mono font-bold z-[60] shadow-xl">
        {BUILD_TAG}
      </div>

      {/* Header Panel */}
      <div className="bg-icare-900 text-white p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between shadow-2xl border-l-[12px] border-icare-accent gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-icare-gold font-black text-2xl shadow-inner">INQ</div>
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">RFQ Inquiry Engine (询盘工单)</h3>
            <p className="text-[10px] text-icare-accent tracking-[0.4em] uppercase font-black mt-1">Automatic Fact Ingestion • RFQ_Inquiry_DB</p>
          </div>
        </div>
        {currentRfqNo && (
          <div className="bg-white/5 px-4 py-2 rounded-xl text-icare-gold font-mono text-xs font-bold border border-white/10">
            RECORD: {currentRfqNo}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Input Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl space-y-6">
            <h4 className="text-sm font-black text-icare-900 uppercase tracking-widest">1. 图片事实录入 (实时解析)</h4>
            
            <div 
              onClick={() => !analyzing && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`h-48 border-4 border-dashed rounded-[1.5rem] flex flex-col items-center justify-center cursor-pointer transition-all ${isDragging ? 'bg-icare-accent/5 border-icare-accent scale-[1.02]' : 'border-slate-100 hover:border-icare-accent hover:bg-slate-50'} ${analyzing ? 'opacity-50 cursor-wait' : ''}`}
            >
              <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*"/>
              <span className="text-4xl mb-3">📸</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-4">
                点击、粘贴或拖拽产品图片<br/>上传后自动生成清单
              </span>
            </div>

            {/* Ingested Thumbnails */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 pt-2">
                {images.map(img => (
                  <div key={img.id} className="aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm relative group">
                    <img src={img.url} className="w-full h-full object-cover" />
                    <button onClick={(e) => { e.stopPropagation(); setImages(images.filter(i => i.id !== img.id)) }} className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl space-y-4 border border-white/5">
            <h4 className="text-[10px] font-black text-icare-gold uppercase tracking-widest">2. 询盘单据属性</h4>
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase mb-2">目标市场 (可选)</label>
              <input value={targetMarket} onChange={e => { 
                const val = e.target.value;
                setTargetMarket(val); 
                if(currentRfqNo) commitToDB(currentRfqNo, items, val, notes, images.map(img => img.id));
              }} className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none focus:border-icare-accent" placeholder="例如: Dubai / UAE"/>
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase mb-2">采集备注 (可选)</label>
              <textarea value={notes} onChange={e => { 
                const val = e.target.value;
                setNotes(val); 
                if(currentRfqNo) commitToDB(currentRfqNo, items, targetMarket, val, images.map(img => img.id));
              }} rows={3} className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none focus:border-icare-accent resize-none" placeholder="输入客户要求、品质等级等..."/>
            </div>
          </div>
        </div>

        {/* Right Output Section (Items View) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl flex flex-col h-full min-h-[550px]">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-50">
               <h4 className="text-lg font-black text-icare-900 uppercase tracking-tighter">Inquiry Items (询盘事实列表)</h4>
               <div className="flex gap-2">
                 {analyzing && <span className="bg-icare-accent/10 px-3 py-1 rounded-full text-[9px] font-black text-icare-accent uppercase animate-pulse">Ingesting Facts...</span>}
                 <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase">{items.length} 项有效</span>
               </div>
            </div>

            <div className="flex-grow report-scroll overflow-y-auto space-y-3 pr-2">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 py-24 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                   <p className="text-6xl mb-6">🔍</p>
                   <p className="text-xs font-black uppercase tracking-widest text-center px-12 leading-relaxed">请先在左侧录入产品事实<br/>AI 解析后条目将即刻呈现在此</p>
                </div>
              ) : (
                items.map((it, idx) => (
                  <div key={it.id || idx} className="bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group animate-fade-in-up shadow-sm hover:border-icare-accent transition-all">
                    <div className="flex items-center gap-5">
                       <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-inner text-icare-900 font-bold">📦</div>
                       <div>
                          <p className="text-sm font-black text-icare-900 leading-none mb-2">{it.productNameCn}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">规格: {it.specs || 'N/A'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">数量: {it.quantity || '-'} {it.unit || ''}</p>
                          </div>
                       </div>
                    </div>
                    <button onClick={async () => { 
                      const next = items.filter((_, i) => i !== idx); 
                      setItems(next); 
                      if(currentRfqNo) await commitToDB(currentRfqNo, next, targetMarket, notes, images.map(img => img.id));
                    }} className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50">
               <button 
                  onClick={handleConfirmAndExport}
                  disabled={analyzing || items.length === 0}
                  className="w-full py-6 bg-icare-accent text-white rounded-[2rem] font-black shadow-xl hover:bg-sky-500 disabled:bg-slate-100 disabled:text-slate-300 transition-all uppercase tracking-[0.2em] text-lg flex items-center justify-center gap-4 active:scale-95 shadow-icare-accent/20"
               >
                  {analyzing ? (
                     <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                     <>
                        <span>确认并导出询盘清单</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth={2.5}/></svg>
                     </>
                    )}
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Safety Guard */}
      <div className="bg-icare-accent/5 p-8 rounded-[2.5rem] border border-icare-accent/20 flex items-start gap-6">
         <div className="text-4xl filter grayscale opacity-40 select-none">🛡️</div>
         <div>
            <h5 className="text-xs font-black text-icare-900 uppercase mb-2 tracking-widest">RFQ 安全采集守卫 (Security Guard)</h5>
            <p className="text-[10px] text-icare-accent font-bold leading-relaxed uppercase tracking-wider opacity-80">
               本模块严格隔离报价逻辑。当前仅允许在 `RFQ_Inquiry_DB` 中创建询盘事实。上传后 AI 会自动解析品名、规格与意向。任何包含单价的字段在此环节均为违规操作，请在“报价解析”模块处理供应商复盘。
            </p>
        </div>
      </div>
    </div>
  );
};
