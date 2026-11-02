"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  Folder,
  FolderPlus,
  FileText,
  FileCode,
  FileSpreadsheet,
  Presentation,
  FileQuestion,
  FileVideo,
  Link2,
  Pin,
  PinOff,
  Download,
  ExternalLink,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  ChevronDown,
  X,
  Upload,
  Loader2,
  Share2,
  Bookmark,
  BookmarkCheck,
  History,
  CheckCheck,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getClassroomFolders,
  getClassroomMaterials,
  getPinnedClassroomMaterials,
  createClassroomFolder,
  deleteClassroomFolder,
  createClassroomMaterial,
  togglePinClassroomMaterial,
  deleteClassroomMaterial,
  toggleBookmarkDocument,
  acknowledgeClassDocument,
  getDocumentVersions,
  uploadDocumentVersion,
  getDocumentAcknowledgements,
  type ClassroomFolder,
  type ClassroomMaterial,
} from "@/actions/classroom-materials";

const FOLDER_COLORS = [
  { name: "Orange", hex: "#fd5523" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Slate", hex: "#475569" },
];

const DOCUMENT_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "lecture_notes", label: "Lecture Notes" },
  { value: "presentations", label: "Presentations" },
  { value: "worksheets", label: "Worksheets" },
  { value: "reading_materials", label: "Reading Materials" },
  { value: "reference_materials", label: "Reference Materials" },
  { value: "policies", label: "Policies & Guidelines" },
  { value: "templates", label: "Templates" },
  { value: "other_resources", label: "Other Resources" },
];

const MATERIAL_TYPES = [
  { value: "all", label: "All Types" },
  { value: "pdf", label: "PDF Documents", icon: FileText, color: "text-red-500 bg-red-50" },
  { value: "document", label: "Docs & Text", icon: FileText, color: "text-blue-500 bg-blue-50" },
  { value: "slides", label: "Presentations", icon: Presentation, color: "text-amber-500 bg-amber-50" },
  { value: "worksheet", label: "Worksheets", icon: FileSpreadsheet, color: "text-emerald-500 bg-emerald-50" },
  { value: "code", label: "Code & Notebooks", icon: FileCode, color: "text-purple-500 bg-purple-50" },
  { value: "link", label: "External Resources", icon: Link2, color: "text-teal-500 bg-teal-50" },
  { value: "video", label: "Videos & Recordings", icon: FileVideo, color: "text-rose-500 bg-rose-50" },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getTypeMeta(type: string) {
  switch (type) {
    case "pdf":
      return { icon: FileText, color: "text-red-600 bg-red-50 border-red-200", label: "PDF" };
    case "slides":
      return { icon: Presentation, color: "text-amber-600 bg-amber-50 border-amber-200", label: "Slides" };
    case "worksheet":
      return { icon: FileSpreadsheet, color: "text-emerald-600 bg-emerald-50 border-emerald-200", label: "Worksheet" };
    case "code":
      return { icon: FileCode, color: "text-purple-600 bg-purple-50 border-purple-200", label: "Code" };
    case "link":
      return { icon: Link2, color: "text-teal-600 bg-teal-50 border-teal-200", label: "Link" };
    case "video":
      return { icon: FileVideo, color: "text-rose-600 bg-rose-50 border-rose-200", label: "Video" };
    default:
      return { icon: FileText, color: "text-blue-600 bg-blue-50 border-blue-200", label: "Document" };
  }
}

export function MaterialsTab({
  companyId,
  companySlug,
  isAdminOrInstructor,
  cohorts = [],
  activeCohortId,
}: {
  companyId: string;
  companySlug: string;
  isAdminOrInstructor: boolean;
  cohorts?: Array<{ id: string; name: string }>;
  activeCohortId?: string | null;
}) {
  const [folders, setFolders] = useState<ClassroomFolder[]>([]);
  const [materials, setMaterials] = useState<ClassroomMaterial[]>([]);
  const [pinnedMaterials, setPinnedMaterials] = useState<ClassroomMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isBookmarksOnly, setIsBookmarksOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"updated" | "title" | "created">("updated");

  // Modals
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<ClassroomMaterial | null>(null);

  // Version History Modal
  const [versionModalDoc, setVersionModalDoc] = useState<ClassroomMaterial | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionChangeNote, setVersionChangeNote] = useState("");
  const [isUploadingVersion, startUploadVersion] = useTransition();

  // Acknowledgements Modal
  const [acksModalDoc, setAcksModalDoc] = useState<ClassroomMaterial | null>(null);
  const [acknowledgements, setAcknowledgements] = useState<any[]>([]);
  const [isLoadingAcks, setIsLoadingAcks] = useState(false);

  // New Folder Form State
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("#fd5523");
  const [isCreatingFolder, startCreateFolder] = useTransition();

  // New Material Form State
  const [isUploading, startUpload] = useTransition();
  const [materialSourceType, setMaterialSourceType] = useState<"file" | "link">("file");

  // Load Data
  async function loadData() {
    setLoading(true);
    try {
      const [foldersData, materialsData, pinnedData] = await Promise.all([
        getClassroomFolders(companyId, activeCohortId),
        getClassroomMaterials(companyId, {
          folderId: selectedFolderId === "all" ? undefined : selectedFolderId,
          cohortId: activeCohortId,
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
  }, [companyId, activeCohortId, selectedFolderId, selectedType, selectedCategory, isBookmarksOnly, sortBy]);

  // Client-side search filtering
  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return materials;
    const q = searchQuery.toLowerCase();
    return materials.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, [materials, searchQuery]);

  // Handle Folder Creation
  function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) return;

    startCreateFolder(async () => {
      try {
        const formData = new FormData();
        formData.append("companyId", companyId);
        formData.append("companySlug", companySlug);
        formData.append("name", folderName);
        formData.append("color", folderColor);
        if (activeCohortId) formData.append("cohortId", activeCohortId);

        await createClassroomFolder(formData);
        toast.success(`Folder "${folderName}" created!`);
        setFolderName("");
        setIsFolderModalOpen(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to create folder");
      }
    });
  }

  // Handle Material Upload
  function handleUploadMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("companyId", companyId);
    formData.append("companySlug", companySlug);
    if (activeCohortId) formData.append("cohortId", activeCohortId);

    startUpload(async () => {
      try {
        await createClassroomMaterial(formData);
        toast.success("Learning material added successfully!");
        setIsUploadModalOpen(false);
        form.reset();
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to upload material");
      }
    });
  }

  // Toggle Pin
  async function handleTogglePin(materialId: string) {
    try {
      const res = await togglePinClassroomMaterial(materialId, companyId, companySlug);
      toast.success(res.isPinned ? "Material pinned to top!" : "Material unpinned.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle pin");
    }
  }

  // Delete Material
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

  // Toggle Bookmark
  async function handleToggleBookmark(docId: string) {
    try {
      const res = await toggleBookmarkDocument(docId, companyId, companySlug);
      setMaterials((prev) =>
        prev.map((m) => (m.id === docId ? { ...m, is_bookmarked: res.isBookmarked } : m))
      );
      toast.success(res.isBookmarked ? "Saved to your bookmarks" : "Removed from bookmarks");
    } catch (err: any) {
      toast.error("Could not update bookmark");
    }
  }

  // Acknowledge Document
  async function handleAcknowledgeDoc(docId: string) {
    try {
      await acknowledgeClassDocument(docId, companyId, companySlug);
      setMaterials((prev) =>
        prev.map((m) => (m.id === docId ? { ...m, is_acknowledged: true } : m))
      );
      toast.success("Document reading acknowledged!");
    } catch (err: any) {
      toast.error("Could not record acknowledgement");
    }
  }

  // Open Version History
  async function handleOpenVersionHistory(doc: ClassroomMaterial) {
    setVersionModalDoc(doc);
    setIsLoadingVersions(true);
    try {
      const vList = await getDocumentVersions(doc.id, companyId);
      setVersions(vList);
    } catch (err) {
      toast.error("Failed to load version history");
    } finally {
      setIsLoadingVersions(false);
    }
  }

  // Open Acknowledgements List (Instructor)
  async function handleOpenAcks(doc: ClassroomMaterial) {
    setAcksModalDoc(doc);
    setIsLoadingAcks(true);
    try {
      const ackList = await getDocumentAcknowledgements(doc.id, companyId);
      setAcknowledgements(ackList);
    } catch (err) {
      toast.error("Failed to load student acknowledgements");
    } finally {
      setIsLoadingAcks(false);
    }
  }

  // Handle Version Upload
  function handleUploadVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!versionModalDoc || !versionFile) return;

    startUploadVersion(async () => {
      try {
        const fd = new FormData();
        fd.append("companyId", companyId);
        fd.append("companySlug", companySlug);
        fd.append("documentId", versionModalDoc.id);
        fd.append("file", versionFile);
        if (versionChangeNote) fd.append("changeNote", versionChangeNote);

        await uploadDocumentVersion(fd);
        toast.success("New document version uploaded!");
        setVersionFile(null);
        setVersionChangeNote("");
        const updated = await getDocumentVersions(versionModalDoc.id, companyId);
        setVersions(updated);
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to upload new version");
      }
    });
  }

  // Active Folder Name
  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const activeFolderName =
    selectedFolderId === "all"
      ? "All Class Materials"
      : selectedFolderId === "unfiled"
      ? "Unfiled Documents"
      : currentFolder?.name || "Folder";

  return (
    <div className="flex flex-col lg:flex-row min-h-[750px] bg-slate-50/50">
      {/* ── Left Sidebar: Folders List (Matching Image 3) ────────────────── */}
      <aside className="w-full lg:w-72 shrink-0 border-r border-slate-200/70 bg-white p-5 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Folder className="h-5 w-5 text-[#fd5523]" />
              Folders
            </h3>
            {isAdminOrInstructor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFolderModalOpen(true)}
                className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-[#fd5523] hover:bg-[#fd5523]/10"
                title="Create New Folder"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Folder Navigation */}
          <div className="space-y-1">
            <button
              onClick={() => setSelectedFolderId("all")}
              className={cn(
                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all",
                selectedFolderId === "all"
                  ? "bg-[#062e39] text-white shadow-md shadow-slate-900/10"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Folder className="h-4 w-4 text-[#fd5523]" />
                <span>All Documents</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/10 text-current">
                {materials.length}
              </span>
            </button>

            <button
              onClick={() => setSelectedFolderId("unfiled")}
              className={cn(
                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all",
                selectedFolderId === "unfiled"
                  ? "bg-[#062e39] text-white shadow-md shadow-slate-900/10"
                  : "text-slate-600 hover:bg-slate-100"
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
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                    onClick={() => setSelectedFolderId(folder.id)}
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
                            if (confirm(`Delete folder "${folder.name}"?`)) {
                              deleteClassroomFolder(folder.id, companyId, companySlug);
                              loadData();
                            }
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
            <span>{materials.length} Items</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Accessible by active students and teachers in this academy.
          </p>
        </div>
      </aside>

      {/* ── Main Area: Documents & Materials Explorer ──────────────────────── */}
      <main className="flex-1 p-5 sm:p-8 flex flex-col space-y-6 overflow-hidden">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-[#062e39] tracking-tight">
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
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                className="bg-[#fd5523] hover:bg-[#ef4a16] text-white rounded-xl text-xs font-bold px-4 py-2.5 flex items-center gap-2 shadow-lg shadow-[#fd5523]/20"
              >
                <Plus className="h-4 w-4" />
                Upload Material
              </Button>
            </div>
          )}
        </div>

        {/* ── Pinned Quick Access Shelf (Matching Image 3) ────────────────── */}
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
                        meta.color
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

        {/* ── Toolbar: Search, Filters, and View Mode Toggle ────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 rounded-2xl bg-white border border-slate-100 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search materials by title, description or tag..."
              className="pl-10 h-10 rounded-xl border-slate-200 text-xs bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v ?? "all")}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs w-[140px] bg-slate-50">
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

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v ?? "updated")}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs w-[130px] bg-slate-50">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated" className="text-xs">Last Updated</SelectItem>
                <SelectItem value="title" className="text-xs">Title (A-Z)</SelectItem>
                <SelectItem value="created" className="text-xs">Newest Added</SelectItem>
              </SelectContent>
            </Select>

            {/* Bookmarks Toggle */}
            <button
              type="button"
              onClick={() => setIsBookmarksOnly((prev) => !prev)}
              className={cn(
                "h-10 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all",
                isBookmarksOnly
                  ? "bg-[#fd5523] text-white border-[#fd5523] shadow-sm shadow-[#fd5523]/30"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              )}
            >
              <Bookmark className={cn("h-3.5 w-3.5", isBookmarksOnly && "fill-current")} />
              <span>Saved</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === "grid" ? "bg-white text-[#fd5523] shadow-xs" : "text-slate-400 hover:text-slate-600"
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
                  viewMode === "list" ? "bg-white text-[#fd5523] shadow-xs" : "text-slate-400 hover:text-slate-600"
                )}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Category Pills Strip ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {DOCUMENT_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                  isSelected
                    ? "bg-[#062e39] text-white shadow-sm"
                    : "bg-white border border-slate-200/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* ── Materials List / Grid View ────────────────────────────────────── */}
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
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-5 bg-[#fd5523] hover:bg-[#ef4a16] text-white rounded-xl text-xs font-bold"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Upload First Material
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View (Faithful to Image 3) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMaterials.map((item) => {
              const meta = getTypeMeta(item.material_type);
              const Icon = meta.icon;

              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between p-5 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#fd5523]/30 transition-all"
                >
                  <div>
                    {/* Card Top: Type badge, cohort tag, and options */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                            meta.color
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
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Bookmark Toggle Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBookmark(item.id);
                          }}
                          className={cn(
                            "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                            item.is_bookmarked
                              ? "text-[#fd5523] bg-orange-50 hover:bg-orange-100"
                              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          )}
                          title={item.is_bookmarked ? "Remove Bookmark" : "Save Bookmark"}
                        >
                          {item.is_bookmarked ? (
                            <BookmarkCheck className="h-4 w-4 fill-current" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </button>

                        {item.is_pinned && (
                          <Pin className="h-3.5 w-3.5 text-[#fd5523]" />
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger render={(props) => (
                            <button
                              {...props}
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          )} />
                          <DropdownMenuContent align="end" className="w-48 text-xs">
                            <DropdownMenuItem
                              onClick={() => handleOpenVersionHistory(item)}
                              className="cursor-pointer gap-2"
                            >
                              <History className="h-3.5 w-3.5" /> Version History
                            </DropdownMenuItem>

                            {isAdminOrInstructor && item.requires_acknowledgement && (
                              <DropdownMenuItem
                                onClick={() => handleOpenAcks(item)}
                                className="cursor-pointer gap-2"
                              >
                                <CheckCheck className="h-3.5 w-3.5" /> View Sign-offs
                              </DropdownMenuItem>
                            )}

                            {isAdminOrInstructor && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleTogglePin(item.id)}
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
                                  onClick={() => handleDeleteMaterial(item.id, item.title)}
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
                      onClick={() => setPreviewMaterial(item)}
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
                              handleAcknowledgeDoc(item.id);
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
                      {item.file_size_bytes > 0 && (
                        <span>· {formatBytes(item.file_size_bytes)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewMaterial(item)}
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
        ) : (
          /* List View Table */
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
                  {filteredMaterials.map((item) => {
                    const meta = getTypeMeta(item.material_type);
                    const Icon = meta.icon;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        onClick={() => setPreviewMaterial(item)}
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
                                onClick={() => handleDeleteMaterial(item.id, item.title)}
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
        )}
      </main>

      {/* ── Dialog: Create New Folder ──────────────────────────────────────── */}
      <Dialog open={isFolderModalOpen} onOpenChange={setIsFolderModalOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#062e39]">
              Create New Folder
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Folder Name
              </label>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Lecture Slides, Lab Handouts"
                required
                className="h-11 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Folder Color
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setFolderColor(c.hex)}
                    className={cn(
                      "h-8 w-8 rounded-xl transition-all flex items-center justify-center",
                      folderColor === c.hex ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "opacity-80 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="submit"
                disabled={isCreatingFolder || !folderName.trim()}
                className="w-full bg-[#fd5523] hover:bg-[#ef4a16] text-white font-bold rounded-xl h-12"
              >
                {isCreatingFolder ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save Folder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Upload Learning Material ──────────────────────────────── */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#062e39]">
              Upload Learning Material
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadMaterial} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Material Title
              </label>
              <Input
                name="title"
                placeholder="e.g. Chapter 4 Lecture Slides (PDF)"
                required
                className="h-11 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Material Type
                </label>
                <Select name="materialType" defaultValue="pdf">
                  <SelectTrigger className="h-11 rounded-xl text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf" className="text-xs">PDF Document</SelectItem>
                    <SelectItem value="document" className="text-xs">Word / Doc</SelectItem>
                    <SelectItem value="slides" className="text-xs">Slides & Presentation</SelectItem>
                    <SelectItem value="worksheet" className="text-xs">Worksheet / Exercise</SelectItem>
                    <SelectItem value="code" className="text-xs">Code / Notebook</SelectItem>
                    <SelectItem value="link" className="text-xs">External Resource URL</SelectItem>
                    <SelectItem value="video" className="text-xs">Video / Recording</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Category
                </label>
                <Select name="category" defaultValue="lecture_notes">
                  <SelectTrigger className="h-11 rounded-xl text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.filter((c) => c.value !== "all").map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="text-xs">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Folder
              </label>
              <Select name="folderId" defaultValue={selectedFolderId !== "all" ? selectedFolderId : "unfiled"}>
                <SelectTrigger className="h-11 rounded-xl text-xs">
                  <SelectValue placeholder="Folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unfiled" className="text-xs">Unfiled</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cohorts.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Target Cohort / Class Section
                </label>
                <Select name="cohortId" defaultValue={activeCohortId || "all"}>
                  <SelectTrigger className="h-11 rounded-xl text-xs">
                    <SelectValue placeholder="Target Cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Cohorts in Academy</SelectItem>
                    {cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Source Type Toggle */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Resource Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMaterialSourceType("file")}
                  className={cn(
                    "p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5",
                    materialSourceType === "file"
                      ? "bg-[#fd5523]/10 border-[#fd5523] text-[#fd5523]"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setMaterialSourceType("link")}
                  className={cn(
                    "p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5",
                    materialSourceType === "link"
                      ? "bg-[#fd5523]/10 border-[#fd5523] text-[#fd5523]"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  )}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Web / Cloud Link
                </button>
              </div>
            </div>

            {materialSourceType === "file" ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  File Upload (Up to 50 MB)
                </label>
                <Input
                  name="file"
                  type="file"
                  className="rounded-xl border-slate-200 text-xs h-11 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#fd5523]/10 file:text-[#fd5523]"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  External Resource URL
                </label>
                <Input
                  name="externalUrl"
                  type="url"
                  placeholder="https://drive.google.com/... or https://github.com/..."
                  className="h-11 rounded-xl text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Tags (Comma separated)
              </label>
              <Input
                name="tags"
                placeholder="e.g. Week 1, Lecture, Core Reading"
                className="h-11 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Description / Learning Notes
              </label>
              <Textarea
                name="description"
                placeholder="Brief summary or reading instructions for students..."
                className="rounded-xl text-xs resize-none h-20"
              />
            </div>

            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <input type="checkbox" name="requiresAcknowledgement" value="true" id="reqAckCheck" className="rounded" />
                <label htmlFor="reqAckCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Require student reading sign-off / acknowledgement
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" name="isPinned" value="true" id="isPinnedCheck" className="rounded" />
                <label htmlFor="isPinnedCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Pin to top of materials shelf
                </label>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="submit"
                disabled={isUploading}
                className="w-full bg-[#fd5523] hover:bg-[#ef4a16] text-white font-bold rounded-xl h-12 shadow-lg shadow-[#fd5523]/20"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save &amp; Publish Material
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Document Preview Modal ─────────────────────────────────── */}
      <Dialog open={!!previewMaterial} onOpenChange={() => setPreviewMaterial(null)}>
        <DialogContent className="sm:max-w-[700px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          {previewMaterial && (
            <div>
              <div className="p-6 bg-[#062e39] text-white flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#fd8d69]">
                    {getTypeMeta(previewMaterial.material_type).label} Document
                  </span>
                  <h3 className="text-xl font-black text-white mt-1">
                    {previewMaterial.title}
                  </h3>
                  {previewMaterial.cohort && (
                    <p className="text-xs text-white/60 mt-0.5">
                      Cohort: {previewMaterial.cohort.name}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setPreviewMaterial(null)}
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto bg-white">
                {previewMaterial.description && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed font-medium">
                    {previewMaterial.description}
                  </div>
                )}

                {previewMaterial.tags && previewMaterial.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {previewMaterial.tags.map((t) => (
                      <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* PDF Viewer or Preview Frame if applicable */}
                {previewMaterial.file_url ? (
                  previewMaterial.material_type === "pdf" ? (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden h-[340px]">
                      <iframe
                        src={previewMaterial.file_url}
                        className="w-full h-full"
                        title={previewMaterial.title}
                      />
                    </div>
                  ) : (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 space-y-3">
                      <div className="h-12 w-12 rounded-2xl bg-[#fd5523]/10 text-[#fd5523] flex items-center justify-center mx-auto">
                        <Download className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        {previewMaterial.title} ({formatBytes(previewMaterial.file_size_bytes)})
                      </p>
                      <a
                        href={previewMaterial.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#062e39] text-white text-xs font-bold hover:bg-[#fd5523] transition-colors"
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
                  Added on {new Date(previewMaterial.created_at).toLocaleDateString()}
                </span>
                {previewMaterial.file_url && (
                  <a
                    href={previewMaterial.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#fd5523] text-white text-xs font-bold hover:bg-[#ef4a16] shadow-md shadow-[#fd5523]/20"
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

      {/* ── Dialog: Document Version History ─────────────────────────────────── */}
      <Dialog open={!!versionModalDoc} onOpenChange={() => setVersionModalDoc(null)}>
        <DialogContent className="sm:max-w-[620px] rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#062e39] flex items-center gap-2">
              <History className="h-5 w-5 text-[#fd5523]" />
              Version History
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-1">
              {versionModalDoc?.title}
            </p>
          </DialogHeader>

          {/* Instructor: Upload New Version Form */}
          {isAdminOrInstructor && (
            <form onSubmit={handleUploadVersion} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Publish New Version
                </span>
                <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border">
                  Next: v{(versions[0]?.version_number || 1) + 1}
                </span>
              </div>
              <div className="space-y-1">
                <Input
                  type="file"
                  required
                  onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                  className="rounded-xl border-slate-200 text-xs h-10 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-[#fd5523]/10 file:text-[#fd5523]"
                />
              </div>
              <div className="space-y-1">
                <Input
                  type="text"
                  placeholder="Change note (e.g. Added Chapter 5 exercises, fixed typos)..."
                  value={versionChangeNote}
                  onChange={(e) => setVersionChangeNote(e.target.value)}
                  className="h-9 rounded-xl text-xs bg-white"
                />
              </div>
              <Button
                type="submit"
                disabled={isUploadingVersion || !versionFile}
                className="w-full bg-[#fd5523] hover:bg-[#e0481d] text-white text-xs font-bold rounded-xl h-10 shadow-md shadow-[#fd5523]/20"
              >
                {isUploadingVersion ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                Upload &amp; Replace Active Version
              </Button>
            </form>
          )}

          {/* Versions List */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Revision Log ({versions.length})
            </h4>

            {isLoadingVersions ? (
              <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                <Loader2 className="h-4 w-4 animate-spin text-[#fd5523]" /> Loading versions...
              </div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                No past revisions logged for this resource yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white">
                {versions.map((ver, idx) => (
                  <div key={ver.id || ver.version_number} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                          idx === 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        )}>
                          v{ver.version_number} {idx === 0 && "(Active)"}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {ver.file_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {ver.change_note || "No change note provided."}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(ver.created_at).toLocaleString()} {ver.file_size_bytes > 0 && `· ${formatBytes(ver.file_size_bytes)}`}
                      </p>
                    </div>
                    {ver.file_url && (
                      <a
                        href={ver.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-[#fd5523] hover:text-white text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Student Reading Acknowledgements (Instructor) ───────────── */}
      <Dialog open={!!acksModalDoc} onOpenChange={() => setAcksModalDoc(null)}>
        <DialogContent className="sm:max-w-[540px] rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#062e39] flex items-center gap-2">
              <CheckCheck className="h-5 w-5 text-emerald-600" />
              Document Acknowledgements
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-1">
              Students who confirmed reading &quot;{acksModalDoc?.title}&quot;
            </p>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {isLoadingAcks ? (
              <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                <Loader2 className="h-4 w-4 animate-spin text-[#fd5523]" /> Loading sign-offs...
              </div>
            ) : acknowledgements.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50">
                No students have acknowledged reading this document yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white">
                {acknowledgements.map((ack) => (
                  <div key={ack.acknowledged_at} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {ack.student?.full_name?.charAt(0) || "S"}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {ack.student?.full_name || ack.student?.email || "Student"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {ack.student?.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {new Date(ack.acknowledged_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
