import React, { useState, useEffect } from 'react';
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
  BookOpen, Shield, ListChecks, FileText, 
  ClipboardCheck, Save, Eye, ChevronDown, ChevronUp, X,
  Copy, Download, Clock, Award, CheckCircle, Circle,
  ChevronLeft, ChevronRight, Calendar, AlertCircle, Type,
  Layout, Edit2, Play
} from 'lucide-react';

// --- TYPE DEFINITIONS ---

type ComponentType = 
  | 'safety-inspection'
  | 'hazard-assessment'
  | 'operating-procedure'
  | 'maintenance-schedule'
  | 'incident-report'
  | 'text-block'
  | 'practice-problems';

interface ComponentTemplate {
  type: ComponentType;
  name: string;
  icon: React.ElementType;
  color: string;
  category: 'safety' | 'equipment' | 'assessment' | 'content';
  defaultData: any;
}

interface ComponentInstance {
  id: string;
  type: ComponentType;
  data: any;
  expanded?: boolean;
}

interface Section {
  id: string;
  title: string;
  components: ComponentInstance[];
}

// --- TEMPLATES LIBRARY ---

const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  {
    type: 'text-block',
    name: 'Text Content',
    icon: Type,
    color: '#64748B',
    category: 'content',
    defaultData: {
      content: 'Enter your learning content here. You can describe safety protocols, introduction material, or general information.'
    }
  },
  {
    type: 'safety-inspection',
    name: 'Safety Inspection',
    icon: Shield,
    color: '#EF4444',
    category: 'safety',
    defaultData: {
      equipmentType: 'General Equipment',
      items: ['Check fluid levels', 'Inspect tires/tracks', 'Test emergency brakes'],
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
      hazardType: 'Falling Rocks',
      likelihood: 'Medium',
      severity: 'High',
      riskLevel: 'High',
      controls: ['Install mesh guarding', 'Scale loose rocks', 'Wear hard hat']
    }
  },
  {
    type: 'incident-report',
    name: 'Incident Report',
    icon: AlertCircle,
    color: '#DC2626',
    category: 'safety',
    defaultData: {
      incidentType: 'Near Miss',
      severity: 'Medium',
      description: 'Vehicle nearly collided with wall due to slippery ramp.',
      immediateActions: 'Stopped vehicle, applied sand to ramp.',
      rootCause: 'Water leak causing slippery surface.'
    }
  },
  {
    type: 'operating-procedure',
    name: 'Operating Procedure',
    icon: BookOpen,
    color: '#3B82F6',
    category: 'equipment',
    defaultData: {
      equipmentType: 'Drill Rig',
      steps: ['Perform pre-start check', 'Mount the cabin safely', 'Turn on master switch', 'Start engine and idle for 2 mins']
    }
  },
  {
    type: 'maintenance-schedule',
    name: 'Maintenance Schedule',
    icon: ClipboardCheck,
    color: '#10B981',
    category: 'equipment',
    defaultData: {
      equipmentId: 'EQ-2024-001',
      lastService: '2023-12-15',
      nextDue: '2024-01-15',
      defects: ['Hydraulic leak detected', 'Wiper blade broken']
    }
  },
  {
    type: 'practice-problems',
    name: 'Practice Problems',
    icon: ListChecks,
    color: '#EC4899',
    category: 'assessment',
    defaultData: {
      title: 'Knowledge Check',
      problems: []
    }
  }
];

// --- MOBILE PREVIEW COMPONENTS ---

const MobileTextPreview = ({ data }: { data: any }) => (
  <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
    <p className="text-sm text-gray-800 leading-7 font-sans whitespace-pre-wrap">{data.content}</p>
  </div>
);

const MobileMaintenancePreview = ({ data }: { data: any }) => (
  <div className="bg-white rounded-2xl border border-emerald-500/30 overflow-hidden mb-4 shadow-sm">
    <div className="p-4 border-b border-emerald-500/30 flex justify-between bg-emerald-50/10 items-center">
      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4" /> Maintenance
      </span>
      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg">
        {data.equipmentId || 'ID#...'}
      </span>
    </div>
    <div className="p-4 space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 p-2 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase">Last Service</p>
          <p className="text-xs font-bold text-gray-700">{data.lastService || '--'}</p>
        </div>
        <div className="flex-1 p-2 bg-emerald-50 rounded-lg">
          <p className="text-[10px] text-emerald-600 uppercase">Next Due</p>
          <p className="text-xs font-bold text-emerald-700">{data.nextDue || '--'}</p>
        </div>
      </div>
      {data.defects && data.defects.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Reported Defects</p>
          <div className="space-y-1">
            {data.defects.map((d:string, i:number) => (
              <div key={i} className="flex items-start gap-2 text-xs bg-red-50 text-red-700 p-2 rounded border border-red-100">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

const MobileIncidentPreview = ({ data }: { data: any }) => {
  const getSeverityColor = (s: string) => {
    switch(s?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" /> Incident Report
        </span>
        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${getSeverityColor(data.severity)}`}>
          {data.severity}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs font-bold text-gray-900 mb-1">{data.incidentType}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{data.description}</p>
        </div>
        {data.immediateActions && (
          <div className="p-3 bg-blue-50 rounded-xl">
             <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Actions Taken</p>
             <p className="text-xs text-blue-900">{data.immediateActions}</p>
          </div>
        )}
      </div>
    </div>
  );
};

function MobileHazardAssessmentPreview({ data }: { data: any }) {
  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      default: return '#10B981';
    }
  };
  const color = getRiskColor(data.riskLevel);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50/50 to-white">
        <span className="text-xs font-bold text-orange-600 uppercase tracking-wide flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Hazard Assessment
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
           <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-100 text-orange-600">
             <AlertTriangle className="w-5 h-5" />
           </div>
           <div>
             <p className="text-sm font-bold text-gray-900">{data.hazardType || 'Unknown Hazard'}</p>
             <p className="text-xs text-gray-500">Risk Level: <span style={{ color, fontWeight: 'bold' }}>{data.riskLevel}</span></p>
           </div>
        </div>
        
        {data.controls && data.controls.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Controls</p>
            <div className="space-y-2">
              {data.controls.map((c: string, i: number) => (
                <div key={i} className="flex gap-2 items-center text-xs text-gray-700 p-2 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileOperatingProcedurePreview({ data }: { data: any }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4">
      <div className="p-4 border-b border-gray-100 bg-blue-50/30">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> {data.equipmentType || 'SOP'}
        </span>
      </div>
      <div className="p-4">
        <div className="space-y-3 relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-100" />
          {data.steps?.map((step: string, index: number) => (
            <div key={index} className="flex gap-3 relative">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 z-10 shadow-sm border-2 border-white">
                <span className="text-[10px] font-bold text-white">{index + 1}</span>
              </div>
              <p className="text-xs text-gray-700 leading-5 pt-0.5">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileSafetyInspectionPreview({ data }: { data: any }) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4">
        <div className="p-4 border-b border-gray-100 bg-red-50/30">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wide flex items-center gap-2">
            <Shield className="w-4 h-4" /> Safety Inspection
          </span>
        </div>
        <div className="p-4">
            <p className="text-xs text-gray-500 mb-3 font-bold uppercase">{data.equipmentType}</p>
            <div className="space-y-2">
                {data.items?.map((item: string, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-700">{item}</span>
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    </div>
                ))}
            </div>
        </div>
      </div>
    );
  }

// --- MOBILE CONTAINER ---

const MobilePreviewContainer = ({ 
  children, 
  title = "Module Preview", 
  currentSectionIndex,
  sections,
  onNext,
  onPrev,
  onJumpTo
}: { 
  children: React.ReactNode;
  title?: string;
  currentSectionIndex: number;
  sections: Section[];
  onNext: () => void;
  onPrev: () => void;
  onJumpTo: (index: number) => void;
}) => {
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
              <h4 className="font-bold text-gray-900 text-base leading-tight truncate">{title}</h4>
              <div className="flex items-center gap-1 mt-1">
                <Clock size={12} className="text-gray-500" />
                <span className="text-[10px] text-gray-500">25 min</span>
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
            <span className="text-[10px] font-bold text-indigo-600">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Section Nav Bubbles */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar mask-linear-fade">
          {sections.map((_, i) => (
            <button 
              key={i}
              onClick={() => onJumpTo(i)}
              className={`
                flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all flex-shrink-0
                ${i === currentSectionIndex
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
        <div className="flex items-center p-4 rounded-2xl bg-white border border-gray-100 shadow-sm mb-2 animate-in slide-in-from-right-4 duration-300">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mr-3">
             <BookOpen size={20} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{currentSection.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Section {currentSectionIndex + 1}</p>
          </div>
        </div>

        {/* Dynamic Components */}
        <div className="animate-in fade-in duration-500">
           {children}
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
          className={`flex-1 flex items-center justify-center px-5 h-12 rounded-xl shadow-lg transition-all
            ${isLast 
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
};

// --- EDIT MODAL ---

function EditModal({ component, onSave, onClose }: { component: ComponentInstance, onSave: (data: any) => void, onClose: () => void }) {
  const [data, setData] = useState(JSON.parse(JSON.stringify(component.data)));
  const [tempItem, setTempItem] = useState('');

  const handleArrayAdd = (field: string) => {
    if (!tempItem.trim()) return;
    setData({ ...data, [field]: [...(data[field] || []), tempItem] });
    setTempItem('');
  };

  const handleArrayRemove = (field: string, index: number) => {
    setData({ ...data, [field]: data[field].filter((_: any, i: number) => i !== index) });
  };

  const renderContent = () => {
    switch (component.type) {
      case 'text-block':
        return (
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Content</label>
            <textarea
              className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 h-40 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={data.content}
              onChange={e => setData({ ...data, content: e.target.value })}
              placeholder="Enter text..."
            />
          </div>
        );
      
      case 'maintenance-schedule':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">ID</label>
                  <input className="w-full p-3 bg-gray-50 border rounded-xl" value={data.equipmentId} onChange={e => setData({...data, equipmentId: e.target.value})} />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Next Due</label>
                  <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl" value={data.nextDue} onChange={e => setData({...data, nextDue: e.target.value})} />
               </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Defects</label>
              <div className="flex gap-2 mb-2">
                <input className="flex-1 p-3 bg-gray-50 border rounded-xl" value={tempItem} onChange={e => setTempItem(e.target.value)} placeholder="Add defect..." onKeyDown={e => e.key === 'Enter' && handleArrayAdd('defects')} />
                <button onClick={() => handleArrayAdd('defects')} className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Plus size={20}/></button>
              </div>
              <div className="space-y-1">{data.defects?.map((d: string, i: number) => (
                <div key={i} className="flex justify-between p-2 bg-red-50 text-red-700 rounded-lg text-sm">
                  <span>{d}</span><button onClick={() => handleArrayRemove('defects', i)}><X size={14} /></button>
                </div>
              ))}</div>
            </div>
          </div>
        );

      case 'operating-procedure':
        return (
          <div className="space-y-4">
             <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Equipment</label>
                <input className="w-full p-3 bg-gray-50 border rounded-xl" value={data.equipmentType} onChange={e => setData({...data, equipmentType: e.target.value})} />
             </div>
             <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Steps</label>
                <div className="flex gap-2 mb-2">
                  <input className="flex-1 p-3 bg-gray-50 border rounded-xl" value={tempItem} onChange={e => setTempItem(e.target.value)} placeholder="Add step..." onKeyDown={e => e.key === 'Enter' && handleArrayAdd('steps')} />
                  <button onClick={() => handleArrayAdd('steps')} className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Plus size={20}/></button>
                </div>
                <div className="space-y-1">{data.steps?.map((s: string, i: number) => (
                  <div key={i} className="flex gap-2 items-center p-2 bg-blue-50 text-blue-900 rounded-lg text-sm">
                    <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">{i+1}</span>
                    <span className="flex-1">{s}</span>
                    <button onClick={() => handleArrayRemove('steps', i)}><X size={14} /></button>
                  </div>
                ))}</div>
             </div>
          </div>
        );

      case 'hazard-assessment':
        return (
          <div className="space-y-4">
             <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Hazard Type</label>
                <input className="w-full p-3 bg-gray-50 border rounded-xl" value={data.hazardType} onChange={e => setData({...data, hazardType: e.target.value})} />
             </div>
             <div className="grid grid-cols-3 gap-2">
                {['likelihood', 'severity', 'riskLevel'].map(field => (
                  <div key={field}>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{field}</label>
                    <select className="w-full p-2 bg-gray-50 border rounded-xl text-sm" value={data[field]} onChange={e => setData({...data, [field]: e.target.value})}>
                      <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                    </select>
                  </div>
                ))}
             </div>
             <div>
               <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Controls</label>
               <div className="flex gap-2 mb-2">
                 <input className="flex-1 p-3 bg-gray-50 border rounded-xl" value={tempItem} onChange={e => setTempItem(e.target.value)} placeholder="Add control..." onKeyDown={e => e.key === 'Enter' && handleArrayAdd('controls')} />
                 <button onClick={() => handleArrayAdd('controls')} className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Plus size={20}/></button>
               </div>
               <div className="space-y-1">{data.controls?.map((c: string, i: number) => (
                  <div key={i} className="flex justify-between p-2 bg-gray-100 rounded-lg text-sm">
                    <span>{c}</span><button onClick={() => handleArrayRemove('controls', i)}><X size={14} /></button>
                  </div>
               ))}</div>
             </div>
          </div>
        );

      case 'incident-report':
        return (
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Type</label>
                  <input className="w-full p-3 bg-gray-50 border rounded-xl" value={data.incidentType} onChange={e => setData({...data, incidentType: e.target.value})} />
                </div>
                <div>
                   <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Severity</label>
                   <select className="w-full p-3 bg-gray-50 border rounded-xl" value={data.severity} onChange={e => setData({...data, severity: e.target.value})}>
                     <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                   </select>
                </div>
             </div>
             <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
                <textarea className="w-full p-3 bg-gray-50 border rounded-xl h-20" value={data.description} onChange={e => setData({...data, description: e.target.value})} />
             </div>
             <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Immediate Actions</label>
                <textarea className="w-full p-3 bg-gray-50 border rounded-xl h-20" value={data.immediateActions} onChange={e => setData({...data, immediateActions: e.target.value})} />
             </div>
          </div>
        );

      case 'safety-inspection':
        return (
          <div className="space-y-4">
            <div>
               <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Equipment</label>
               <input className="w-full p-3 bg-gray-50 border rounded-xl" value={data.equipmentType} onChange={e => setData({...data, equipmentType: e.target.value})} />
            </div>
            <div>
               <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Checklist Items</label>
               <div className="flex gap-2 mb-2">
                 <input className="flex-1 p-3 bg-gray-50 border rounded-xl" value={tempItem} onChange={e => setTempItem(e.target.value)} placeholder="Add item..." onKeyDown={e => e.key === 'Enter' && handleArrayAdd('items')} />
                 <button onClick={() => handleArrayAdd('items')} className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Plus size={20}/></button>
               </div>
               <div className="space-y-1">{data.items?.map((item: string, i: number) => (
                  <div key={i} className="flex justify-between p-2 bg-gray-100 rounded-lg text-sm">
                    <span>{item}</span><button onClick={() => handleArrayRemove('items', i)}><X size={14} /></button>
                  </div>
               ))}</div>
            </div>
          </div>
        );

      default:
        return <div className="text-gray-400 italic">No specific fields for this component type.</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
           <h3 className="font-bold text-lg flex items-center gap-2">
             <Settings className="w-5 h-5 text-indigo-600" /> 
             Edit {COMPONENT_TEMPLATES.find(t => t.type === component.type)?.name}
           </h3>
           <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {renderContent()}
        </div>
        <div className="p-5 border-t border-gray-100 flex gap-3 bg-white">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 font-bold text-gray-700 hover:bg-gray-200">Cancel</button>
          <button onClick={() => onSave(data)} className="flex-1 py-3 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// --- SORTABLE ITEM (EDITOR CARD) ---

function SortableComponentItem1({ component, onRemove, onEdit }: { component: ComponentInstance, onRemove: () => void, onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: component.id });
  
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const template = COMPONENT_TEMPLATES.find(t => t.type === component.type);
  const Icon = template?.icon || FileText;

  // Short preview of content
  const getSummary = () => {
    if (component.type === 'text-block') return component.data.content?.substring(0, 50) + '...';
    if (component.type === 'incident-report') return `${component.data.incidentType} - ${component.data.severity}`;
    if (component.type === 'maintenance-schedule') return `ID: ${component.data.equipmentId} (Due: ${component.data.nextDue})`;
    return template?.category;
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-2xl mb-3 shadow-sm hover:border-indigo-300 transition-colors group">
      <div className="flex items-center gap-3 p-4">
        <button {...attributes} {...listeners} className="cursor-grab p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
          <GripVertical className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${template?.color}15` }}>
            <Icon className="w-5 h-5" style={{ color: template?.color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{template?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{getSummary()}</p>
          </div>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
            <button onClick={onRemove} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
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
              <p className="text-xs text-gray-500 font-medium">{component.type}</p>
            </div>
          </div>
  
          <div className="flex items-center gap-1 opacity-100 ">
            <button onClick={onToggle} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
              {component.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={onEdit} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600">
                <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onRemove} className="p-2 hover:bg-red-50 rounded-lg text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
  
        {component.expanded && (
          <div className="p-4 border-t border-gray-100 bg-white">
            {component.type === 'hazard-assessment' && <MobileHazardAssessmentPreview data={component.data} />}
            {component.type === 'operating-procedure' && <MobileOperatingProcedurePreview data={component.data} />}
            {component.type === 'maintenance-schedule' && <MobileMaintenancePreview data={component.data} />}
            {component.type === 'incident-report' && <MobileIncidentPreview data={component.data} />}
            {component.type === 'text-block' && <MobileTextPreview data={component.data} />}
            
            {!['hazard-assessment', 'operating-procedure', 'maintenance-schedule', 'incident-report', 'text-block'].includes(component.type) && (
              <p className="text-sm text-gray-500 text-center py-4 italic bg-gray-50 rounded-xl">
                Preview not available for this type
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
  

// --- MAIN BUILDER COMPONENT ---

export default function DragDropModuleBuilder() {
  const [sections, setSections] = useState<Section[]>([
    { id: 'section-1', title: 'Introduction', components: [] }
  ]);
  const [activeSectionId, setActiveSectionId] = useState<string>('section-1');
  const [previewSectionIndex, setPreviewSectionIndex] = useState(0);
  
  const [editingComponent, setEditingComponent] = useState<ComponentInstance | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingSectionTitle, setIsEditingSectionTitle] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeSection = sections.find(s => s.id === activeSectionId) || sections[0];
  
  // Handlers
  const addSection = () => {
    const newId = `section-${Date.now()}`;
    const newSection: Section = { id: newId, title: `Section ${sections.length + 1}`, components: [] };
    setSections([...sections, newSection]);
    setActiveSectionId(newId);
  };

  const deleteSection = (id: string) => {
    if (sections.length === 1) return;
    const newSections = sections.filter(s => s.id !== id);
    setSections(newSections);
    if (activeSectionId === id) setActiveSectionId(newSections[0].id);
  };

  const addComponent = (template: ComponentTemplate) => {
    const newComponent: ComponentInstance = {
      id: `${template.type}-${Date.now()}`,
      type: template.type,
      data: JSON.parse(JSON.stringify(template.defaultData))
    };
    setSections(sections.map(s => 
      s.id === activeSectionId ? { ...s, components: [...s.components, newComponent] } : s
    ));
  };

  const removeComponent = (compId: string) => {
    setSections(sections.map(s => 
      s.id === activeSectionId ? { ...s, components: s.components.filter(c => c.id !== compId) } : s
    ));
  };
  const toggleComponent = (id: string) => {
    setSections(sections.map(s => 
      s.id === activeSectionId ? { ...s, components: s.components.map(c => 
        c.id === id ? { ...c, expanded: !c.expanded } : c
      )} : s
    ));
  };

  const updateComponent = (id: string, newData: any) => {
    setSections(sections.map(s => ({
      ...s,
      components: s.components.map(c => c.id === id ? { ...c, data: newData } : c)
    })));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSections(sections.map(s => {
        if (s.id === activeSectionId) {
          const oldIndex = s.components.findIndex((item) => item.id === active.id);
          const newIndex = s.components.findIndex((item) => item.id === over.id);
          return { ...s, components: arrayMove(s.components, oldIndex, newIndex) };
        }
        return s;
      }));
    }
  };

  // Preview Render Logic
  const renderPreviewComponent = (component: ComponentInstance) => {
    switch (component.type) {
      case 'text-block': return <MobileTextPreview data={component.data} />;
      case 'maintenance-schedule': return <MobileMaintenancePreview data={component.data} />;
      case 'incident-report': return <MobileIncidentPreview data={component.data} />;
      case 'hazard-assessment': return <MobileHazardAssessmentPreview data={component.data} />;
      case 'operating-procedure': return <MobileOperatingProcedurePreview data={component.data} />;
      case 'safety-inspection': return <MobileSafetyInspectionPreview data={component.data} />;
      default: return <div className="p-4 bg-gray-100 rounded-lg text-xs text-gray-500 text-center">Preview not available</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <div className="max-w-[1600px] mx-auto lg:p-6">
        
        {/* TOP BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 bg-white m-4 p-4 rounded-3xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-4">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-3.5 rounded-2xl shadow-lg shadow-indigo-100">
                <Layout className="w-6 h-6 text-white" />
             </div>
             <div>
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">Module Builder</h1>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Training Content Creator</p>
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
                {showPreview ? <Edit2 className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                {showPreview ? 'Edit Content' : 'Preview Mobile'}
              </button>
              <button className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* LEFT: COMPONENT LIBRARY (Hidden in Preview) */}
          {!showPreview && (
            <div className="col-span-12 lg:col-span-3">
              <div className="bg-white rounded-3xl shadow-sm p-6 sticky top-6 border border-slate-200/60">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 bg-indigo-50 rounded-lg">
                    <Plus className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Library</span>
                </div>
                
                <div className="space-y-6">
                  {['content', 'safety', 'equipment'].map(cat => (
                    <div key={cat}>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 px-2">{cat}</p>
                       <div className="space-y-2">
                          {COMPONENT_TEMPLATES.filter(t => t.category === cat).map(template => (
                             <button
                               key={template.type}
                               onClick={() => addComponent(template)}
                               className="w-full flex items-center gap-3 p-3 bg-slate-50/50 hover:bg-white hover:shadow-md hover:shadow-slate-100 rounded-xl transition-all group border border-transparent hover:border-slate-100 text-left"
                             >
                               <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 group-hover:scale-110 transition-transform shrink-0" style={{ backgroundColor: `${template.color}10` }}>
                                 <template.icon className="w-4 h-4" style={{ color: template.color }} />
                               </div>
                               <span className="text-sm font-bold text-slate-700">{template.name}</span>
                             </button>
                          ))}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RIGHT: EDITOR OR PREVIEW */}
          <div className={`col-span-12 ${showPreview ? 'lg:col-span-12' : 'lg:col-span-9'}`}>
            
            {showPreview ? (
              // --- PREVIEW MODE ---
              <div className="flex justify-center py-4">
                <MobilePreviewContainer
                  title={sections[previewSectionIndex]?.title || "Module"}
                  currentSectionIndex={previewSectionIndex}
                  sections={sections}
                  onNext={() => setPreviewSectionIndex(i => Math.min(i + 1, sections.length - 1))}
                  onPrev={() => setPreviewSectionIndex(i => Math.max(i - 1, 0))}
                  onJumpTo={(i) => setPreviewSectionIndex(i)}
                >
                  {sections[previewSectionIndex].components.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                      <FileText className="w-12 h-12 mb-2 text-gray-300" />
                      <p className="text-sm font-medium text-gray-400">Empty Section</p>
                    </div>
                  ) : (
                    sections[previewSectionIndex].components.map((component, idx) => (
                      <div key={component.id} className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards" style={{ animationDelay: `${idx * 100}ms` }}>
                        {renderPreviewComponent(component)}
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
                        ${activeSectionId === section.id 
                          ? 'bg-white border-indigo-600 shadow-md shadow-indigo-100' 
                          : 'bg-white border-transparent hover:border-slate-200'
                        }
                      `}
                    >
                       <div className={`
                         w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                         ${activeSectionId === section.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}
                       `}>
                         {index + 1}
                       </div>
                       
                       {isEditingSectionTitle && activeSectionId === section.id ? (
                         <input 
                            autoFocus
                            className="w-full bg-transparent outline-none font-bold text-sm text-slate-900"
                            value={section.title}
                            onChange={(e) => {
                                setSections(sections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s));
                            }}
                            onBlur={() => setIsEditingSectionTitle(false)}
                            onKeyDown={(e) => e.key === 'Enter' && setIsEditingSectionTitle(false)}
                         />
                       ) : (
                         <span className="font-bold text-sm text-slate-700 truncate max-w-[120px]">
                           {section.title}
                         </span>
                       )}

                       {/* Hover Actions */}
                       <div className={`ml-auto flex gap-1 ${activeSectionId === section.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setIsEditingSectionTitle(true); }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {sections.length > 1 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
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
                        <h2 className="text-2xl font-black text-slate-900">{activeSection.title}</h2>
                        <p className="text-sm text-slate-400 font-medium mt-1">{activeSection.components.length} components</p>
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
                        <p className="text-lg font-bold text-slate-900">Start Building Section</p>
                        <p className="text-sm text-slate-500 mt-1">Select components from the library on the left</p>
                      </div>
                   ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={activeSection.components.map(c => c.id)}
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
                           {/* Empty overlay to maintain visual consistency during drag */}
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
          onSave={(newData) => {
            updateComponent(editingComponent.id, newData);
            setEditingComponent(null);
          }}
          onClose={() => setEditingComponent(null)}
        />
      )}
    </div>
  );
}