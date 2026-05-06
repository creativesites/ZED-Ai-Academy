"use client";

export function TextBlock({ content }: { content: Record<string, unknown> }) {
  const html = content.html as string;
  if (!html) return null;
  return (
    <div
      className="prose prose-slate max-w-none 
        prose-headings:font-bold prose-headings:text-[#062e39] prose-headings:tracking-tight
        prose-p:text-slate-600 prose-p:leading-relaxed prose-p:text-lg
        prose-a:text-[#fd5523] prose-a:font-bold prose-a:no-underline hover:prose-a:underline 
        prose-strong:text-[#062e39] 
        prose-code:bg-[#fff6ee] prose-code:text-[#fd5523] prose-code:rounded-lg prose-code:px-2 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-[#062e39] prose-pre:rounded-2xl prose-pre:shadow-xl
        prose-blockquote:border-l-[#fd5523] prose-blockquote:bg-[#fff6ee]/50 prose-blockquote:rounded-r-2xl prose-blockquote:py-1 prose-blockquote:px-6
        prose-li:text-slate-600 prose-li:marker:text-[#fd5523]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
