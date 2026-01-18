import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="w-full">
      <div className="prose prose-slate max-w-none prose-sm md:prose-base">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Heading 3 is the Card Title
            h3: ({node, ...props}) => (
              <h3 className="text-lg md:text-xl font-bold text-icare-900 mt-6 mb-3 flex items-center gap-2 border-l-4 border-icare-accent pl-3 bg-slate-50 py-2 rounded-r-lg" {...props} />
            ),
            // Lists contain the data fields
            ul: ({node, ...props}) => (
              <ul className="grid grid-cols-1 gap-2 mb-6 pl-0 list-none" {...props} />
            ),
            li: ({node, ...props}) => (
              <li className="bg-white border border-slate-100 rounded px-3 py-2 md:px-4 text-sm text-slate-700 shadow-sm flex flex-col items-start sm:flex-row sm:items-center gap-1 sm:gap-2" {...props} />
            ),
            // Strong text is usually the Label (e.g., "Location:")
            strong: ({node, ...props}) => (
              <strong className="text-icare-800 font-semibold min-w-[70px] md:min-w-[90px] inline-block" {...props} />
            ),
            // Links
            a: ({node, ...props}) => (
              <a className="text-icare-accent hover:text-icare-900 font-bold underline decoration-2 underline-offset-2 break-all cursor-pointer" target="_blank" rel="noopener noreferrer" {...props} />
            ),
            // Horizontal Rule acts as a spacer between suppliers
            hr: ({node, ...props}) => (
              <hr className="border-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent my-8" {...props} />
            ),
            p: ({node, ...props}) => (
              <p className="mb-3 text-slate-600 leading-relaxed break-words" {...props} />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};