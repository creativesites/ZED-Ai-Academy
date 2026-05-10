'use client';

/**
 * Mobile Preview Container
 * Standalone component for previewing modules as they appear on mobile
 */

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  CheckCircle,
  FileText,
} from 'lucide-react';
import type { Section, ComponentInstance } from './types';
import { renderMobilePreview } from './MobilePreviewComponents';

interface MobilePreviewContainerProps {
  title?: string;
  currentSectionIndex: number;
  sections: Section[];
  onNext: () => void;
  onPrev: () => void;
  onJumpTo: (index: number) => void;
  estimatedMinutes?: number;
}

export function MobilePreviewContainer({
  title = 'Module Preview',
  currentSectionIndex,
  sections,
  onNext,
  onPrev,
  onJumpTo,
  estimatedMinutes = 25,
}: MobilePreviewContainerProps) {
  const currentSection = sections[currentSectionIndex];
  const progress = sections.length > 0 ? ((currentSectionIndex + 1) / sections.length) * 100 : 0;
  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === sections.length - 1;

  if (sections.length === 0) {
    return (
      <div className="w-[375px] h-[780px] bg-slate-50 rounded-[40px] border-[8px] border-slate-900 overflow-hidden relative shadow-2xl mx-auto flex flex-col items-center justify-center font-sans">
        <FileText className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-lg font-bold text-gray-400">No sections</p>
        <p className="text-sm text-gray-400">Add sections to preview the module</p>
      </div>
    );
  }

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
                <span className="text-[10px] text-gray-500">~{estimatedMinutes} min</span>
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
        <div>
          {currentSection?.components?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <FileText className="w-12 h-12 mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-400">Empty Section</p>
            </div>
          ) : (
            currentSection?.components?.map((component: ComponentInstance, idx: number) => (
              <div
                key={component.id}
                className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {renderMobilePreview(component)}
              </div>
            ))
          )}
        </div>
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
          disabled={isLast}
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

export default MobilePreviewContainer;
