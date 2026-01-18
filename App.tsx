
import React, { useState, useRef } from 'react';
import { ReportHeader } from './components/ReportHeader';
import { Footer } from './components/Footer';
import { SourcingForm } from './components/SourcingForm';
import { RFQGenerator } from './components/RFQGenerator';
import { QuotationGenerator } from './components/QuotationGenerator';
import { HunterResults } from './components/HunterResults';
import { generateSourcingReport } from './services/geminiService';
import { AppState, SourcingResult, SourcingRequest, SessionImage, SourcingMode } from './types';

enum Tab {
  HUNTER = 'HUNTER',
  RFQ = 'RFQ',
  QUOTE = 'QUOTE'
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HUNTER);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<SourcingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<SourcingRequest | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  // Shared State: Session Gallery
  const [sessionImages, setSessionImages] = useState<SessionImage[]>([]);

  const handleSourcingRequest = async (query: string, images?: { data: string; mimeType: string }[], mode: SourcingMode = 'quick') => {
    // 1. Cancel previous if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setAppState(AppState.LOADING);
    setErrorMsg(null);
    setResult(null);
    setLastRequest({ query, images, mode });

    try {
      // Stage 1: Initial call
      const report = await generateSourcingReport(
        query, 
        images, 
        [], 
        mode, 
        abortControllerRef.current.signal
      );
      
      setResult(report);
      setAppState(AppState.SUCCESS);
      retryCountRef.current = 0; // Reset on success
    } catch (err: any) {
      if (err.message === "ABORTED") {
        setAppState(AppState.ABORTED);
        return;
      }
      
      console.error("Search Error:", err);

      if (err.message === "TIMEOUT" || err.message === "Network Error") {
        if (retryCountRef.current < 2) {
          retryCountRef.current++;
          console.warn(`Attempt ${retryCountRef.current} failed. Retrying with quick mode...`);
          handleSourcingRequest(query, images, 'quick');
          return;
        }
        setAppState(AppState.TIMEOUT);
        setErrorMsg("搜索超时：已尝试多个来源，当前未返回结果。请重试或更换关键词。");
      } else {
        setErrorMsg("搜索请求失败，请检查网络连接或更换关键词。");
        setAppState(AppState.ERROR);
      }
    }
  };

  const handleStopSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setAppState(AppState.ABORTED);
    }
  };

  const handleFileSync = (image: SessionImage | null) => {
    if (image) {
      setSessionImages(prev => {
        const exists = prev.find(p => p.data === image.data);
        if (exists) return prev;
        return [...prev, image];
      });
    }
  };

  const handleKeywordSearch = (keyword: string) => {
    handleSourcingRequest(`寻找优质源头工厂: ${keyword}`, undefined, 'quick');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <ReportHeader role="寻源猎手 (Fast Trace)" />

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex gap-4 sm:gap-6">
            <button 
              onClick={() => setActiveTab(Tab.HUNTER)}
              className={`py-4 px-2 sm:px-4 text-xs font-bold transition-all border-b-4 flex items-center gap-2 ${activeTab === Tab.HUNTER ? 'border-icare-accent text-icare-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <span>🎯</span> 供应商搜寻
            </button>
            <button 
              onClick={() => setActiveTab(Tab.RFQ)}
              className={`py-4 px-2 sm:px-4 text-xs font-bold transition-all border-b-4 flex items-center gap-2 ${activeTab === Tab.RFQ ? 'border-icare-accent text-icare-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <span>📄</span> 询盘表生成
              {sessionImages.length > 0 && (
                <span className="bg-icare-accent text-white text-[8px] px-1.5 py-0.5 rounded-full">{sessionImages.length}</span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab(Tab.QUOTE)}
              className={`py-4 px-2 sm:px-4 text-xs font-bold transition-all border-b-4 flex items-center gap-2 ${activeTab === Tab.QUOTE ? 'border-icare-accent text-icare-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <span>💰</span> 报价单解析与生成
            </button>
          </div>
        </div>
      </div>

      <main className="flex-grow container mx-auto px-4 py-8">
        
        {activeTab === Tab.HUNTER && (
          <div className="flex flex-col items-center gap-10">
            <div className="w-full">
              {!result && appState !== AppState.LOADING && (
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-extrabold text-icare-900 mb-3 tracking-tight">iCare 寻源猎手</h2>
                  <p className="text-slate-600 max-w-lg mx-auto font-medium">
                    深挖中国源头工厂，一键获取联系方式与沟通话术
                  </p>
                </div>
              )}
              <SourcingForm 
                onSubmit={handleSourcingRequest} 
                onStop={handleStopSearch}
                onFileSync={handleFileSync}
                appState={appState} 
              />
            </div>

            {appState === AppState.LOADING && (
              <div className="w-full max-w-4xl bg-white p-12 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center justify-center animate-pulse">
                <div className="w-16 h-16 border-4 border-icare-accent border-t-transparent rounded-full animate-spin mb-6"></div>
                <h3 className="text-xl font-bold text-icare-900">🚀 猎手正在全网锁定供应商...</h3>
                <p className="text-slate-500 mt-2 font-medium">检索中：正在分析数据来源并验证联系方式</p>
                <button 
                   onClick={handleStopSearch}
                   className="mt-8 text-xs font-bold text-slate-400 hover:text-red-500 underline"
                >
                  停止当前搜索并显示已找到的部分 (如有)
                </button>
              </div>
            )}

            {(appState === AppState.ERROR || appState === AppState.TIMEOUT) && (
              <div className="w-full max-w-2xl bg-white border-2 border-red-100 p-8 rounded-2xl shadow-lg flex flex-col items-center text-center gap-4 animate-fade-in-up">
                <div className="bg-red-500 text-white p-4 rounded-full shadow-lg">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-icare-900 mb-2">{appState === AppState.TIMEOUT ? '搜索超时' : '请求失败'}</h3>
                  <p className="text-slate-600 font-medium mb-6">{errorMsg || "服务暂时不可用，请稍后重试。"}</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => lastRequest && handleSourcingRequest(lastRequest.query, lastRequest.images, 'quick')}
                    className="px-8 py-3 bg-icare-900 text-white rounded-xl font-bold shadow-lg hover:bg-icare-800 transition-all active:scale-95"
                  >
                    重试 (快速模式)
                  </button>
                  <button 
                    onClick={() => { setAppState(AppState.IDLE); setResult(null); }}
                    className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                  >
                    更换关键词
                  </button>
                </div>
              </div>
            )}

            {appState === AppState.ABORTED && (
              <div className="w-full max-w-lg bg-slate-100 p-6 rounded-2xl text-center border border-slate-200">
                <p className="text-slate-600 font-bold">搜索已停止。</p>
                <button onClick={() => setAppState(AppState.IDLE)} className="mt-2 text-icare-accent text-sm font-bold hover:underline">重新开始</button>
              </div>
            )}

            {appState === AppState.SUCCESS && result?.hunterResult && (
              <HunterResults 
                initialResult={result.hunterResult} 
                sources={result.sources}
                onKeywordClick={handleKeywordSearch}
                originalRequest={lastRequest || undefined}
              />
            )}
          </div>
        )}

        {activeTab === Tab.RFQ && (
          <RFQGenerator sessionImages={sessionImages} />
        )}

        {activeTab === Tab.QUOTE && (
          <QuotationGenerator />
        )}

      </main>
      <Footer />
    </div>
  );
}
