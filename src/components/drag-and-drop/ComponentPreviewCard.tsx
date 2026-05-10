'use client';

/**
 * Component Preview Card
 * Read-only component display with expandable preview
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import type { ComponentInstance } from './types';
import { getTemplateByType } from './templates';
import { renderMobilePreview } from './MobilePreviewComponents';

interface ComponentPreviewCardProps {
  component: ComponentInstance;
  index?: number;
  defaultExpanded?: boolean;
}

export function ComponentPreviewCard({
  component,
  index,
  defaultExpanded = false,
}: ComponentPreviewCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const template = getTemplateByType(component.type);
  const Icon = template?.icon || FileText;
  const color = template?.color || '#6B7280';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 transition-all shadow-sm">
      <div
        className="flex items-center gap-3 p-4 bg-gray-50/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {index !== undefined && (
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
            {index + 1}
          </span>
        )}

        <div className="flex items-center gap-3 flex-1">
          <div
            className="p-2.5 rounded-xl shadow-sm"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">{template?.name || component.type}</p>
            <p className="text-xs text-gray-500 font-medium">{template?.category || 'Component'}</p>
          </div>
        </div>

        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="p-4 border-t border-gray-100 bg-white">
          {renderMobilePreview(component)}
        </div>
      )}
    </div>
  );
}

export default ComponentPreviewCard;
