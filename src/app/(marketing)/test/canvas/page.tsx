"use client";
import React, { useState } from 'react';
import { 
  DndContext, 
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent
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
  GripVertical, Plus, Trash2, Settings, AlertTriangle, 
  BookOpen, Wrench, Shield, ListChecks, FileText, 
  ClipboardCheck, Save, Eye, ChevronDown, ChevronUp
} from 'lucide-react';

// Component Type Definitions
type ComponentType = 
  | 'safety-inspection'
  | 'hazard-assessment'
  | 'operating-procedure'
  | 'equipment-specs'
  | 'practice-problems'
  | 'maintenance-schedule';

interface ComponentTemplate {
  type: ComponentType;
  name: string;
  icon: React.ElementType;
  color: string;
  category: 'safety' | 'equipment' | 'assessment';
  defaultData: any;
}

interface ComponentInstance {
  id: string;
  type: ComponentType;
  data: any;
  expanded?: boolean;
}

// Component Templates Library
const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  {
    type: 'safety-inspection',
    name: 'Safety Inspection',
    icon: Shield,
    color: '#EF4444',
    category: 'safety',
    defaultData: {
      equipmentType: 'Underground Loader',
      items: ['Brakes', 'Lights', 'Horn', 'Fire extinguisher'],
      flags: []
    }
  },
  {
    type: 'hazard-assessment',
    name: 'Hazard Assessment',
    icon: AlertTriangle,
    color: '#F59E0B',
    category: 'safety',
    defaultData: {
      hazardType: 'Fall of ground',
      likelihood: 'Medium',
      severity: 'Critical',
      riskLevel: 'High',
      controls: ['Rock bolts installed', 'Scaling completed']
    }
  },
  {
    type: 'operating-procedure',
    name: 'Operating Procedure',
    icon: BookOpen,
    color: '#3B82F6',
    category: 'equipment',
    defaultData: {
      equipmentType: 'Underground Drill Rig',
      steps: [
        'Walk-around inspection',
        'Test emergency stop',
        'Start ventilation fan',
        'Position drill boom'
      ]
    }
  },
  {
    type: 'equipment-specs',
    name: 'Equipment Specs',
    icon: Wrench,
    color: '#8B5CF6',
    category: 'equipment',
    defaultData: {
      equipmentName: 'CAT 994K Loader',
      specs: {
        'Capacity': '19m³',
        'Weight': '203t',
        'Engine': '2013HP',
        'MaxSpeed': '42km/h'
      }
    }
  },
  {
    type: 'maintenance-schedule',
    name: 'Maintenance Schedule',
    icon: ClipboardCheck,
    color: '#10B981',
    category: 'equipment',
    defaultData: {
      equipmentId: 'UG-LOADER-042',
      lastService: '2024-01-15',
      nextDue: '2024-02-15',
      defects: []
    }
  },
  {
    type: 'practice-problems',
    name: 'Practice Problems',
    icon: ListChecks,
    color: '#EC4899',
    category: 'assessment',
    defaultData: {
      title: 'Safety Knowledge Check',
      problems: [
        {
          problemType: 'multiple_choice',
          question: 'What is the first step in pre-shift inspection?',
          options: ['Walk around equipment', 'Start engine', 'Check paperwork'],
          correctAnswer: 'Walk around equipment',
          explanation: 'Visual inspection before starting'
        }
      ]
    }
  }
];

// Sortable Component Item
function SortableComponentItem({ 
  component, 
  onRemove, 
  onEdit,
  onToggle 
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

  const template = COMPONENT_TEMPLATES.find(t => t.type === component.type);
  const Icon = template?.icon || FileText;
  const color = template?.color || '#6B7280';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden mb-3 hover:border-gray-300 transition-all"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-gray-50">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </button>
        
        <div className="flex items-center gap-2 flex-1">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">{template?.name}</p>
            <p className="text-xs text-gray-500">{component.type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {component.expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4 text-blue-600" />
          </button>
          <button
            onClick={onRemove}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      {component.expanded && (
        <div className="p-4 border-t border-gray-200 bg-gray-50/50">
          <ComponentPreview component={component} />
        </div>
      )}
    </div>
  );
}

// Component Preview
function ComponentPreview({ component }: { component: ComponentInstance }) {
  const { type, data } = component;

  switch (type) {
    case 'safety-inspection':
      return (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700">Equipment: {data.equipmentType}</p>
          <div className="flex flex-wrap gap-2">
            {data.items?.map((item: string, i: number) => (
              <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg">
                {item}
              </span>
            ))}
          </div>
          {data.flags?.length > 0 && (
            <div className="mt-2 p-2 bg-red-50 rounded-lg">
              <p className="text-xs font-bold text-red-700">⚠️ Flags:</p>
              {data.flags.map((flag: string, i: number) => (
                <p key={i} className="text-xs text-red-600">• {flag}</p>
              ))}
            </div>
          )}
        </div>
      );

    case 'hazard-assessment':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <p className="text-sm font-bold text-orange-900">{data.hazardType}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-gray-100 rounded-lg text-center">
              <p className="text-xs text-gray-600">Likelihood</p>
              <p className="text-xs font-bold">{data.likelihood}</p>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg text-center">
              <p className="text-xs text-gray-600">Severity</p>
              <p className="text-xs font-bold">{data.severity}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg text-center">
              <p className="text-xs text-gray-600">Risk</p>
              <p className="text-xs font-bold text-red-700">{data.riskLevel}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-700">Controls:</p>
            {data.controls?.map((control: string, i: number) => (
              <p key={i} className="text-xs text-gray-600">• {control}</p>
            ))}
          </div>
        </div>
      );

    case 'operating-procedure':
      return (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700">📖 {data.equipmentType}</p>
          {data.steps?.map((step: string, i: number) => (
            <div key={i} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-xs text-gray-700">{step}</p>
            </div>
          ))}
        </div>
      );

    case 'equipment-specs':
      return (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700">{data.equipmentName}</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.specs || {}).map(([key, value]) => (
              <div key={key} className="p-2 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-600">{key}</p>
                <p className="text-xs font-bold text-purple-900">{value as string}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'maintenance-schedule':
      return (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700">ID: {data.equipmentId}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-600">Last Service</p>
              <p className="text-xs font-bold">{data.lastService}</p>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg">
              <p className="text-xs text-gray-600">Next Due</p>
              <p className="text-xs font-bold">{data.nextDue}</p>
            </div>
          </div>
        </div>
      );

    case 'practice-problems':
      return (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700">{data.title}</p>
          {data.problems?.map((problem: any, i: number) => (
            <div key={i} className="p-3 bg-pink-50 rounded-lg border border-pink-200">
              <p className="text-xs font-bold text-gray-800 mb-2">Q{i + 1}: {problem.question}</p>
              <div className="space-y-1">
                {problem.options?.map((opt: string, j: number) => (
                  <div key={j} className="text-xs text-gray-600 flex items-center gap-2">
                    <span className={opt === problem.correctAnswer ? 'text-green-600 font-bold' : ''}>
                      {String.fromCharCode(65 + j)}. {opt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    default:
      return <p className="text-xs text-gray-500">Preview not available</p>;
  }
}

// Main Component
export default function DragDropModuleBuilder() {
  const [components, setComponents] = useState<ComponentInstance[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingComponent, setEditingComponent] = useState<ComponentInstance | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setComponents((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  };

  const addComponent = (template: ComponentTemplate) => {
    const newComponent: ComponentInstance = {
      id: `${template.type}-${Date.now()}`,
      type: template.type,
      data: JSON.parse(JSON.stringify(template.defaultData)),
      expanded: true
    };
    setComponents([...components, newComponent]);
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  const toggleComponent = (id: string) => {
    setComponents(components.map(c => 
      c.id === id ? { ...c, expanded: !c.expanded } : c
    ));
  };

  const exportAsJSON = () => {
    const output = {
      text: "Training module content",
      components: components.map(c => ({
        type: c.type,
        data: c.data
      }))
    };
    console.log(JSON.stringify(output, null, 2));
    alert('Module exported to console (check developer tools)');
  };

  const activeComponent = components.find(c => c.id === activeId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-xl mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            Visual Module Builder
          </h1>
          <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest">
            Drag & Drop Training Components
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Component Library */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-lg p-6 sticky top-8">
              <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Component Library
              </h2>
              
              {/* Safety Components */}
              <div className="mb-6">
                <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-3">
                  Safety Components
                </p>
                <div className="space-y-2">
                  {COMPONENT_TEMPLATES.filter(t => t.category === 'safety').map(template => (
                    <button
                      key={template.type}
                      onClick={() => addComponent(template)}
                      className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all group"
                    >
                      <div 
                        className="p-2 rounded-lg group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: `${template.color}20` }}
                      >
                        <template.icon className="w-4 h-4" style={{ color: template.color }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{template.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment Components */}
              <div className="mb-6">
                <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-3">
                  Equipment Components
                </p>
                <div className="space-y-2">
                  {COMPONENT_TEMPLATES.filter(t => t.category === 'equipment').map(template => (
                    <button
                      key={template.type}
                      onClick={() => addComponent(template)}
                      className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all group"
                    >
                      <div 
                        className="p-2 rounded-lg group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: `${template.color}20` }}
                      >
                        <template.icon className="w-4 h-4" style={{ color: template.color }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{template.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Assessment Components */}
              <div>
                <p className="text-xs font-black text-pink-600 uppercase tracking-widest mb-3">
                  Assessment Components
                </p>
                <div className="space-y-2">
                  {COMPONENT_TEMPLATES.filter(t => t.category === 'assessment').map(template => (
                    <button
                      key={template.type}
                      onClick={() => addComponent(template)}
                      className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all group"
                    >
                      <div 
                        className="p-2 rounded-lg group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: `${template.color}20` }}
                      >
                        <template.icon className="w-4 h-4" style={{ color: template.color }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{template.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Builder Canvas */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-lg p-8 min-h-[600px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-gray-900">
                  Module Canvas ({components.length} components)
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={exportAsJSON}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Export JSON
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                </div>
              </div>

              {components.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-gray-300 rounded-2xl">
                  <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-bold">
                    No components yet
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Click components from the library to add them
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={components.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {components.map((component) => (
                      <SortableComponentItem
                        key={component.id}
                        component={component}
                        onRemove={() => removeComponent(component.id)}
                        onEdit={() => setEditingComponent(component)}
                        onToggle={() => toggleComponent(component.id)}
                      />
                    ))}
                  </SortableContext>
                  <DragOverlay>
                    {activeComponent ? (
                      <div className="bg-white border-2 border-indigo-500 rounded-2xl p-4 shadow-2xl">
                        <p className="text-sm font-bold">
                          {COMPONENT_TEMPLATES.find(t => t.type === activeComponent.type)?.name}
                        </p>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}