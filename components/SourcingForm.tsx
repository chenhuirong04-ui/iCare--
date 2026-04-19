
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, SessionImage, SourcingMode } from '../types';

interface SourcingFormProps {
  onSubmit: (query: string, images?: { data: string; mimeType: string }[], mode?: SourcingMode) => void;
  onStop?: () => void;
  onFileSync?: (image: SessionImage | null) => void;
  appState: AppState;
}

interface HunterImage {
  id: string;
  url: string;
  data: string;
  mimeType: string;
}

export const SourcingForm: React.FC<SourcingFormProps> = ({ onSubmit, onStop, onFileSync, appState }) => {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<HunterImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<SourcingMode>('quick');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<HunterImage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const base64 = dataUrl.split(',')[1];
          const url = URL.createObjectURL(file);
          
          const hunterImg = {
            id: Math.random().toString(36).substr(2, 9),
            url,
            data: base64,
            mimeType: 'image/jpeg'
          };

          if (onFileSync) {
            onFileSync({
              ...hunterImg,
              sourceModule: 'HUNTER'
            });
          }
          
          resolve(hunterImg);
        };
      };
    });
  };

  const processFiles = async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    if (images.length + imageFiles.length > 10) {
      alert("最多上传 10 张产品图。");
      return;
    }

    try {
      const newImages = await Promise.all(imageFiles.map(compressImage));
      setImages(prev => [...prev, ...newImages]);
    } catch (err) {
      console.error("图片处理失败:", err);
      alert("图片处理失败，请重试。");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    processFiles(droppedFiles);
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      processFiles(files);
    }
  }, [images, onFileSync]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleRemoveImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() || images.length > 0) {
      onSubmit(query, images.map(img => ({ data: img.data, mimeType: img.mimeType })), mode);
    }
  };

  const isLoading = appState === AppState.LOADING;

  return (
    <div className="w-full max-w-3xl mx-auto bg-white p-4 md:p-6 rounded-xl shadow-lg border border-slate-200 animate-fade-in-up">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base md:text-lg font-bold text-icare-900">寻源猎手：反向定位制造工厂</h2>
        <div className="flex items-center gap-2">
           <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 scale-90">
             <button 
               type="button"
               onClick={() => setMode('quick')}
               className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${mode === 'quick' ? 'bg-white shadow-sm text-icare-accent' : 'text-slate-500'}`}
             >
               快速
             </button>
             <button 
               type="button"
               onClick={() => setMode('deep')}
               className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${mode === 'deep' ? 'bg-white shadow-sm text-icare-accent' : 'text-slate-500'}`}
             >
               深度
             </button>
          </div>
          <span className="text-[10px] md:text-xs bg-icare-gold text-icare-900 px-2 py-1 rounded font-bold uppercase tracking-wider">Visual & Keyword Trace</span>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-shrink-0 w-full md:w-auto">
                <input 
                    type="file" 
                    multiple
                    ref={fileInputRef}
                    accept="image/*" 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    id="file-upload"
                />
                <div 
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !isLoading && fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center w-full md:w-32 h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${isDragging ? 'bg-icare-accent/10 border-icare-accent scale-[1.02]' : 'border-slate-300 hover:border-icare-accent hover:bg-slate-50'}`}
                >
                    {images.length > 0 ? (
                        <div className="relative w-full h-full p-2 flex items-center justify-center pointer-events-none">
                            <img 
                                src={images[images.length - 1].url} 
                                alt="Preview" 
                                className="w-full h-full object-contain rounded-lg shadow-sm" 
                            />
                            <div className="absolute bottom-1 right-1 bg-icare-accent text-white text-[9px] px-1.5 py-0.5 rounded font-black shadow-sm uppercase">
                                对标图 x{images.length}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 p-2 text-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 transition-colors ${isDragging ? 'text-icare-accent' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">对标图品搜索<br/>(1688 模式)</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-grow">
                 <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isLoading}
                    placeholder="请输入采购需求或产品关键词。上传图片可执行视觉对标，更精准锁定制造工厂。"
                    rows={5}
                    className="w-full px-4 py-3 text-gray-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-icare-accent focus:border-transparent transition-all disabled:opacity-60 resize-none text-sm leading-relaxed h-32"
                />
            </div>
        </div>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 animate-fade-in-up">
            {images.map(img => (
              <div key={img.id} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 group shadow-sm">
                <img src={img.url} className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => handleRemoveImage(img.id)}
                  className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          {isLoading ? (
             <button
              type="button"
              onClick={onStop}
              className="flex-shrink-0 bg-red-500 text-white px-6 py-4 rounded-xl font-bold text-sm shadow hover:bg-red-600 transition-all active:scale-95"
            >
              停止
            </button>
          ) : null}
          
          <button
              type="submit"
              disabled={isLoading || (!query.trim() && images.length === 0)}
              className="flex-grow bg-icare-900 text-white py-4 rounded-xl hover:bg-icare-800 disabled:bg-slate-300 transition-all flex items-center justify-center font-bold text-base shadow-lg hover:shadow-xl active:scale-95 transform gap-2"
          >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>正在执行多路检索...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <span>开始找货源</span>
                </>
              )}
          </button>
        </div>
      </form>
    </div>
  );
};
