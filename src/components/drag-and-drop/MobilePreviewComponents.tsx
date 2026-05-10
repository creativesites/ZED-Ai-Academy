/**
 * Mobile Preview Components
 * These components render how training content will appear in the mobile app
 */

import React from 'react';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  BookOpen,
  ClipboardCheck,
  CheckCircle,
  Check,
  X,
  Volume2,
  Eye,
  HardHat,
  Wind,
  ChevronRight,
  Flame,
  Zap,
  Skull,
  Mountain,
  Construction,
  Droplets,
  Thermometer,
  Radiation,
  Truck,
  Settings,
  Wrench,
  FileText,
  Hand,
  Play,
  Mic,
  Users,
  VideoIcon,
  Video,
} from 'lucide-react';
import type { ComponentInstance, ComponentType } from './types';

// ============================================
// Content Components
// ============================================

export function MobileTextPreview({ data }: { data: any }) {
  return (
    <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
      <p className="text-sm text-gray-800 leading-7 font-sans whitespace-pre-wrap">
        {data.content}
      </p>
    </div>
  );
}

// ============================================
// Safety Components
// ============================================

export function MobileSafetyInspectionPreview({ data }: { data: any }) {
  const items = data.items || data.checklistItems || [];
  const flags = data.flags || data.criticalFlags || [];
  const hasFlags = flags.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4">
      <div className="p-4 border-b border-gray-100 bg-red-50/30">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wide flex items-center gap-2">
            <Shield className="w-4 h-4" /> Pre-Shift Inspection
          </span>
        </div>
        <div className="mt-2">
          <span className="text-[10px] font-medium bg-red-100 text-red-700 px-2 py-1 rounded-lg">
            {data.equipmentType}
          </span>
        </div>
      </div>

      {hasFlags && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-bold text-red-600">Critical Issues</span>
          </div>
          {flags.map((flag: string, i: number) => (
            <p key={i} className="text-xs text-red-700 ml-6">• {flag}</p>
          ))}
        </div>
      )}

      <div className="p-4">
        <p className="text-xs text-gray-500 mb-3 font-bold uppercase">Checklist</p>
        <div className="space-y-2">
          {items.map((item: string, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs text-gray-700">{item}</span>
              <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 flex justify-between items-center">
        <span className="text-[10px] text-gray-400">0 of {items.length} completed</span>
        {!hasFlags && (
          <span className="text-[10px] font-medium text-gray-400">Pending Inspection</span>
        )}
      </div>
    </div>
  );
}

export function MobileHazardAssessmentPreview({ data }: { data: any }) {
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

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase">Likelihood</p>
            <p className="text-xs font-bold" style={{ color: getRiskColor(data.likelihood) }}>{data.likelihood}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase">Severity</p>
            <p className="text-xs font-bold" style={{ color: getRiskColor(data.severity) }}>{data.severity}</p>
          </div>
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
            <p className="text-[10px] text-gray-400 uppercase">Risk Level</p>
            <p className="text-xs font-bold" style={{ color }}>{data.riskLevel}</p>
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

export function MobileIncidentReportPreview({ data }: { data: any }) {
  const getSeverityColor = (s: string) => {
    switch(s?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
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
        {data.rootCause && (
          <div className="p-3 bg-amber-50 rounded-xl">
            <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Root Cause</p>
            <p className="text-xs text-amber-900">{data.rootCause}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobilePermitToWorkPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-purple-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-purple-100 bg-purple-50/30">
        <span className="text-xs font-bold text-purple-600 uppercase tracking-wide flex items-center gap-2">
          <FileText className="w-4 h-4" /> Permit to Work
        </span>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase">Task</p>
            <p className="text-xs font-bold text-gray-800">{data.task}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase">Location</p>
            <p className="text-xs font-bold text-gray-800">{data.location}</p>
          </div>
        </div>

        {data.hazards?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-red-500 uppercase mb-2">Hazards</p>
            <div className="flex flex-wrap gap-1">
              {data.hazards.map((h: string, i: number) => (
                <span key={i} className="text-[10px] px-2 py-1 bg-red-50 text-red-700 rounded-full">{h}</span>
              ))}
            </div>
          </div>
        )}

        {data.approvals?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Required Approvals</p>
            <div className="space-y-1">
              {data.approvals.map((a: string, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
                  <span>{a}</span>
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Equipment Components
// ============================================

export function MobileOperatingProcedurePreview({ data }: { data: any }) {
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

export function MobileMaintenancePreview({ data }: { data: any }) {
  return (
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
              {data.defects.map((d: string, i: number) => (
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
}

export function MobileEquipmentSpecsPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-cyan-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-cyan-100 bg-cyan-50/30">
        <span className="text-xs font-bold text-cyan-600 uppercase tracking-wide flex items-center gap-2">
          <Settings className="w-4 h-4" /> Equipment Specs
        </span>
        <p className="text-sm font-bold text-gray-900 mt-2">{data.equipmentName}</p>
      </div>
      <div className="p-4">
        <div className="space-y-2">
          {Object.entries(data.specs || {}).map(([key, value], i) => (
            <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500">{key}</span>
              <span className="text-xs font-bold text-gray-800">{value as string}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobileTroubleshootingPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-orange-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-orange-100 bg-orange-50/30">
        <span className="text-xs font-bold text-orange-600 uppercase tracking-wide flex items-center gap-2">
          <Wrench className="w-4 h-4" /> Troubleshooting
        </span>
      </div>
      <div className="p-4 space-y-4">
        <div className="p-3 bg-red-50 rounded-xl border border-red-100">
          <p className="text-[10px] font-bold text-red-500 uppercase mb-1">Symptom</p>
          <p className="text-xs text-red-900">{data.symptom}</p>
        </div>

        {data.causes?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Possible Causes</p>
            <div className="space-y-1">
              {data.causes.map((c: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2 bg-yellow-50 text-yellow-900 rounded-lg">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0 text-yellow-600" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.solutions?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Solutions</p>
            <div className="space-y-1">
              {data.solutions.map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2 bg-green-50 text-green-900 rounded-lg">
                  <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-600" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Visual Safety Components (Low-Literacy)
// ============================================

export function MobileTake5SafetyPreview({ data }: { data: any }) {
  const steps = [
    { id: 1, label: 'STOP', sublabel: 'Look Around', color: '#EF4444', icon: Eye },
    { id: 2, label: 'THINK', sublabel: 'Identify Hazards', color: '#F59E0B', icon: AlertTriangle },
    { id: 3, label: 'ASSESS', sublabel: 'Evaluate Risks', color: '#3B82F6', icon: Shield },
    { id: 4, label: 'CONTROL', sublabel: 'Apply Controls', color: '#8B5CF6', icon: Wrench },
    { id: 5, label: 'PROCEED', sublabel: 'Safe to Work', color: '#10B981', icon: CheckCircle },
  ];

  return (
    <div className="bg-white rounded-2xl border border-red-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-red-100 bg-red-50/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center">
            <span className="text-xl font-black text-red-600">5</span>
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900">TAKE 5 Safety Check</span>
            <p className="text-xs text-gray-500">{data.taskName}</p>
            {data.location && <p className="text-[10px] text-gray-400">{data.location}</p>}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {steps.map((step) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.id}
                className="flex flex-col items-center p-3 rounded-xl min-w-[70px]"
                style={{ backgroundColor: `${step.color}10` }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${step.color}20` }}
                >
                  <StepIcon className="w-4 h-4" style={{ color: step.color }} />
                </div>
                <span className="text-[10px] font-bold" style={{ color: step.color }}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 flex items-center justify-center gap-2">
        <Volume2 className="w-4 h-4 text-indigo-500" />
        <span className="text-xs text-indigo-600 font-medium">Start Take 5</span>
      </div>
    </div>
  );
}

export function MobilePictogramHazardPreview({ data }: { data: any }) {
  const HAZARD_ICONS: Record<string, any> = {
    electrical: Zap,
    fire: Flame,
    toxic: Skull,
    rockfall: Mountain,
    machinery: Construction,
    vehicles: Truck,
    noise: Volume2,
    gas: Wind,
    chemical: Droplets,
    heat: Thermometer,
    radiation: Radiation,
    general: AlertTriangle,
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return '#DC2626';
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      default: return '#FBBF24';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-red-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-red-100 bg-red-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900">{data.title || 'Hazard Identification'}</span>
            {data.location && <p className="text-xs text-gray-500">{data.location}</p>}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {data.hazards?.map((hazard: any, i: number) => {
            const HazardIcon = HAZARD_ICONS[hazard.type] || AlertTriangle;
            const color = getSeverityColor(hazard.severity);
            return (
              <div
                key={i}
                className="flex flex-col items-center p-3 rounded-xl min-w-[90px] border-2"
                style={{ backgroundColor: `${color}10`, borderColor: `${color}50` }}
              >
                <div
                  className="text-[8px] font-bold px-2 py-0.5 rounded mb-2"
                  style={{ backgroundColor: color, color: '#FFF' }}
                >
                  {hazard.severity.toUpperCase()}
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${color}15` }}>
                  <HazardIcon className="w-6 h-6" style={{ color }} />
                </div>
                <span className="text-[10px] font-bold text-center" style={{ color }}>
                  {hazard.type.charAt(0).toUpperCase() + hazard.type.slice(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {data.requiredPPE?.length > 0 && (
        <div className="p-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">Required PPE</p>
          <div className="flex gap-2 flex-wrap">
            {data.requiredPPE.map((ppe: string, i: number) => (
              <span key={i} className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                {ppe}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MobilePPEVisualGuidePreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-blue-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-blue-100 bg-blue-50/30">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-2">
          <HardHat className="w-4 h-4" /> PPE Guide
        </span>
        <p className="text-sm font-bold text-gray-900 mt-2">{data.taskType?.replace(/-/g, ' ').toUpperCase()}</p>
        {data.taskDescription && <p className="text-xs text-gray-500 mt-1">{data.taskDescription}</p>}
      </div>

      <div className="p-4">
        <p className="text-[10px] font-bold text-green-600 uppercase mb-2">Required</p>
        <div className="flex gap-2 flex-wrap mb-4">
          {data.requiredPPE?.map((ppe: string, i: number) => (
            <span key={i} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200 font-medium">
              {ppe.replace(/-/g, ' ')}
            </span>
          ))}
        </div>

        {data.optionalPPE?.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Optional</p>
            <div className="flex gap-2 flex-wrap">
              {data.optionalPPE.map((ppe: string, i: number) => (
                <span key={i} className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full border border-gray-200">
                  {ppe.replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          </>
        )}

        {data.specialInstructions && (
          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-xs text-amber-800">{data.specialInstructions}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileGasTestingPreview({ data }: { data: any }) {
  const GAS_LIMITS: Record<string, { safe: number; warning: number; danger: number; unit: string }> = {
    oxygen: { safe: 19.5, warning: 23, danger: 25, unit: '%' },
    methane: { safe: 0.5, warning: 1.0, danger: 1.5, unit: '%' },
    'carbon-monoxide': { safe: 25, warning: 50, danger: 100, unit: 'ppm' },
    'hydrogen-sulfide': { safe: 5, warning: 10, danger: 15, unit: 'ppm' },
  };

  const getGasStatus = (gasType: string, value: number) => {
    const limits = GAS_LIMITS[gasType];
    if (!limits) return 'unknown';
    if (gasType === 'oxygen') {
      if (value < limits.safe || value > limits.danger) return 'danger';
      if (value > limits.warning) return 'warning';
      return 'safe';
    }
    if (value >= limits.danger) return 'danger';
    if (value >= limits.warning) return 'warning';
    return 'safe';
  };

  const statusColors = {
    safe: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
    danger: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    unknown: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  };

  return (
    <div className="bg-white rounded-2xl border border-green-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-green-100 bg-green-50/30">
        <span className="text-xs font-bold text-green-600 uppercase tracking-wide flex items-center gap-2">
          <Wind className="w-4 h-4" /> Gas Testing
        </span>
        <p className="text-sm font-medium text-gray-700 mt-1">{data.location}</p>
      </div>

      <div className="p-4 space-y-2">
        {data.readings?.map((reading: any, i: number) => {
          const status = getGasStatus(reading.gasType, reading.currentValue);
          const colors = statusColors[status];
          return (
            <div key={i} className={`flex justify-between items-center p-3 rounded-xl border ${colors.bg} ${colors.border}`}>
              <span className="text-xs font-medium text-gray-700">{reading.gasType.replace(/-/g, ' ')}</span>
              <span className={`text-sm font-bold ${colors.text}`}>
                {reading.currentValue} {reading.unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MobileEmergencyProcedurePreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-red-300 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-red-200 bg-red-100">
        <span className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Emergency: {data.emergencyType?.toUpperCase()}
        </span>
        {data.location && <p className="text-xs text-red-600 mt-1">{data.location}</p>}
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-600 text-center py-6">
          Emergency procedure steps will be displayed here with audio guidance
        </p>
      </div>
    </div>
  );
}

export function MobileRefuseUnsafeWorkPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-purple-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-purple-100 bg-purple-50/30">
        <span className="text-xs font-bold text-purple-600 uppercase tracking-wide flex items-center gap-2">
          <Hand className="w-4 h-4" /> Your Right to Refuse
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
          <p className="text-sm font-bold text-purple-900 mb-2">You have the RIGHT to refuse unsafe work</p>
          <p className="text-xs text-purple-700">If you believe work is dangerous, STOP and report to your supervisor.</p>
        </div>

        {data.safetyOfficerName && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase">Safety Officer</p>
            <p className="text-xs font-bold text-gray-800">{data.safetyOfficerName}</p>
            {data.safetyOfficerContact && (
              <p className="text-xs text-blue-600">{data.safetyOfficerContact}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Assessment Components
// ============================================

export function MobileVisualQuizPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-purple-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-purple-100 bg-purple-600">
        <span className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" /> {data.title}
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-4">{data.questions?.length || 0} questions • Pass: {data.passingScore || 70}%</p>

        {data.questions?.[0] && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">{data.questions[0].questionText}</p>
            <div className="grid grid-cols-2 gap-2">
              {data.questions[0].answers?.map((ans: any) => (
                <div
                  key={ans.id}
                  className="p-4 rounded-xl border-2 flex flex-col items-center"
                  style={{ borderColor: `${ans.color}50`, backgroundColor: `${ans.color}10` }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: ans.color }}>
                    <span className="text-white text-lg">?</span>
                  </div>
                  <span className="text-xs font-medium text-gray-700">{ans.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileSpotTheHazardPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-pink-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-pink-100 bg-pink-50/30">
        <span className="text-xs font-bold text-pink-600 uppercase tracking-wide flex items-center gap-2">
          <Eye className="w-4 h-4" /> {data.title}
        </span>
        {data.timeLimit && (
          <span className="text-[10px] text-pink-500 mt-1 block">Time limit: {data.timeLimit}s</span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-4">{data.scenes?.length || 0} scenes to complete</p>

        {data.scenes?.[0] && (
          <div className="p-6 bg-gray-100 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center mx-auto mb-2">
                <Eye className="w-8 h-8 text-pink-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">{data.scenes[0].name}</p>
              <p className="text-xs text-gray-400">Tap to find hazards</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobilePracticeProblemsPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-pink-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-pink-100 bg-gradient-to-r from-pink-50 to-white">
        <span className="text-xs font-bold text-pink-600 uppercase tracking-wide flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {data.title}
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-4">{data.problems?.length || 0} problems</p>

        {data.problems?.[0] && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">{data.problems[0].question}</p>
            {data.problems[0].options?.map((opt: string, i: number) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700">
                {opt}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Media Components
// ============================================

export function MobileYouTubeVideoPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-red-200 overflow-hidden mb-4 shadow-sm">
      <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-white text-xs">
          {data.duration || '0:00'}
        </div>
      </div>
      <div className="p-4">
        <VideoIcon className="w-5 h-5 text-red-600 mb-2" />
        <p className="text-sm font-bold text-gray-900">{data.title || 'Video Title'}</p>
        {data.description && <p className="text-xs text-gray-500 mt-1">{data.description}</p>}
      </div>
    </div>
  );
}

export function MobileDirectVideoPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-cyan-200 overflow-hidden mb-4 shadow-sm">
      <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-cyan-600 flex items-center justify-center shadow-lg">
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-white text-xs">
          {data.duration || '0:00'}
        </div>
      </div>
      <div className="p-4">
        <Video className="w-5 h-5 text-cyan-600 mb-2" />
        <p className="text-sm font-bold text-gray-900">{data.title || 'Video Title'}</p>
        {data.description && <p className="text-xs text-gray-500 mt-1">{data.description}</p>}
        {data.completionRequired && (
          <span className="text-[10px] text-orange-600 font-medium mt-2 inline-block">
            Must watch to complete
          </span>
        )}
      </div>
    </div>
  );
}

export function MobileAudioLessonPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-purple-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-purple-100 bg-purple-50/30">
        <span className="text-xs font-bold text-purple-600 uppercase tracking-wide flex items-center gap-2">
          <Mic className="w-4 h-4" /> Audio Lesson
        </span>
        <p className="text-sm font-bold text-gray-900 mt-2">{data.title}</p>
        {data.duration && <span className="text-xs text-gray-500">{data.duration}</span>}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
          </div>
          <div className="flex-1">
            <div className="h-2 bg-purple-200 rounded-full">
              <div className="h-full w-0 bg-purple-600 rounded-full" />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-purple-600">0:00</span>
              <span className="text-[10px] text-purple-600">{data.duration || '0:00'}</span>
            </div>
          </div>
        </div>

        {data.keyPoints?.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Key Points</p>
            <div className="space-y-1">
              {data.keyPoints.map((point: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <CheckCircle className="w-3 h-3 mt-0.5 text-purple-500 flex-shrink-0" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileDailyToolboxTalkPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-green-200 overflow-hidden mb-4 shadow-sm">
      <div className="p-4 border-b border-green-100 bg-green-50/30">
        <span className="text-xs font-bold text-green-600 uppercase tracking-wide flex items-center gap-2">
          <Users className="w-4 h-4" /> Toolbox Talk
        </span>
        <p className="text-[10px] text-gray-500 mt-1">
          {data.shiftType?.charAt(0).toUpperCase() + data.shiftType?.slice(1)} Shift • {data.currentDate}
        </p>
      </div>

      <div className="p-4">
        <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: `${data.topic?.color || '#10B981'}10` }}>
          <p className="text-sm font-bold text-gray-900">{data.topic?.title || 'Safety Topic'}</p>
          <p className="text-xs text-gray-600 mt-1">{data.topic?.keyMessage}</p>
        </div>

        {data.topic?.safetyPoints?.length > 0 && (
          <div className="space-y-2">
            {data.topic.safetyPoints.slice(0, 3).map((point: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <CheckCircle className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                <span>{point.text}</span>
              </div>
            ))}
          </div>
        )}

        {data.requireAcknowledgment && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700 text-center">Team acknowledgment required</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Fallback Component
// ============================================

export function MobileFallbackPreview({ component }: { component: ComponentInstance }) {
  return (
    <div className="p-4 bg-gray-100 rounded-xl mb-4">
      <p className="text-xs text-gray-500 text-center">
        Preview not available for {component.type}
      </p>
    </div>
  );
}

// ============================================
// Main Preview Renderer
// ============================================

export function renderMobilePreview(component: ComponentInstance): React.ReactNode {
  switch (component.type) {
    // Content
    case 'text-block':
      return <MobileTextPreview data={component.data} />;

    // Safety
    case 'safety-inspection':
      return <MobileSafetyInspectionPreview data={component.data} />;
    case 'hazard-assessment':
      return <MobileHazardAssessmentPreview data={component.data} />;
    case 'incident-report':
      return <MobileIncidentReportPreview data={component.data} />;
    case 'permit-to-work':
      return <MobilePermitToWorkPreview data={component.data} />;

    // Equipment
    case 'operating-procedure':
      return <MobileOperatingProcedurePreview data={component.data} />;
    case 'maintenance-schedule':
      return <MobileMaintenancePreview data={component.data} />;
    case 'equipment-specs':
      return <MobileEquipmentSpecsPreview data={component.data} />;
    case 'troubleshooting':
      return <MobileTroubleshootingPreview data={component.data} />;

    // Visual Safety
    case 'take5-safety':
      return <MobileTake5SafetyPreview data={component.data} />;
    case 'pictogram-hazard':
      return <MobilePictogramHazardPreview data={component.data} />;
    case 'ppe-visual-guide':
      return <MobilePPEVisualGuidePreview data={component.data} />;
    case 'gas-testing':
      return <MobileGasTestingPreview data={component.data} />;
    case 'refuse-unsafe-work':
      return <MobileRefuseUnsafeWorkPreview data={component.data} />;
    case 'emergency-procedure':
      return <MobileEmergencyProcedurePreview data={component.data} />;

    // Assessment
    case 'visual-quiz':
      return <MobileVisualQuizPreview data={component.data} />;
    case 'spot-the-hazard':
      return <MobileSpotTheHazardPreview data={component.data} />;
    case 'practice-problems':
      return <MobilePracticeProblemsPreview data={component.data} />;

    // Media
    case 'youtube-video':
      return <MobileYouTubeVideoPreview data={component.data} />;
    case 'direct-video':
      return <MobileDirectVideoPreview data={component.data} />;
    case 'audio-lesson':
      return <MobileAudioLessonPreview data={component.data} />;
    case 'daily-toolbox-talk':
      return <MobileDailyToolboxTalkPreview data={component.data} />;

    default:
      return <MobileFallbackPreview component={component} />;
  }
}
