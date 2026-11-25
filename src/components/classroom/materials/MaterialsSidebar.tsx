"use client";

import { FileText, Folder, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClassroomFolder } from "@/actions/classroom-materials";

export function MaterialsDesktopSidebar({
  folders,
  materialsCount,
  selectedFolderId,
  onSelectFolder,
  onOpenNewFolder,
  onDeleteFolder,
  isAdminOrInstructor,
}: {
  folders: ClassroomFolder[];
  materialsCount: number;
  selectedFolderId: string;
  onSelectFolder: (id: string) => void;
  onOpenNewFolder: () => void;
  onDeleteFolder: (folder: ClassroomFolder) => void;
  isAdminOrInstructor: boolean;
}) {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 border-r border-slate-200/70 bg-white/80 p-4 flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Folder className="h-4 w-4 text-brand-text" />
            Folders
          </h3>
          {isAdminOrInstructor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenNewFolder}
              className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-brand-text hover:bg-brand/10"
              title="Create New Folder"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Folder Navigation */}
        <div className="space-y-1">
          <button
            onClick={() => onSelectFolder("all")}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all",
              selectedFolderId === "all"
                ? "bg-ink text-white shadow-md shadow-slate-900/10"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <div className="flex items-center gap-2.5">
              <Folder className="h-4 w-4 text-brand-text" />
              <span>All Documents</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/10 text-current">
              {materialsCount}
            </span>
          </button>

          <button
            onClick={() => onSelectFolder("unfiled")}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all",
              selectedFolderId === "unfiled"
                ? "bg-ink text-white shadow-md shadow-slate-900/10"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-slate-400" />
              <span>Unfiled</span>
            </div>
          </button>
        </div>

        <div className="pt-2">
          <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Learning Units
          </p>
          <div className="space-y-1 overflow-y-auto max-h-[360px] pr-1">
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  className={cn(
                    "group flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer",
                    isSelected
                      ? "bg-slate-100 text-slate-900 border border-slate-200/80 shadow-xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                  onClick={() => onSelectFolder(folder.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="h-3.5 w-3.5 rounded-md shrink-0 shadow-xs"
                      style={{ backgroundColor: folder.color }}
                    />
                    <span className="truncate">{folder.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold group-hover:bg-slate-200">
                      {folder.materials_count || 0}
                    </span>
                    {isAdminOrInstructor && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFolder(folder);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded-lg transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {folders.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                No folders created yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Storage status footer */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
        <div className="flex items-center justify-between text-slate-500 font-bold">
          <span>Class Storage</span>
          <span>{materialsCount} Items</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Accessible by active students and teachers in this academy.
        </p>
      </div>
    </aside>
  );
}

export function MaterialsMobileFolderStrip({
  folders,
  materialsCount,
  selectedFolderId,
  onSelectFolder,
  onOpenNewFolder,
  isAdminOrInstructor,
}: {
  folders: ClassroomFolder[];
  materialsCount: number;
  selectedFolderId: string;
  onSelectFolder: (id: string) => void;
  onOpenNewFolder: () => void;
  isAdminOrInstructor: boolean;
}) {
  return (
    <div className="lg:hidden space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Folders &amp; Learning Units
        </span>
        {isAdminOrInstructor && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenNewFolder}
            className="h-7 px-2 rounded-lg text-xs font-bold text-brand-text hover:bg-brand/10"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Folder
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 touch-pan-x">
        <button
          onClick={() => onSelectFolder("all")}
          className={cn(
            "min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all",
            selectedFolderId === "all"
              ? "bg-ink text-white shadow-xs"
              : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50",
          )}
        >
          <Folder className="h-3.5 w-3.5 text-brand-text" />
          <span>All Documents</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10">
            {materialsCount}
          </span>
        </button>

        <button
          onClick={() => onSelectFolder("unfiled")}
          className={cn(
            "min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all",
            selectedFolderId === "unfiled"
              ? "bg-ink text-white shadow-xs"
              : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50",
          )}
        >
          <FileText className="h-3.5 w-3.5 text-slate-400" />
          <span>Unfiled</span>
        </button>

        {folders.map((folder) => {
          const isSelected = selectedFolderId === folder.id;
          return (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className={cn(
                "min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all",
                isSelected
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50",
              )}
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: folder.color }}
              />
              <span>{folder.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                {folder.materials_count || 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
