import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto py-6">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} iCare Sourcing Intelligence. Powered by Gemini.
        </p>
        <div className="mt-2 flex justify-center gap-4 text-xs text-slate-400">
          <span>Profit First</span>
          <span>•</span>
          <span>Supply Chain Safety</span>
          <span>•</span>
          <span>Quality Assurance</span>
        </div>
      </div>
    </footer>
  );
};
