"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  Folder,
  LayoutGrid,
  List,
  Loader2,
  Pin,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  acknowledgeClassDocument,
  deleteClassroomFolder,
  deleteClassroomMaterial,
  getClassroomFolders,
  getClassroomMaterials,
  getPinnedClassroomMaterials,
  toggleBookmarkDocument,
  togglePinClassroomMaterial,
  type ClassroomFolder,
  type ClassroomMaterial,
} from "@/actions/classroom-materials";
import {
  DOCUMENT_CATEGORIES,
  formatBytes,
  getTypeMeta,
  MATERIAL_TYPES,
  type MaterialsTabProps,
} from "./materials/types";
import {
  MaterialsDesktopSidebar,
  MaterialsMobileFolderStrip,
} from "./materials/MaterialsSidebar";
import { MaterialCardsView } from "./materials/MaterialCardsView";
import { MaterialUploadDialog } from "./materials/MaterialUploadDialog";
import { MaterialPreviewDialog } from "./materials/MaterialPreviewDialog";
import {
  MaterialAcknowledgementsDialog,
  MaterialFolderDialog,
  MaterialVersionHistoryDialog,
} from "./materials/MaterialHistoryDialogs";

export function MaterialsTab({
  companyId,
  companySlug,
  isAdminOrInstructor,
  cohorts = [],
  courses = [],
  activeCohortId,
}: MaterialsTabProps) {
  const [folders, setFolders] = useState<ClassroomFolder[]>([]);
  const [materials, setMaterials] = useState<ClassroomMaterial[]>([]);
  const [pinnedMaterials, setPinnedMaterials] = useState<ClassroomMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [isBookmarksOnly, setIsBookmarksOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"updated" | "title" | "created">("updated");

  // Modals
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<ClassroomMaterial | null>(null);
  const [previewMaterial, setPreviewMaterial] = useState<ClassroomMaterial | null>(null);
  const [versionModalDoc, setVersionModalDoc] = useState<ClassroomMaterial | null>(null);
  const [acksModalDoc, setAcksModalDoc] = useState<ClassroomMaterial | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [foldersData, materialsData, pinnedData] = await Promise.all([
        getClassroomFolders(companyId, activeCohortId),
        getClassroomMaterials(companyId, {
          folderId: selectedFolderId === "all" ? undefined : selectedFolderId,
          cohortId: activeCohortId,
          courseId: selectedCourseId === "all" ? undefined : selectedCourseId,
          materialType: selectedType === "all" ? undefined : selectedType,
          category: selectedCategory === "all" ? undefined : selectedCategory,
          isBookmarkedOnly: isBookmarksOnly,
          sort: sortBy,
        }),
        getPinnedClassroomMaterials(companyId, activeCohortId),
      ]);
      setFolders(foldersData);
      setMaterials(materialsData);
      setPinnedMaterials(pinnedData);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load class materials");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [
    companyId,
    activeCohortId,
    selectedFolderId,
    selectedCourseId,
    selectedType,
    selectedCategory,
    isBookmarksOnly,
    sortBy,
  ]);

  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return materials;
    const q = searchQuery.toLowerCase();
    return materials.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.tags && m.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [materials, searchQuery]);

  async function handleDeleteFolder(folder: ClassroomFolder) {
    if (!confirm(`Delete folder "${folder.name}"?`)) return;
    await deleteClassroomFolder(folder.id, companyId, companySlug);
    loadData();
  }

  async function handleTogglePin(materialId: string) {
    try {
      const res = await togglePinClassroomMaterial(materialId, companyId, companySlug);
      toast.success(res.isPinned ? "Material pinned to top!" : "Material unpinned.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle pin");
    }
  }

  async function handleDeleteMaterial(materialId: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteClassroomMaterial(materialId, companyId, companySlug);
      toast.success("Material deleted");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete material");
    }
  }

  async function handleToggleBookmark(docId: string) {
    try {
      const res = await toggleBookmarkDocument(docId, companyId, companySlug);
      setMaterials((prev) =>
        prev.map((m) => (m.id === docId ? { ...m, is_bookmarked: res.isBookmarked } : m)),
      );
      toast.success(res.isBookmarked ? "Saved to your bookmarks" : "Removed from bookmarks");
    } catch {
      toast.error("Could not update bookmark");
    }
  }

  async function handleAcknowledgeDoc(docId: string) {
    try {
      await acknowledgeClassDocument(docId, companyId, companySlug);
      setMaterials((prev) =>
        prev.map((m) => (m.id === docId ? { ...m, is_acknowledged: true } : m)),
      );
      toast.success("Document reading acknowledged!");
    } catch {
      toast.error("Could not record acknowledgement");
    }
  }

  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const activeFolderName =
    selectedFolderId === "all"
      ? "All Class Materials"
      : selectedFolderId === "unfiled"
        ? "Unfiled Documents"
        : currentFolder?.name || "Folder";

  return (
    <div className="flex flex-col lg:flex-row min-h-[640px] bg-slate-50/40">
      <MaterialsDesktopSidebar
        folders={folders}
        materialsCount={materials.length}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onOpenNewFolder={() => setIsFolderModalOpen(true)}
        onDeleteFolder={handleDeleteFolder}
        isAdminOrInstructor={isAdminOrInstructor}
      />

      <main className="flex-1 p-3 sm:p-5 lg:p-6 flex flex-col space-y-4 overflow-hidden min-w-0">
        <MaterialsMobileFolderStrip
          folders={folders}
          materialsCount={materials.length}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onOpenNewFolder={() => setIsFolderModalOpen(true)}
          isAdminOrInstructor={isAdminOrInstructor}
        />

        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#062e39] tracking-tight">
                {activeFolderName}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-black text-slate-500">
                {filteredMaterials.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Curated readings, lecture slide decks, worksheets, and course references.
            </p>
          </div>

          {isAdminOrInstructor && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                onClick={() => {
                  setEditingMaterial(null);
                  setIsUploadModalOpen(true);
                }}
                className="w-full sm:w-auto h-10 bg-[#fd5523] hover:bg-[#ef4a16] text-white rounded-xl text-xs font-semibold px-4 flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Upload Material</span>
              </Button>
            </div>
          )}
        </div>

        {/* Pinned Quick Access Shelf */}
        {pinnedMaterials.length > 0 && (
          <div className="space-y-3 p-4 rounded-3xl bg-white border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                <Pin className="h-3.5 w-3.5 text-[#fd5523]" />
                <span>Pinned Materials ({pinnedMaterials.length})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {pinnedMaterials.map((item) => {
                const meta = getTypeMeta(item.material_type);
                const Icon = meta.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => setPreviewMaterial(item)}
                    className="group relative flex items-center gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-[#fd5523]/30 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                        meta.color,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate group-hover:text-[#fd5523] transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">
                        {item.folder?.name || meta.label} · {formatBytes(item.file_size_bytes)}
                      </p>
                    </div>
                    <Pin className="h-3.5 w-3.5 text-[#fd5523] shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Toolbar: Search, Filters, and View Mode Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="relative flex-1 min-w-0 md:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search materials..."
              className="pl-10 h-9 rounded-xl border-slate-200 text-xs bg-slate-50 focus:bg-white w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v ?? "all")}>
              <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs flex-1 sm:flex-none sm:w-[132px] bg-slate-50 min-w-[110px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {courses.length > 0 && (
              <Select value={selectedCourseId} onValueChange={(v) => setSelectedCourseId(v ?? "all")}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs flex-1 sm:flex-none sm:w-[144px] bg-slate-50 min-w-[120px]">
                  <SelectValue placeholder="Course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-bold">
                    All Courses
                  </SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={sortBy} onValueChange={(v) => setSortBy((v ?? "updated") as "updated" | "title" | "created")}>
              <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs w-[124px] bg-slate-50">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated" className="text-xs">
                  Last Updated
                </SelectItem>
                <SelectItem value="title" className="text-xs">
                  Title (A-Z)
                </SelectItem>
                <SelectItem value="created" className="text-xs">
                  Newest Added
                </SelectItem>
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => setIsBookmarksOnly((prev) => !prev)}
              className={cn(
                "h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all",
                isBookmarksOnly
                  ? "bg-[#fd5523] text-white border-[#fd5523] shadow-sm shadow-[#fd5523]/30"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100",
              )}
            >
              <Bookmark className={cn("h-3.5 w-3.5", isBookmarksOnly && "fill-current")} />
              <span>Saved</span>
            </button>

            <div className="flex items-center rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === "grid" ? "bg-white text-[#fd5523] shadow-xs" : "text-slate-400 hover:text-slate-600",
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === "list" ? "bg-white text-[#fd5523] shadow-xs" : "text-slate-400 hover:text-slate-600",
                )}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 touch-pan-x">
          {DOCUMENT_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  "min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
                  isSelected
                    ? "bg-[#062e39] text-white shadow-sm"
                    : "bg-white border border-slate-200/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Materials Content */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-[#fd5523] mb-3" />
            <p className="text-xs font-bold uppercase tracking-widest">Loading Learning Materials...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8">
            <div className="h-16 w-16 rounded-2xl bg-orange-50 text-[#fd5523] flex items-center justify-center mb-4">
              <Folder className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-[#062e39]">No materials in this view</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {searchQuery
                ? `No materials matched "${searchQuery}". Try a different keyword.`
                : "Instructors can upload lecture slides, PDF worksheets, or reading lists."}
            </p>
            {isAdminOrInstructor && (
              <Button
                onClick={() => {
                  setEditingMaterial(null);
                  setIsUploadModalOpen(true);
                }}
                className="mt-5 bg-[#fd5523] hover:bg-[#ef4a16] text-white rounded-xl text-xs font-bold"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Upload First Material
              </Button>
            )}
          </div>
        ) : (
          <MaterialCardsView
            materials={filteredMaterials}
            viewMode={viewMode}
            isAdminOrInstructor={isAdminOrInstructor}
            onPreview={setPreviewMaterial}
            onToggleBookmark={handleToggleBookmark}
            onAcknowledge={handleAcknowledgeDoc}
            onOpenVersions={setVersionModalDoc}
            onOpenAcks={setAcksModalDoc}
            onEdit={(item) => {
              setEditingMaterial(item);
              setIsUploadModalOpen(true);
            }}
            onTogglePin={handleTogglePin}
            onDelete={handleDeleteMaterial}
          />
        )}
      </main>

      <MaterialFolderDialog
        open={isFolderModalOpen}
        onOpenChange={setIsFolderModalOpen}
        companyId={companyId}
        companySlug={companySlug}
        activeCohortId={activeCohortId}
        onCreated={loadData}
      />

      <MaterialUploadDialog
        open={isUploadModalOpen}
        onOpenChange={(o) => {
          setIsUploadModalOpen(o);
          if (!o) setEditingMaterial(null);
        }}
        companyId={companyId}
        companySlug={companySlug}
        editingMaterial={editingMaterial}
        folders={folders}
        cohorts={cohorts}
        courses={courses}
        defaultFolderId={selectedFolderId}
        defaultCohortId={activeCohortId || "all"}
        defaultCourseId={selectedCourseId || "all"}
        onSaved={loadData}
      />

      <MaterialPreviewDialog
        material={previewMaterial}
        onClose={() => setPreviewMaterial(null)}
      />

      <MaterialVersionHistoryDialog
        doc={versionModalDoc}
        onClose={() => setVersionModalDoc(null)}
        companyId={companyId}
        companySlug={companySlug}
        isAdminOrInstructor={isAdminOrInstructor}
        onVersionPublished={loadData}
      />

      <MaterialAcknowledgementsDialog
        doc={acksModalDoc}
        onClose={() => setAcksModalDoc(null)}
        companyId={companyId}
      />
    </div>
  );
}
