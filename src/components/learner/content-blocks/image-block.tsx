"use client";

export function ImageBlock({ content }: { content: Record<string, unknown> }) {
  const url = content.url as string;
  const caption = content.caption as string | undefined;
  const alt = (content.alt as string) || caption || "Course image";
  const full = content.display === "full";
  
  if (!url) return null;
  
  return (
    <figure className={`space-y-4 ${full ? "" : "mx-auto max-w-3xl"}`}>
      <div className="overflow-hidden rounded-[2.5rem] shadow-xl border border-slate-100 ring-4 ring-slate-50/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="w-full object-contain" />
      </div>
      {caption && <figcaption className="text-center text-sm font-medium text-slate-400 italic">{caption}</figcaption>}
    </figure>
  );
}
