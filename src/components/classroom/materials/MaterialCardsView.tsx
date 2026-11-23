"use client";

import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CheckCheck,
  Clock,
  Download,
  Edit,
  Eye,
  History,
  MoreVertical,
  Pin,
  PinOff,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ClassroomMaterial } from "@/actions/classroom-materials";
import { formatBytes, getTypeMeta } from "./types";

export function MaterialCardsView({
  materials,
  viewMode,
  isAdminOrInstructor,
  onPreview,
  onToggleBookmark,
  onAcknowledge,
  onOpenVersions,
  onOpenAcks,
  onEdit,
  onTogglePin,
  onDelete,
}: {
  materials: ClassroomMaterial[];
  viewMode: "grid" | "list";
  isAdminOrInstructor: boolean;
  onPreview: (item: ClassroomMaterial) => void;
  onToggleBookmark: (docId: string) => void;
  onAcknowledge: (docId: string) => void;
  onOpenVersions: (item: ClassroomMaterial) => void;
  onOpenAcks: (item: ClassroomMaterial) => void;
  onEdit: (item: ClassroomMaterial) => void;
  onTogglePin: (materialId: string) => void;
  onDelete: (materialId: string, title: string) => void;
}) {
  if (viewMode === "list") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Folder</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materials.map((item) => {
                const meta = getTypeMeta(item.material_type);
                const Icon = meta.icon;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => onPreview(item)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg border", meta.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-900 group-hover:text-[#fd5523] transition-colors">
                          {item.title}
                        </span>
                        {item.is_pinned && <Pin className="h-3 w-3 text-[#fd5523]" />}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{meta.label}</td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{item.folder?.name || "—"}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{formatBytes(item.file_size_bytes)}</td>
                    <td className="py-3 px-4 text-slate-400">{new Date(item.updated_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {item.file_url && (
                          <a
                            href={item.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#fd5523] hover:bg-slate-100"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {isAdminOrInstructor && (
                          <button
                            type="button"
                            onClick={() => onDelete(item.id, item.title)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {materials.map((item) => {
        const meta = getTypeMeta(item.material_type);
        const Icon = meta.icon;

        return (
          <div
            key={item.id}
            className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#fd5523]/30 transition-all"
          >
            <div>
              {/* Card Top: Type badge, cohort/course tags, bookmark & options */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                      meta.color,
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </span>

                  {item.cohort && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                      <Users className="h-2.5 w-2.5" />
                      {item.cohort.name}
                    </span>
                  )}

                  {item.course && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold max-w-[140px] truncate">
                      <BookOpen className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{item.course.title}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBookmark(item.id);
                    }}
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                      item.is_bookmarked
                        ? "text-[#fd5523] bg-orange-50 hover:bg-orange-100"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                    )}
                    title={item.is_bookmarked ? "Remove Bookmark" : "Save Bookmark"}
                  >
                    {item.is_bookmarked ? (
                      <BookmarkCheck className="h-4 w-4 fill-current" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </button>

                  {item.is_pinned && <Pin className="h-3.5 w-3.5 text-[#fd5523]" />}

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={(props) => (
                        <button
                          {...props}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      )}
                    />
                    <DropdownMenuContent align="end" className="w-48 text-xs">
                      <DropdownMenuItem
                        onClick={() => onOpenVersions(item)}
                        className="cursor-pointer gap-2"
                      >
                        <History className="h-3.5 w-3.5" /> Version History
                      </DropdownMenuItem>

                      {isAdminOrInstructor && item.requires_acknowledgement && (
                        <DropdownMenuItem
                          onClick={() => onOpenAcks(item)}
                          className="cursor-pointer gap-2"
                        >
                          <CheckCheck className="h-3.5 w-3.5" /> View Sign-offs
                        </DropdownMenuItem>
                      )}

                      {isAdminOrInstructor && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onEdit(item)}
                            className="cursor-pointer gap-2"
                          >
                            <Edit className="h-3.5 w-3.5" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onTogglePin(item.id)}
                            className="cursor-pointer gap-2"
                          >
                            {item.is_pinned ? (
                              <>
                                <PinOff className="h-3.5 w-3.5" /> Unpin from Top
                              </>
                            ) : (
                              <>
                                <Pin className="h-3.5 w-3.5" /> Pin to Top
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(item.id, item.title)}
                            className="cursor-pointer gap-2 text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Title */}
              <h4
                onClick={() => onPreview(item)}
                className="text-base font-black text-[#062e39] tracking-tight group-hover:text-[#fd5523] transition-colors cursor-pointer line-clamp-2"
              >
                {item.title}
              </h4>

              {/* Tag pills */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Description excerpt */}
              {item.description && (
                <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              )}

              {/* Reading Sign-off Banner if Required */}
              {item.requires_acknowledgement && (
                <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60">
                  <span className="text-[10px] font-bold text-amber-800">
                    {item.is_acknowledged ? "✓ Reading Confirmed" : "⚠️ Sign-off Required"}
                  </span>
                  {!item.is_acknowledged ? (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcknowledge(item.id);
                      }}
                      className="h-6 px-2.5 rounded-lg text-[10px] font-black bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                    >
                      Mark Read
                    </Button>
                  ) : (
                    <span className="text-[9px] font-black text-emerald-600 uppercase">Completed</span>
                  )}
                </div>
              )}
            </div>

            {/* Card Footer: Metadata & Actions */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="h-3 w-3 text-slate-400" />
                <span>{new Date(item.updated_at).toLocaleDateString()}</span>
                {item.file_size_bytes > 0 && <span>· {formatBytes(item.file_size_bytes)}</span>}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPreview(item)}
                  className="h-7 px-2.5 rounded-lg text-xs font-bold text-slate-600 hover:text-[#fd5523] hover:bg-orange-50"
                >
                  <Eye className="mr-1 h-3 w-3" />
                  Preview
                </Button>
                {item.file_url && (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={item.title}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#fd5523] hover:bg-orange-50 transition-colors"
                    title="Open or Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
