'use client';

/**
 * DragDropModuleBuilder
 * Main component for building training modules with drag-and-drop
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Clock,
  CheckCircle,
  FileText,
  Layout,
  Edit2,
  Play,
  Save,
  Loader2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

import type {
  Section,
  ComponentInstance,
  ComponentType,
  ModuleBuilderProps,
  ModuleBuilderOutput,
  ComponentData,
  AIGenerationContext,
} from './types';
import { COMPONENT_TEMPLATES, CATEGORY_INFO, TEMPLATE_CATEGORIES, getTemplateByType } from './templates';
import { renderMobilePreview } from './MobilePreviewComponents';
import { EditModal } from './EditModal';

// ============================================
// Sortable Component Item
// ============================================

function SortableComponentItem({
  component,
  onRemove,
  onEdit,
  onToggle,
}: {
  component: ComponentInstance;
  onRemove: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const template = getTemplateByType(component.type);
  const Icon = template?.icon || FileText;
  const color = template?.color || '#6B7280';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-3 hover:border-gray-300 transition-all shadow-sm group"
    >
      <div className="flex items-center gap-3 p-4 bg-gray-50/50">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 flex-1">
          <div
            className="p-2.5 rounded-xl shadow-sm"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">{template?.name}</p>
            <p className="text-xs text-gray-500 font-medium">{template?.category}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            {component.expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-2 hover:bg-red-50 rounded-lg text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {component.expanded && (
        <div className="p-4 border-t border-gray-100 bg-white">
          {renderMobilePreview(component)}
        </div>
      )}
    </div>
  );
}

// ============================================
// Mobile Preview Container
// ============================================

function MobilePreviewContainer({
  children,
  title = 'Module Preview',
  currentSectionIndex,
  sections,
  onNext,
  onPrev,
  onJumpTo,
}: {
  children: React.ReactNode;
  title?: string;
  currentSectionIndex: number;
  sections: Section[];
  onNext: () => void;
  onPrev: () => void;
  onJumpTo: (index: number) => void;
}) {
  const currentSection = sections[currentSectionIndex];
  const progress = ((currentSectionIndex + 1) / sections.length) * 100;
  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === sections.length - 1;

  return (
    <div className="w-[375px] h-[780px] bg-slate-50 rounded-[40px] border-[8px] border-slate-900 overflow-hidden relative shadow-2xl mx-auto flex flex-col font-sans transition-all duration-300">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[50px] -right-[50px] w-[200px] h-[200px] rounded-full bg-indigo-500/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-[30px] -left-[30px] w-[150px] h-[150px] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <div className="pt-12 pb-4 px-5 bg-white border-b border-gray-100 z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center flex-1 overflow-hidden">
            <button className="mr-3 p-2 rounded-xl bg-gray-100/50 hover:bg-gray-100 flex-shrink-0">
              <ChevronLeft size={20} className="text-gray-900" />
            </button>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 text-base leading-tight truncate">
                {title}
              </h4>
              <div className="flex items-center gap-1 mt-1">
                <Clock size={12} className="text-gray-500" />
                <span className="text-[10px] text-gray-500">~25 min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden relative">
            <div
              className="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] font-semibold text-gray-500">
              {currentSectionIndex + 1}/{sections.length}
            </span>
            <span className="text-[10px] font-bold text-indigo-600">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Section Nav Bubbles */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
          {sections.map((_, i) => (
            <button
              key={i}
              onClick={() => onJumpTo(i)}
              className={`
                flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all flex-shrink-0
                ${
                  i === currentSectionIndex
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                    : i < currentSectionIndex
                    ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                    : 'bg-transparent border-gray-100 text-gray-300'
                }
              `}
            >
              <span className="text-xs font-bold">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Scroll View */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-5 space-y-4">
        {/* Section Header Card */}
        <div className="flex items-center p-4 rounded-2xl bg-white border border-gray-100 shadow-sm mb-2">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mr-3">
            <BookOpen size={20} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">
              {currentSection?.title || 'Section'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Section {currentSectionIndex + 1}
            </p>
          </div>
        </div>

        {/* Dynamic Components */}
        <div>{children}</div>
      </div>

      {/* Footer */}
      <div className="p-5 bg-white border-t border-gray-100 pb-8 flex gap-3 z-10">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className={`flex items-center justify-center w-12 h-12 rounded-xl border border-gray-200 bg-gray-50 transition-colors flex-shrink-0
            ${isFirst ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'}
          `}
        >
          <ChevronLeft size={20} className="text-indigo-600" />
        </button>

        <button
          onClick={onNext}
          className={`flex-1 flex items-center justify-center px-5 h-12 rounded-xl shadow-lg transition-all
            ${
              isLast
                ? 'bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600'
                : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'
            }
          `}
        >
          <span className="mr-2 font-bold text-white text-sm">
            {isLast ? 'Complete Module' : 'Next Section'}
          </span>
          {isLast ? (
            <CheckCircle size={18} className="text-white" />
          ) : (
            <ChevronRight size={18} className="text-white" />
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================
// Main Builder Component
// ============================================

export default function DragDropModuleBuilder({
  moduleId,
  moduleTitle = '',
  moduleDescription = '',
  initialSections,
  onSave,
  onCancel,
}: ModuleBuilderProps) {
  const [sections, setSections] = useState<Section[]>(
    initialSections || [{ id: 'section-1', title: 'Introduction', components: [] }]
  );
  const [activeSectionId, setActiveSectionId] = useState<string>('section-1');
  const [previewSectionIndex, setPreviewSectionIndex] = useState(0);

  const [editingComponent, setEditingComponent] = useState<ComponentInstance | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingSectionTitle, setIsEditingSectionTitle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add after existing state declarations
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    componentType: string;
    reasoning: string;
    contentExplanation: string;
    previewContent: any;
    confidence: 'high' | 'medium' | 'low';
    alternativeSuggestions?: Array<{
      componentType: string;
      reasoning: string;
      previewContent?: any;
      isGenerating?: boolean;
    }>;
  } | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null); // -1 = primary, 0+ = alternatives
  const [isGeneratingAlternative, setIsGeneratingAlternative] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  // Section handlers
  const addSection = () => {
    const newId = `section-${Date.now()}`;
    const newSection: Section = {
      id: newId,
      title: `Section ${sections.length + 1}`,
      components: [],
    };
    setSections([...sections, newSection]);
    setActiveSectionId(newId);
  };

  const deleteSection = (id: string) => {
    if (sections.length === 1) return;
    const newSections = sections.filter((s) => s.id !== id);
    setSections(newSections);
    if (activeSectionId === id) setActiveSectionId(newSections[0].id);
  };

  const updateSectionTitle = (id: string, title: string) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, title } : s)));
  };

  // Component handlers
  const addComponent = (type: ComponentType) => {
    const template = getTemplateByType(type);
    if (!template) return;

    const newComponent: ComponentInstance = {
      id: `${type}-${Date.now()}`,
      type,
      data: JSON.parse(JSON.stringify(template.defaultData)),
    };

    setSections(
      sections.map((s) =>
        s.id === activeSectionId
          ? { ...s, components: [...s.components, newComponent] }
          : s
      )
    );
  };
  const addComponentWithAIContent = (type: ComponentType, aiData: any) => {
    const newComponent: ComponentInstance = {
      id: `${type}-${Date.now()}`,
      type,
      data: aiData,
    };

    setSections(
      sections.map((s) =>
        s.id === activeSectionId
          ? { ...s, components: [...s.components, newComponent] }
          : s
      )
    );

    // Reset all modal state
    setShowAISuggestion(false);
    setAiSuggestion(null);
    setSelectedPreviewIndex(null);
    setIsGeneratingAlternative(null);
  };

  const removeComponent = (compId: string) => {
    setSections(
      sections.map((s) =>
        s.id === activeSectionId
          ? { ...s, components: s.components.filter((c) => c.id !== compId) }
          : s
      )
    );
  };

  const toggleComponent = (id: string) => {
    setSections(
      sections.map((s) =>
        s.id === activeSectionId
          ? {
              ...s,
              components: s.components.map((c) =>
                c.id === id ? { ...c, expanded: !c.expanded } : c
              ),
            }
          : s
      )
    );
  };

  const updateComponent = (id: string, newData: ComponentData) => {
    setSections(
      sections.map((s) => ({
        ...s,
        components: s.components.map((c) =>
          c.id === id ? { ...c, data: newData } : c
        ),
      }))
    );
    setEditingComponent(null);
  };

  // Drag and drop handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSections(
        sections.map((s) => {
          if (s.id === activeSectionId) {
            const oldIndex = s.components.findIndex((item) => item.id === active.id);
            const newIndex = s.components.findIndex((item) => item.id === over.id);
            return { ...s, components: arrayMove(s.components, oldIndex, newIndex) };
          }
          return s;
        })
      );
    }
  };

  // AI generation handler. 
  const handleAIGenerate = useCallback(
    async (context: AIGenerationContext): Promise<ComponentData> => {
      const response = await fetch('/api/ai/generate-component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('AI generation error response:', error);
        throw new Error(error.message || 'Failed to generate content');
      }

      const result = await response.json();
      return result.data;
    },
    []
  );
  // Generate content for an alternative suggestion
  const generateAlternativeContent = useCallback(async (altIndex: number, componentType: string) => {
    if (!aiSuggestion) return;

    setIsGeneratingAlternative(altIndex);

    try {
      // Build context from existing components
      const existingContent: string[] = [];
      sections.forEach((section) => {
        section.components.forEach((comp) => {
          if (comp.type === 'text-block' && 'content' in comp.data && comp.data.content) {
            existingContent.push(comp.data.content as string);
          }
        });
      });

      const context = {
        componentType,
        moduleTitle,
        moduleDescription,
        existingContent,
        currentSectionTitle: activeSection?.title || 'Section',
      };

      const response = await fetch('/api/ai/generate-component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const result = await response.json();

      // Update the alternative with the generated content
      setAiSuggestion((prev) => {
        if (!prev || !prev.alternativeSuggestions) return prev;
        const newAlternatives = [...prev.alternativeSuggestions];
        newAlternatives[altIndex] = {
          ...newAlternatives[altIndex],
          previewContent: result.data,
          isGenerating: false,
        };
        return { ...prev, alternativeSuggestions: newAlternatives };
      });
    } catch (error) {
      console.error('Error generating alternative content:', error);
      alert('Failed to generate content for this alternative. Please try again.');
    } finally {
      setIsGeneratingAlternative(null);
    }
  }, [aiSuggestion, sections, moduleTitle, moduleDescription, activeSection]);

  // Add after handleAIGenerate function
  const handleGetAISuggestion = useCallback(async () => {
    setIsLoadingSuggestion(true);
    setShowAISuggestion(true);

    try {
      // Build context from existing components
      const existingContent: string[] = [];
      sections.forEach((section) => {
        section.components.forEach((comp) => {
          if (comp.type === 'text-block' && 'content' in comp.data && comp.data.content) {
            existingContent.push(comp.data.content as string);
          }
        });
      });

      const contextSummary = sections.map((section, i) => 
        `Section ${i + 1} "${section.title}": ${section.components.length} components (${
          section.components.map(c => getTemplateByType(c.type)?.name || c.type).join(', ')
        })`
      ).join('\n');

      const prompt = `You are an expert instructional designer for mining safety training. Analyze this training module and suggest the best NEXT component to add.

  MODULE CONTEXT:
  Title: ${moduleTitle}
  Description: ${moduleDescription}

  CURRENT STRUCTURE:
  ${contextSummary}

  Total Components: ${sections.reduce((acc, s) => acc + s.components.length, 0)}

  AVAILABLE COMPONENT TYPES:
  ${COMPONENT_TEMPLATES.map(t => `- ${t.type}: ${t.name} (${t.category})`).join('\n')}

  Provide your recommendation as JSON with this structure:
  {
    "componentType": "suggested-type",
    "reasoning": "Why this component should come next (2-3 sentences explaining the pedagogical flow)",
    "contentExplanation": "What specific content this component should cover based on what's already in the module (2-3 sentences)",
    "previewContent": {
      // Sample data structure for the suggested component with realistic mining safety content
    },
    "confidence": "high|medium|low",
    "alternativeSuggestions": [
      {
        "componentType": "alternative-type",
        "reasoning": "Brief reason for this alternative"
      }
    ]
  }

  Consider:
  - Pedagogical flow (introduce → demonstrate → practice → assess)
  - Content variety (mix text, interactive, media, assessments)
  - Mining safety best practices
  - What's missing from the current module
  - Engagement and retention
  - Practical application for Zambian copper mine workers

  CRITICAL: Return ONLY valid JSON, no markdown or extra text.`;
      const context: any = {
        prompt: prompt
      }
      const response = await fetch('/api/ai/next-component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate content');
      }

      const result = await response.json();
      console.log('AI Suggestion Response:', result.data);
      setAiSuggestion(result.data);
    } catch (error) {
      console.error('AI suggestion error:', error);
      alert('Failed to generate suggestion. Please try again.');
    } finally {
      setIsLoadingSuggestion(false);
    }
  }, [sections, moduleTitle, moduleDescription]);

  // Regenerate the primary suggestion
  const regeneratePrimarySuggestion = useCallback(async () => {
    setAiSuggestion(null);
    setSelectedPreviewIndex(null);
    setIsLoadingSuggestion(true);
    setShowAISuggestion(true);

    try {
      // Build context from existing components
      const existingContent: string[] = [];
      sections.forEach((section) => {
        section.components.forEach((comp) => {
          if (comp.type === 'text-block' && 'content' in comp.data && comp.data.content) {
            existingContent.push(comp.data.content as string);
          }
        });
      });

      const contextSummary = sections.map((section, i) =>
        `Section ${i + 1} "${section.title}": ${section.components.length} components (${
          section.components.map(c => getTemplateByType(c.type)?.name || c.type).join(', ')
        })`
      ).join('\n');

      const prompt = `You are an expert instructional designer for mining safety training. Analyze this training module and suggest the best NEXT component to add.

  MODULE CONTEXT:
  Title: ${moduleTitle}
  Description: ${moduleDescription}

  CURRENT STRUCTURE:
  ${contextSummary}

  Total Components: ${sections.reduce((acc, s) => acc + s.components.length, 0)}

  AVAILABLE COMPONENT TYPES:
  ${COMPONENT_TEMPLATES.map(t => `- ${t.type}: ${t.name} (${t.category})`).join('\n')}

  IMPORTANT: Suggest a DIFFERENT component than the previous suggestion. Be creative and consider alternative pedagogical approaches.

  Provide your recommendation as JSON with this structure:
  {
    "componentType": "suggested-type",
    "reasoning": "Why this component should come next (2-3 sentences explaining the pedagogical flow)",
    "contentExplanation": "What specific content this component should cover based on what's already in the module (2-3 sentences)",
    "previewContent": {
      // Sample data structure for the suggested component with realistic mining safety content
    },
    "confidence": "high|medium|low",
    "alternativeSuggestions": [
      {
        "componentType": "alternative-type",
        "reasoning": "Brief reason for this alternative"
      }
    ]
  }

  Consider:
  - Pedagogical flow (introduce → demonstrate → practice → assess)
  - Content variety (mix text, interactive, media, assessments)
  - Mining safety best practices
  - What's missing from the current module
  - Engagement and retention
  - Practical application for Zambian copper mine workers

  CRITICAL: Return ONLY valid JSON, no markdown or extra text.`;

      const response = await fetch('/api/ai/next-component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate suggestion');
      }

      const result = await response.json();
      setAiSuggestion(result.data);
    } catch (error) {
      console.error('Regeneration error:', error);
      alert('Failed to regenerate suggestion. Please try again.');
      setShowAISuggestion(false);
    } finally {
      setIsLoadingSuggestion(false);
    }
  }, [sections, moduleTitle, moduleDescription]);

  // Save handler
  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const totalComponents = sections.reduce(
        (acc, s) => acc + s.components.length,
        0
      );

      const componentTypes = Array.from(
        new Set(sections.flatMap((s) => s.components.map((c) => c.type)))
      );

      const output: ModuleBuilderOutput = {
        title: moduleTitle,
        description: moduleDescription,
        sections,
        metadata: {
          totalComponents,
          estimatedDuration: Math.max(5, totalComponents * 3), // 3 min per component
          componentTypes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      await onSave(output);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save module');
    } finally {
      setIsSaving(false);
    }
  };

  // Get module context for AI generation
  const getModuleContext = () => ({
    title: moduleTitle,
    description: moduleDescription,
    sections,
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6">
        {/* TOP BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 bg-white p-4 rounded-3xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-3.5 rounded-2xl shadow-lg shadow-indigo-100">
              <Layout className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {moduleTitle || 'Module Builder'}
              </h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Training Content Creator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!showPreview) setPreviewSectionIndex(0);
                setShowPreview(!showPreview);
              }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                showPreview
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {showPreview ? (
                <Edit2 className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              {showPreview ? 'Edit Content' : 'Preview Mobile'}
            </button>

            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            )}

            {onSave && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">Save Module</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Save Error */}
        {saveError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{saveError}</p>
            <button
              onClick={() => setSaveError(null)}
              className="ml-auto p-1 hover:bg-red-100 rounded"
            >
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>  
        )}

        <div className="grid grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT: COMPONENT LIBRARY (Hidden in Preview) */}
          {/* LEFT: COMPONENT LIBRARY (Hidden in Preview) */}
          {!showPreview && (
            <div className="col-span-12 lg:col-span-3">
              <div className="bg-white rounded-3xl shadow-sm p-6 sticky top-6 border border-slate-200/60">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 bg-indigo-50 rounded-lg">
                    <Plus className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Library
                  </span>
                </div>

                {/* AI Suggestion Button */}
                <button
                  onClick={handleGetAISuggestion}
                  disabled={isLoadingSuggestion}
                  className="w-full mb-6 flex items-center gap-3 p-4 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 rounded-xl transition-all group shadow-lg shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-2 rounded-lg bg-white/20 shrink-0">
                    {isLoadingSuggestion ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-bold text-white block">
                      {isLoadingSuggestion ? 'Analyzing...' : 'AI Suggest Next'}
                    </span>
                    <span className="text-[10px] text-white/80">
                      Get smart recommendations
                    </span>
                  </div>
                </button>

                {/* Rest of library code stays the same */}
                <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {TEMPLATE_CATEGORIES.map((cat) => {
                    const catInfo = CATEGORY_INFO[cat];
                    const templates = COMPONENT_TEMPLATES.filter(
                      (t) => t.category === cat
                    );
                    if (templates.length === 0) return null;

                    return (
                      <div key={cat}>
                        <p
                          className="text-[10px] font-bold uppercase mb-3 px-2"
                          style={{ color: catInfo.color }}
                        >
                          {catInfo.name}
                        </p>
                        <div className="space-y-2">
                          {templates.map((template) => (
                            <button
                              key={template.type}
                              onClick={() => addComponent(template.type)}
                              className="w-full flex items-center gap-3 p-3 bg-slate-50/50 hover:bg-white hover:shadow-md hover:shadow-slate-100 rounded-xl transition-all group border border-transparent hover:border-slate-100 text-left"
                            >
                              <div
                                className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 group-hover:scale-110 transition-transform shrink-0"
                                style={{ backgroundColor: `${template.color}10` }}
                              >
                                <template.icon
                                  className="w-4 h-4"
                                  style={{ color: template.color }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-bold text-slate-700 block truncate">
                                  {template.name}
                                </span>
                                <span className="text-[10px] text-slate-400 line-clamp-1">
                                  {template.description}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
            </div>
          )}

          {/* RIGHT: EDITOR OR PREVIEW */}
          <div className={`col-span-12 ${showPreview ? 'lg:col-span-12' : 'lg:col-span-9'} overflow-y-auto`}>
            {showPreview ? (
              // --- PREVIEW MODE ---
              <div className="flex justify-center py-4">
                <MobilePreviewContainer
                  title={moduleTitle || 'Module'}
                  currentSectionIndex={previewSectionIndex}
                  sections={sections}
                  onNext={() =>
                    setPreviewSectionIndex((i) => Math.min(i + 1, sections.length - 1))
                  }
                  onPrev={() => setPreviewSectionIndex((i) => Math.max(i - 1, 0))}
                  onJumpTo={(i) => setPreviewSectionIndex(i)}
                >
                  {sections[previewSectionIndex].components.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                      <FileText className="w-12 h-12 mb-2 text-gray-300" />
                      <p className="text-sm font-medium text-gray-400">Empty Section</p>
                    </div>
                  ) : (
                    sections[previewSectionIndex].components.map((component, idx) => (
                      <div
                        key={component.id}
                        className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        {renderMobilePreview(component)}
                      </div>
                    ))
                  )}
                </MobilePreviewContainer>
              </div>
            ) : (
              // --- EDITOR MODE ---
              <div className="flex flex-col gap-6">
                {/* SECTION TABS */}
                <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar items-center">
                  {sections.map((section, index) => (
                    <div
                      key={section.id}
                      onClick={() => setActiveSectionId(section.id)}
                      className={`
                        group relative flex items-center gap-2 px-5 py-3 rounded-2xl cursor-pointer transition-all border-2 min-w-[160px] select-none
                        ${
                          activeSectionId === section.id
                            ? 'bg-white border-indigo-600 shadow-md shadow-indigo-100'
                            : 'bg-white border-transparent hover:border-slate-200'
                        }
                      `}
                    >
                      <div
                        className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                        ${
                          activeSectionId === section.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }
                      `}
                      >
                        {index + 1}
                      </div>

                      {isEditingSectionTitle && activeSectionId === section.id ? (
                        <input
                          autoFocus
                          className="w-full bg-transparent outline-none font-bold text-sm text-slate-900"
                          value={section.title}
                          onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                          onBlur={() => setIsEditingSectionTitle(false)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && setIsEditingSectionTitle(false)
                          }
                        />
                      ) : (
                        <span className="font-bold text-sm text-slate-700 truncate max-w-[120px]">
                          {section.title}
                        </span>
                      )}

                      {/* Hover Actions */}
                      <div
                        className={`ml-auto flex gap-1 ${
                          activeSectionId === section.id
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        } transition-opacity`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingSectionTitle(true);
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {sections.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSection(section.id);
                            }}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addSection}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors flex-shrink-0 shadow-sm border border-indigo-100"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* CANVAS AREA */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 min-h-[600px] p-8 relative">
                  <div className="mb-8 border-b border-slate-100 pb-4 flex justify-between items-end">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">
                        {activeSection.title}
                      </h2>
                      <p className="text-sm text-slate-400 font-medium mt-1">
                        {activeSection.components.length} components
                      </p>
                    </div>
                    <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wide">
                      Editing Mode
                    </div>
                  </div>

                  {activeSection.components.length === 0 ? (
                    <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                        <Plus className="w-8 h-8 text-indigo-500" />
                      </div>
                      <p className="text-lg font-bold text-slate-900">
                        Start Building Section
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Select components from the library on the left
                      </p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={activeSection.components.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-4 pb-20">
                          {activeSection.components.map((component) => (
                            <SortableComponentItem
                              key={component.id}
                              component={component}
                              onRemove={() => removeComponent(component.id)}
                              onEdit={() => setEditingComponent(component)}
                              onToggle={() => toggleComponent(component.id)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      <DragOverlay>
                        <div className="opacity-0">Dragging</div>
                      </DragOverlay>
                    </DndContext>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {editingComponent && (
        <EditModal
          component={editingComponent}
          moduleContext={getModuleContext()}
          onSave={(newData) => updateComponent(editingComponent.id, newData)}
          onClose={() => setEditingComponent(null)}
          onGenerateWithAI={handleAIGenerate}
        />
      )}
      {/* AI SUGGESTION MODAL */}
      {showAISuggestion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">AI Recommendation</h2>
                    <p className="text-sm text-white/80">Smart next step for your module</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {aiSuggestion && (
                    <button
                      onClick={regeneratePrimarySuggestion}
                      disabled={isLoadingSuggestion}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isLoadingSuggestion ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Regenerate
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowAISuggestion(false);
                      setAiSuggestion(null);
                      setSelectedPreviewIndex(null);
                    }}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoadingSuggestion && !aiSuggestion && (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 animate-pulse" />
                  <Sparkles className="w-10 h-10 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing Your Module...</h3>
                <p className="text-gray-500 text-center max-w-md">
                  AI is reviewing your content structure and generating smart recommendations for the next component.
                </p>
              </div>
            )}

            {/* Content */}
            {aiSuggestion && (
              <div className="flex flex-1 overflow-hidden">
                {/* Left: Suggestions List */}
                <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-100">
                  {/* Primary Suggestion */}
                  <div className="mb-6">
                    <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-3">Recommended</p>
                    <button
                      onClick={() => setSelectedPreviewIndex(-1)}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                        selectedPreviewIndex === -1
                          ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-100'
                          : 'border-gray-200 hover:border-violet-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="p-3 rounded-xl shrink-0"
                          style={{
                            backgroundColor: `${getTemplateByType(aiSuggestion.componentType as ComponentType)?.color}15`
                          }}
                        >
                          {getTemplateByType(aiSuggestion.componentType as ComponentType)?.icon ? (
                            React.createElement(getTemplateByType(aiSuggestion.componentType as ComponentType)!.icon, {
                              className: "w-6 h-6",
                              style: { color: getTemplateByType(aiSuggestion.componentType as ComponentType)?.color }
                            })
                          ) : <FileText className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 truncate">
                              {getTemplateByType(aiSuggestion.componentType as ComponentType)?.name || aiSuggestion.componentType}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              aiSuggestion.confidence === 'high' ? 'bg-green-100 text-green-700' :
                              aiSuggestion.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {aiSuggestion.confidence}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">{aiSuggestion.reasoning}</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Alternative Suggestions */}
                  {aiSuggestion.alternativeSuggestions && aiSuggestion.alternativeSuggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Alternatives</p>
                      <div className="space-y-2">
                        {aiSuggestion.alternativeSuggestions.map((alt, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedPreviewIndex(idx)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                              selectedPreviewIndex === idx
                                ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                                : 'border-gray-200 hover:border-indigo-300 bg-white'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="p-2 rounded-lg shrink-0"
                                style={{
                                  backgroundColor: `${getTemplateByType(alt.componentType as ComponentType)?.color}15`
                                }}
                              >
                                {getTemplateByType(alt.componentType as ComponentType)?.icon ? (
                                  React.createElement(getTemplateByType(alt.componentType as ComponentType)!.icon, {
                                    className: "w-5 h-5",
                                    style: { color: getTemplateByType(alt.componentType as ComponentType)?.color }
                                  })
                                ) : <FileText className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-semibold text-gray-900 text-sm truncate">
                                  {getTemplateByType(alt.componentType as ComponentType)?.name || alt.componentType}
                                </h5>
                                <p className="text-xs text-gray-500 line-clamp-2">{alt.reasoning}</p>
                                {!alt.previewContent && (
                                  <p className="text-[10px] text-amber-600 mt-1 font-medium">Click to generate content</p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Preview Panel */}
                <div className="w-1/2 bg-gray-50 p-6 overflow-y-auto flex flex-col">
                  {selectedPreviewIndex === null ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                        <Play className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-medium">Select a suggestion to preview</p>
                      <p className="text-sm text-gray-400 mt-1">Click on any option to see how it will look</p>
                    </div>
                  ) : selectedPreviewIndex === -1 ? (
                    // Primary suggestion preview
                    <>
                      <div className="mb-4">
                        <h4 className="font-bold text-gray-900 mb-2">Content Preview</h4>
                        <div className="p-4 bg-violet-50 rounded-xl mb-4">
                          <p className="text-xs font-medium text-violet-600 uppercase tracking-wider mb-1">Content Focus</p>
                          <p className="text-sm text-violet-800">{aiSuggestion.contentExplanation}</p>
                        </div>
                      </div>

                      {/* Mobile Preview */}
                      <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mobile Preview</p>
                        </div>
                        <div className="p-4 max-h-[400px] overflow-y-auto">
                          {renderMobilePreview({
                            id: 'preview-primary',
                            type: aiSuggestion.componentType as ComponentType,
                            data: aiSuggestion.previewContent,
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    // Alternative suggestion preview
                    (() => {
                      const alt = aiSuggestion.alternativeSuggestions![selectedPreviewIndex];
                      return (
                        <>
                          <div className="mb-4">
                            <h4 className="font-bold text-gray-900 mb-2">
                              {getTemplateByType(alt.componentType as ComponentType)?.name}
                            </h4>
                            <div className="p-4 bg-indigo-50 rounded-xl">
                              <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-1">Why this works</p>
                              <p className="text-sm text-indigo-800">{alt.reasoning}</p>
                            </div>
                          </div>

                          {alt.previewContent ? (
                            // Has generated content - show preview
                            <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                              <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mobile Preview</p>
                              </div>
                              <div className="p-4 max-h-[400px] overflow-y-auto">
                                {renderMobilePreview({
                                  id: `preview-alt-${selectedPreviewIndex}`,
                                  type: alt.componentType as ComponentType,
                                  data: alt.previewContent,
                                })}
                              </div>
                            </div>
                          ) : (
                            // No content yet - show generate button
                            <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
                              {isGeneratingAlternative === selectedPreviewIndex ? (
                                <>
                                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                                  <p className="text-gray-600 font-medium">Generating content...</p>
                                  <p className="text-sm text-gray-400 mt-1">This may take a moment</p>
                                </>
                              ) : (
                                <>
                                  <div className="p-4 bg-indigo-50 rounded-2xl mb-4">
                                    <Sparkles className="w-8 h-8 text-indigo-500" />
                                  </div>
                                  <p className="text-gray-600 font-medium mb-1">Content not generated yet</p>
                                  <p className="text-sm text-gray-400 mb-4">Generate AI content for this component</p>
                                  <button
                                    onClick={() => generateAlternativeContent(selectedPreviewIndex, alt.componentType)}
                                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200"
                                  >
                                    <Sparkles className="w-4 h-4" />
                                    Generate Content
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            {aiSuggestion && (
              <div className="p-6 border-t border-gray-100 flex gap-3 bg-gray-50">
                <button
                  onClick={() => {
                    setShowAISuggestion(false);
                    setAiSuggestion(null);
                    setSelectedPreviewIndex(null);
                  }}
                  className="px-6 py-3 rounded-xl bg-white border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>

                <div className="flex-1" />

                {selectedPreviewIndex !== null && (
                  <button
                    onClick={() => {
                      if (selectedPreviewIndex === -1) {
                        // Add primary suggestion
                        addComponentWithAIContent(
                          aiSuggestion.componentType as ComponentType,
                          aiSuggestion.previewContent
                        );
                      } else {
                        // Add alternative
                        const alt = aiSuggestion.alternativeSuggestions![selectedPreviewIndex];
                        if (alt.previewContent) {
                          addComponentWithAIContent(
                            alt.componentType as ComponentType,
                            alt.previewContent
                          );
                        } else {
                          // Need to generate content first
                          generateAlternativeContent(selectedPreviewIndex, alt.componentType);
                        }
                      }
                    }}
                    disabled={
                      selectedPreviewIndex !== -1 &&
                      !aiSuggestion.alternativeSuggestions?.[selectedPreviewIndex]?.previewContent &&
                      isGeneratingAlternative === selectedPreviewIndex
                    }
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 font-bold text-white hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                    {selectedPreviewIndex !== -1 && !aiSuggestion.alternativeSuggestions?.[selectedPreviewIndex]?.previewContent
                      ? 'Generate & Add'
                      : 'Add Component'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export types for external use
export type { Section, ComponentInstance, ModuleBuilderOutput, ModuleBuilderProps };
