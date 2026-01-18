import React from 'react';

interface ReportHeaderProps {
  role?: string;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({ role = "首席采购总监" }) => {
  return (
    <header className="bg-icare-900 text-white py-6 shadow-md">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-icare-gold rounded-full flex items-center justify-center text-icare-900 font-bold text-xl">
            GCI
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">GLOBALCARE INFO TRADING</h1>
            <p className="text-xs text-icare-gold uppercase tracking-widest">Official Sourcing • GCI Intelligence</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-sm text-slate-300">
            <span>Market: <span className="text-white font-semibold">Global / MEA</span></span>
            <span className="h-4 w-px bg-slate-600"></span>
            <span>Role: <span className="text-white font-semibold">{role}</span></span>
        </div>
      </div>
    </header>
  );
};
