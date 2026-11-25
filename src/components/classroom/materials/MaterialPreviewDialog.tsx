"use client";

import { Download, ExternalLink, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ClassroomMaterial } from "@/actions/classroom-materials";
import { formatBytes, getTypeMeta } from "./types";

export function MaterialPreviewDialog({
  material,
  onClose,
}: {
  material: ClassroomMaterial | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!material} onOpenChange={() => onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[700px] rounded-2xl sm:rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[85dvh] flex flex-col">
        {material && (
          <div>
            <div className="p-6 bg-ink text-white flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-electric">
                  {getTypeMeta(material.material_type).label} Document
                </span>
                <h3 className="text-xl font-black text-white mt-1">{material.title}</h3>
                {material.cohort && (
                  <p className="text-xs text-white/60 mt-0.5">Cohort: {material.cohort.name}</p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto bg-white">
              {material.description && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed font-medium">
                  {material.description}
                </div>
              )}

              {material.tags && material.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {material.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {material.file_url ? (
                material.material_type === "pdf" || /\.pdf(\?|$)/i.test(material.file_url) ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden h-[360px]">
                    <iframe
                      src={material.file_url}
                      className="w-full h-full"
                      title={material.title}
                    />
                  </div>
                ) : /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(material.file_url) ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 p-2 flex items-center justify-center max-h-[360px]">
                    <img
                      src={material.file_url}
                      alt={material.title}
                      className="max-h-[340px] w-auto object-contain rounded-xl"
                    />
                  </div>
                ) : material.material_type === "video" ||
                  /\.(mp4|webm|mov)(\?|$)/i.test(material.file_url) ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-black">
                    <video src={material.file_url} controls className="w-full max-h-[360px]" />
                  </div>
                ) : /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(material.file_url) ? (
                  <div className="border border-slate-200 rounded-2xl bg-slate-50 p-4">
                    <audio src={material.file_url} controls className="w-full" />
                  </div>
                ) : (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 space-y-3">
                    <div className="h-12 w-12 rounded-2xl bg-brand/10 text-brand-text flex items-center justify-center mx-auto">
                      <Download className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">
                      {material.title}{" "}
                      {material.file_size_bytes > 0 ? `(${formatBytes(material.file_size_bytes)})` : ""}
                    </p>
                    <a
                      href={material.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ink text-white text-xs font-bold hover:bg-brand transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open or Download Resource
                    </a>
                  </div>
                )
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  No previewable file attached.
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Added on {new Date(material.created_at).toLocaleDateString()}
              </span>
              {material.file_url && (
                <a
                  href={material.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover shadow-md shadow-brand/20"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download File
                </a>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
