import {
  FileCode,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Link2,
  Presentation,
} from "lucide-react";
import { BRAND_COLORS } from "@/lib/brand";

export type MaterialCohort = { id: string; name: string };
export type MaterialCourse = { id: string; title: string; slug?: string };

export interface MaterialsTabProps {
  companyId: string;
  companySlug: string;
  isAdminOrInstructor: boolean;
  cohorts?: MaterialCohort[];
  courses?: MaterialCourse[];
  activeCohortId?: string | null;
}

export const FOLDER_COLORS = [
  { name: "Royal Blue", hex: BRAND_COLORS.royalBlue },
  { name: "Orange", hex: BRAND_COLORS.orange },
  { name: "Emerald", hex: "#10b981" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Slate", hex: "#475569" },
];

export const DOCUMENT_CATEGORIES = [
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

export const MATERIAL_TYPES = [
  { value: "all", label: "All Types" },
  { value: "pdf", label: "PDF Documents", icon: FileText, color: "text-red-500 bg-red-50" },
  { value: "document", label: "Docs & Text", icon: FileText, color: "text-blue-500 bg-blue-50" },
  { value: "slides", label: "Presentations", icon: Presentation, color: "text-amber-500 bg-amber-50" },
  { value: "worksheet", label: "Worksheets", icon: FileSpreadsheet, color: "text-emerald-500 bg-emerald-50" },
  { value: "code", label: "Code & Notebooks", icon: FileCode, color: "text-purple-500 bg-purple-50" },
  { value: "link", label: "External Resources", icon: Link2, color: "text-teal-500 bg-teal-50" },
  { value: "video", label: "Videos & Recordings", icon: FileVideo, color: "text-rose-500 bg-rose-50" },
];

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getTypeMeta(type: string) {
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
