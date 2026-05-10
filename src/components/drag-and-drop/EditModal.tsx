'use client';

/**
 * EditModal Component
 * Modal for editing component data with AI content generation
 */

import React, { useState } from 'react';
import {
  X, Plus, Settings, Sparkles, Loader2, AlertTriangle,
  ChevronDown, Volume2
} from 'lucide-react';
import type { ComponentInstance, ComponentData, EditModalProps, Section, ComponentType } from './types';
import { getTemplateByType } from './templates';

interface AIGenerationState {
  isGenerating: boolean;
  error: string | null;
}

export function EditModal({
  component,
  moduleContext,
  onSave,
  onClose,
  onGenerateWithAI
}: EditModalProps) {
  const [data, setData] = useState<any>(JSON.parse(JSON.stringify(component.data)));
  const [tempItem, setTempItem] = useState('');
  const [aiState, setAiState] = useState<AIGenerationState>({ isGenerating: false, error: null });
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAIPanel, setShowAIPanel] = useState(false);

  const template = getTemplateByType(component.type);

  // Handle array field add
  const handleArrayAdd = (field: string) => {
    if (!tempItem.trim()) return;
    setData({ ...data, [field]: [...(data[field] || []), tempItem] });
    setTempItem('');
  };

  // Handle array field remove
  const handleArrayRemove = (field: string, index: number) => {
    setData({ ...data, [field]: data[field].filter((_: any, i: number) => i !== index) });
  };

  // Handle nested object array add (for specs)
  const handleSpecAdd = (key: string, value: string) => {
    if (!key.trim() || !value.trim()) return;
    setData({ ...data, specs: { ...data.specs, [key]: value } });
  };

  // Handle nested object remove
  const handleSpecRemove = (key: string) => {
    const newSpecs = { ...data.specs };
    delete newSpecs[key];
    setData({ ...data, specs: newSpecs });
  };

  // AI Generation handler
  const handleAIGenerate = async () => {
    if (!onGenerateWithAI || !moduleContext) {
      setAiState({ isGenerating: false, error: 'AI generation not available' });
      return;
    }

    setAiState({ isGenerating: true, error: null });

    try {
      // Build context from existing module content
      const existingContent: string[] = [];
      moduleContext.sections.forEach((section) => {
        section.components.forEach((comp) => {
          if (comp.type === 'text-block' && 'content' in comp.data && comp.data.content) {
            existingContent.push(comp.data.content as string);
          }
        });
      });

      const currentSectionTitle = moduleContext.sections.find(s =>
        s.components.some(c => c.id === component.id)
      )?.title || 'Unknown Section';

      const generatedData = await onGenerateWithAI({
        componentType: component.type,
        moduleTitle: moduleContext.title,
        moduleDescription: moduleContext.description,
        existingContent,
        currentSectionTitle,
        specificPrompt: aiPrompt || undefined,
      });

      setData(generatedData);
      setShowAIPanel(false);
      setAiPrompt('');
    } catch (error) {
      setAiState({
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Failed to generate content'
      });
    } finally {
      setAiState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  // Render field editor based on component type
  const renderFieldEditor = () => {
    switch (component.type) {
      case 'text-block':
        return (
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Content</label>
            <textarea
              className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 h-40 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              value={data.content}
              onChange={e => setData({ ...data, content: e.target.value })}
              placeholder="Enter text content..."
            />
          </div>
        );

      case 'safety-inspection':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Equipment Type</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={data.equipmentType}
                onChange={e => setData({ ...data, equipmentType: e.target.value })}
                placeholder="e.g., LHD Loader, Dump Truck"
              />
            </div>
            <ArrayFieldEditor
              label="Checklist Items"
              items={data.items || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('items')}
              onRemove={(i) => handleArrayRemove('items', i)}
              placeholder="Add inspection item..."
              itemStyle="bg-gray-100"
            />
            <ArrayFieldEditor
              label="Critical Flags (Issues that prevent operation)"
              items={data.flags || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('flags')}
              onRemove={(i) => handleArrayRemove('flags', i)}
              placeholder="Add critical flag..."
              itemStyle="bg-red-50 text-red-700"
            />
          </div>
        );

      case 'hazard-assessment':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Hazard Type</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={data.hazardType}
                onChange={e => setData({ ...data, hazardType: e.target.value })}
                placeholder="e.g., Falling Rocks, Electrical Hazard"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <SelectField
                label="Likelihood"
                value={data.likelihood}
                onChange={v => setData({ ...data, likelihood: v })}
                options={['Low', 'Medium', 'High', 'Critical']}
              />
              <SelectField
                label="Severity"
                value={data.severity}
                onChange={v => setData({ ...data, severity: v })}
                options={['Low', 'Medium', 'High', 'Critical']}
              />
              <SelectField
                label="Risk Level"
                value={data.riskLevel}
                onChange={v => setData({ ...data, riskLevel: v })}
                options={['Low', 'Medium', 'High', 'Critical']}
              />
            </div>
            <ArrayFieldEditor
              label="Control Measures"
              items={data.controls || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('controls')}
              onRemove={(i) => handleArrayRemove('controls', i)}
              placeholder="Add control measure..."
              itemStyle="bg-green-50 text-green-800"
            />
          </div>
        );

      case 'incident-report':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Incident Type</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.incidentType}
                  onChange={e => setData({ ...data, incidentType: e.target.value })}
                  placeholder="e.g., Near Miss, Injury"
                />
              </div>
              <SelectField
                label="Severity"
                value={data.severity}
                onChange={v => setData({ ...data, severity: v })}
                options={['Low', 'Medium', 'High', 'Critical']}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-24 resize-none"
                value={data.description}
                onChange={e => setData({ ...data, description: e.target.value })}
                placeholder="Describe what happened..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Immediate Actions Taken</label>
              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-20 resize-none"
                value={data.immediateActions}
                onChange={e => setData({ ...data, immediateActions: e.target.value })}
                placeholder="What was done immediately after..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Root Cause (Optional)</label>
              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-20 resize-none"
                value={data.rootCause || ''}
                onChange={e => setData({ ...data, rootCause: e.target.value })}
                placeholder="Why did this happen..."
              />
            </div>
          </div>
        );

      case 'permit-to-work':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Task</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.task}
                  onChange={e => setData({ ...data, task: e.target.value })}
                  placeholder="e.g., Hot Work - Welding"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Location</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.location}
                  onChange={e => setData({ ...data, location: e.target.value })}
                  placeholder="e.g., Workshop Bay 3"
                />
              </div>
            </div>
            <ArrayFieldEditor
              label="Hazards"
              items={data.hazards || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('hazards')}
              onRemove={(i) => handleArrayRemove('hazards', i)}
              placeholder="Add hazard..."
              itemStyle="bg-red-50 text-red-700"
            />
            <ArrayFieldEditor
              label="Controls"
              items={data.controls || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('controls')}
              onRemove={(i) => handleArrayRemove('controls', i)}
              placeholder="Add control..."
              itemStyle="bg-green-50 text-green-800"
            />
            <ArrayFieldEditor
              label="Required Approvals"
              items={data.approvals || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('approvals')}
              onRemove={(i) => handleArrayRemove('approvals', i)}
              placeholder="Add approval role..."
              itemStyle="bg-blue-50 text-blue-700"
            />
          </div>
        );

      case 'operating-procedure':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Equipment Type</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.equipmentType}
                onChange={e => setData({ ...data, equipmentType: e.target.value })}
                placeholder="e.g., Drill Rig, LHD Loader"
              />
            </div>
            <ArrayFieldEditor
              label="Operating Steps"
              items={data.steps || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('steps')}
              onRemove={(i) => handleArrayRemove('steps', i)}
              placeholder="Add step..."
              itemStyle="bg-blue-50 text-blue-900"
              showNumbers
            />
          </div>
        );

      case 'maintenance-schedule':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Equipment ID</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.equipmentId}
                  onChange={e => setData({ ...data, equipmentId: e.target.value })}
                  placeholder="e.g., EQ-2024-001"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Last Service</label>
                <input
                  type="date"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.lastService}
                  onChange={e => setData({ ...data, lastService: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Next Due</label>
              <input
                type="date"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.nextDue}
                onChange={e => setData({ ...data, nextDue: e.target.value })}
              />
            </div>
            <ArrayFieldEditor
              label="Reported Defects"
              items={data.defects || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('defects')}
              onRemove={(i) => handleArrayRemove('defects', i)}
              placeholder="Add defect..."
              itemStyle="bg-red-50 text-red-700"
            />
          </div>
        );

      case 'equipment-specs':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Equipment Name</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.equipmentName}
                onChange={e => setData({ ...data, equipmentName: e.target.value })}
                placeholder="e.g., CAT 785D Mining Truck"
              />
            </div>
            <SpecsEditor
              specs={data.specs || {}}
              onAdd={handleSpecAdd}
              onRemove={handleSpecRemove}
            />
          </div>
        );

      case 'troubleshooting':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Symptom</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.symptom}
                onChange={e => setData({ ...data, symptom: e.target.value })}
                placeholder="e.g., Engine fails to start"
              />
            </div>
            <ArrayFieldEditor
              label="Possible Causes"
              items={data.causes || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('causes')}
              onRemove={(i) => handleArrayRemove('causes', i)}
              placeholder="Add possible cause..."
              itemStyle="bg-yellow-50 text-yellow-800"
            />
            <ArrayFieldEditor
              label="Solutions"
              items={data.solutions || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('solutions')}
              onRemove={(i) => handleArrayRemove('solutions', i)}
              placeholder="Add solution..."
              itemStyle="bg-green-50 text-green-800"
            />
          </div>
        );

      case 'take5-safety':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Task Name</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.taskName}
                  onChange={e => setData({ ...data, taskName: e.target.value })}
                  placeholder="e.g., Loading Ore"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Location</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.location || ''}
                  onChange={e => setData({ ...data, location: e.target.value })}
                  placeholder="e.g., Pit Level 4"
                />
              </div>
            </div>
            <ArrayFieldEditor
              label="Hazards Identified (Examples)"
              items={data.hazardsIdentified || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('hazardsIdentified')}
              onRemove={(i) => handleArrayRemove('hazardsIdentified', i)}
              placeholder="Add example hazard..."
              itemStyle="bg-red-50 text-red-700"
            />
            <ArrayFieldEditor
              label="Controls Applied (Examples)"
              items={data.controlsApplied || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('controlsApplied')}
              onRemove={(i) => handleArrayRemove('controlsApplied', i)}
              placeholder="Add example control..."
              itemStyle="bg-green-50 text-green-800"
            />
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="audioEnabled"
                checked={data.audioEnabled !== false}
                onChange={e => setData({ ...data, audioEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="audioEnabled" className="text-sm text-gray-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                Enable Audio Guidance
              </label>
            </div>
          </div>
        );

      case 'youtube-video':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">YouTube URL</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.videoUrl}
                onChange={e => setData({ ...data, videoUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Title</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.title || ''}
                onChange={e => setData({ ...data, title: e.target.value })}
                placeholder="Video title"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-20 resize-none"
                value={data.description || ''}
                onChange={e => setData({ ...data, description: e.target.value })}
                placeholder="Brief description..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Duration</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.duration || ''}
                onChange={e => setData({ ...data, duration: e.target.value })}
                placeholder="e.g., 5:30"
              />
            </div>
          </div>
        );

      case 'audio-lesson':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Title</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.title}
                onChange={e => setData({ ...data, title: e.target.value })}
                placeholder="Lesson title"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Transcript (Text-to-Speech)</label>
              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-32 resize-none"
                value={data.transcript}
                onChange={e => setData({ ...data, transcript: e.target.value })}
                placeholder="Enter the text that will be spoken..."
              />
            </div>
            <ArrayFieldEditor
              label="Key Points"
              items={data.keyPoints || []}
              tempItem={tempItem}
              setTempItem={setTempItem}
              onAdd={() => handleArrayAdd('keyPoints')}
              onRemove={(i) => handleArrayRemove('keyPoints', i)}
              placeholder="Add key point..."
              itemStyle="bg-purple-50 text-purple-800"
            />
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Duration</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.duration || ''}
                onChange={e => setData({ ...data, duration: e.target.value })}
                placeholder="e.g., 3:00"
              />
            </div>
          </div>
        );

      case 'pictogram-hazard':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Title</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.title}
                  onChange={e => setData({ ...data, title: e.target.value })}
                  placeholder="e.g., Work Area Hazards"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Location</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.location || ''}
                  onChange={e => setData({ ...data, location: e.target.value })}
                  placeholder="e.g., Underground Level 3"
                />
              </div>
            </div>
            <HazardListEditor
              hazards={data.hazards || []}
              onChange={(hazards) => setData({ ...data, hazards })}
            />
            <PPESelector
              label="Required PPE"
              selected={data.requiredPPE || []}
              onChange={(requiredPPE) => setData({ ...data, requiredPPE })}
            />
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="audioEnabled"
                checked={data.audioEnabled !== false}
                onChange={e => setData({ ...data, audioEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="audioEnabled" className="text-sm text-gray-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                Enable Audio Guidance
              </label>
            </div>
          </div>
        );

      case 'ppe-visual-guide':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Task Type"
                value={data.taskType || 'general'}
                onChange={v => setData({ ...data, taskType: v })}
                options={['general', 'drilling', 'blasting', 'welding', 'grinding', 'confined-space', 'chemical-handling', 'electrical']}
              />
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Task Description</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.taskDescription || ''}
                  onChange={e => setData({ ...data, taskDescription: e.target.value })}
                  placeholder="e.g., Underground drilling operations"
                />
              </div>
            </div>
            <PPESelector
              label="Required PPE"
              selected={data.requiredPPE || []}
              onChange={(requiredPPE) => setData({ ...data, requiredPPE })}
            />
            <PPESelector
              label="Optional PPE"
              selected={data.optionalPPE || []}
              onChange={(optionalPPE) => setData({ ...data, optionalPPE })}
            />
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Special Instructions</label>
              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-20 resize-none"
                value={data.specialInstructions || ''}
                onChange={e => setData({ ...data, specialInstructions: e.target.value })}
                placeholder="Any special requirements..."
              />
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="audioEnabled"
                checked={data.audioEnabled !== false}
                onChange={e => setData({ ...data, audioEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="audioEnabled" className="text-sm text-gray-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                Enable Audio Guidance
              </label>
            </div>
          </div>
        );

      case 'gas-testing':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Location</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.location || ''}
                onChange={e => setData({ ...data, location: e.target.value })}
                placeholder="e.g., Stope 4, Level 6"
              />
            </div>
            <GasReadingsEditor
              readings={data.readings || []}
              onChange={(readings) => setData({ ...data, readings })}
            />
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="testRequired"
                checked={data.testRequired !== false}
                onChange={e => setData({ ...data, testRequired: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="testRequired" className="text-sm text-gray-700">
                Test Required Before Entry
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="showSimulation"
                checked={data.showSimulation === true}
                onChange={e => setData({ ...data, showSimulation: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="showSimulation" className="text-sm text-gray-700">
                Show Interactive Simulation
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="audioEnabled"
                checked={data.audioEnabled !== false}
                onChange={e => setData({ ...data, audioEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="audioEnabled" className="text-sm text-gray-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                Enable Audio Guidance
              </label>
            </div>
          </div>
        );

      case 'refuse-unsafe-work':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Company Name</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.companyName || ''}
                onChange={e => setData({ ...data, companyName: e.target.value })}
                placeholder="e.g., Mining Company Ltd"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Safety Officer Name</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.safetyOfficerName || ''}
                  onChange={e => setData({ ...data, safetyOfficerName: e.target.value })}
                  placeholder="e.g., John Safety"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Safety Officer Contact</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.safetyOfficerContact || ''}
                  onChange={e => setData({ ...data, safetyOfficerContact: e.target.value })}
                  placeholder="+260 XXX XXX XXX"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">MSD Hotline (National Safety Line)</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.msdHotline || ''}
                onChange={e => setData({ ...data, msdHotline: e.target.value })}
                placeholder="+260 XXX XXX XXX"
              />
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="audioEnabled"
                checked={data.audioEnabled !== false}
                onChange={e => setData({ ...data, audioEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="audioEnabled" className="text-sm text-gray-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                Enable Audio Guidance
              </label>
            </div>
          </div>
        );

      case 'emergency-procedure':
        return (
          <div className="space-y-4">
            <SelectField
              label="Emergency Type"
              value={data.emergencyType || 'fire'}
              onChange={v => setData({ ...data, emergencyType: v })}
              options={['fire', 'evacuation', 'medical', 'gas-leak', 'rockfall', 'flood', 'chemical-spill', 'electrical']}
            />
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Location</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.location || ''}
                onChange={e => setData({ ...data, location: e.target.value })}
                placeholder="e.g., Underground Workshop"
              />
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="audioEnabled"
                checked={data.audioEnabled !== false}
                onChange={e => setData({ ...data, audioEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="audioEnabled" className="text-sm text-gray-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                Enable Audio Guidance
              </label>
            </div>
          </div>
        );

      case 'visual-quiz':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Quiz Title</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.title || ''}
                onChange={e => setData({ ...data, title: e.target.value })}
                placeholder="e.g., Safety Sign Recognition"
              />
            </div>
            <VisualQuizQuestionsEditor
              questions={data.questions || []}
              onChange={(questions) => setData({ ...data, questions })}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Passing Score (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.passingScore || 70}
                  onChange={e => setData({ ...data, passingScore: parseInt(e.target.value) || 70 })}
                />
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <input
                  type="checkbox"
                  id="showLabels"
                  checked={data.showLabels !== false}
                  onChange={e => setData({ ...data, showLabels: e.target.checked })}
                  className="w-4 h-4 text-indigo-600"
                />
                <label htmlFor="showLabels" className="text-sm text-gray-700">
                  Show Answer Labels
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="audioEnabled"
                checked={data.audioEnabled !== false}
                onChange={e => setData({ ...data, audioEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="audioEnabled" className="text-sm text-gray-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                Enable Audio Guidance
              </label>
            </div>
          </div>
        );

      case 'spot-the-hazard':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Title</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.title || ''}
                onChange={e => setData({ ...data, title: e.target.value })}
                placeholder="e.g., Find the Safety Hazards"
              />
            </div>
            <SpotHazardScenesEditor
              scenes={data.scenes || []}
              onChange={(scenes) => setData({ ...data, scenes })}
            />
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Time Limit (seconds)</label>
              <input
                type="number"
                min="30"
                max="600"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.timeLimit || 120}
                onChange={e => setData({ ...data, timeLimit: parseInt(e.target.value) || 120 })}
              />
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="audioEnabled"
                checked={data.audioEnabled !== false}
                onChange={e => setData({ ...data, audioEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600"
              />
              <label htmlFor="audioEnabled" className="text-sm text-gray-700 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                Enable Audio Guidance
              </label>
            </div>
          </div>
        );

      case 'practice-problems':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Title</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.title || ''}
                onChange={e => setData({ ...data, title: e.target.value })}
                placeholder="e.g., Safety Knowledge Check"
              />
            </div>
            <PracticeProblemsEditor
              problems={data.problems || []}
              onChange={(problems) => setData({ ...data, problems })}
            />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl flex-1">
                <input
                  type="checkbox"
                  id="shuffleProblems"
                  checked={data.shuffleProblems === true}
                  onChange={e => setData({ ...data, shuffleProblems: e.target.checked })}
                  className="w-4 h-4 text-indigo-600"
                />
                <label htmlFor="shuffleProblems" className="text-sm text-gray-700">
                  Shuffle Questions
                </label>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl flex-1">
                <input
                  type="checkbox"
                  id="showHints"
                  checked={data.showHints !== false}
                  onChange={e => setData({ ...data, showHints: e.target.checked })}
                  className="w-4 h-4 text-indigo-600"
                />
                <label htmlFor="showHints" className="text-sm text-gray-700">
                  Show Hints
                </label>
              </div>
            </div>
          </div>
        );

      case 'direct-video':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Video URL (MP4)</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.videoUrl || ''}
                onChange={e => setData({ ...data, videoUrl: e.target.value })}
                placeholder="https://example.com/video.mp4"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Title</label>
              <input
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                value={data.title || ''}
                onChange={e => setData({ ...data, title: e.target.value })}
                placeholder="Video title"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
              <textarea
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-20 resize-none"
                value={data.description || ''}
                onChange={e => setData({ ...data, description: e.target.value })}
                placeholder="Brief description..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Duration</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.duration || ''}
                  onChange={e => setData({ ...data, duration: e.target.value })}
                  placeholder="e.g., 5:00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Thumbnail URL</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.thumbnailUrl || ''}
                  onChange={e => setData({ ...data, thumbnailUrl: e.target.value })}
                  placeholder="https://example.com/thumb.jpg"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl flex-1">
                <input
                  type="checkbox"
                  id="completionRequired"
                  checked={data.completionRequired !== false}
                  onChange={e => setData({ ...data, completionRequired: e.target.checked })}
                  className="w-4 h-4 text-indigo-600"
                />
                <label htmlFor="completionRequired" className="text-sm text-gray-700">
                  Must Watch to Complete
                </label>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl flex-1">
                <input
                  type="checkbox"
                  id="downloadable"
                  checked={data.downloadable === true}
                  onChange={e => setData({ ...data, downloadable: e.target.checked })}
                  className="w-4 h-4 text-indigo-600"
                />
                <label htmlFor="downloadable" className="text-sm text-gray-700">
                  Allow Download
                </label>
              </div>
            </div>
          </div>
        );

      case 'daily-toolbox-talk':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Shift Type"
                value={data.shiftType || 'day'}
                onChange={v => setData({ ...data, shiftType: v })}
                options={['day', 'night', 'afternoon']}
              />
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.currentDate || new Date().toISOString().split('T')[0]}
                  onChange={e => setData({ ...data, currentDate: e.target.value })}
                />
              </div>
            </div>
            <ToolboxTopicEditor
              topic={data.topic || {}}
              onChange={(topic) => setData({ ...data, topic })}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Supervisor Name</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.supervisorName || ''}
                  onChange={e => setData({ ...data, supervisorName: e.target.value })}
                  placeholder="e.g., John Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Team Name</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  value={data.teamName || ''}
                  onChange={e => setData({ ...data, teamName: e.target.value })}
                  placeholder="e.g., Alpha Crew"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl flex-1">
                <input
                  type="checkbox"
                  id="requireAcknowledgment"
                  checked={data.requireAcknowledgment !== false}
                  onChange={e => setData({ ...data, requireAcknowledgment: e.target.checked })}
                  className="w-4 h-4 text-indigo-600"
                />
                <label htmlFor="requireAcknowledgment" className="text-sm text-gray-700">
                  Require Acknowledgment
                </label>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl flex-1">
                <input
                  type="checkbox"
                  id="audioEnabled"
                  checked={data.audioEnabled !== false}
                  onChange={e => setData({ ...data, audioEnabled: e.target.checked })}
                  className="w-4 h-4 text-indigo-600"
                />
                <label htmlFor="audioEnabled" className="text-sm text-gray-700 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  Audio
                </label>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-6 text-center bg-gray-50 rounded-xl">
            <AlertTriangle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Editor not available for this component type.</p>
            <p className="text-xs text-gray-400 mt-1">Component type: {component.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Edit {template?.name || 'Component'}
          </h3>
          <div className="flex items-center gap-2">
            {onGenerateWithAI && moduleContext && (
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  showAIPanel
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                AI Generate
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* AI Panel */}
        {showAIPanel && onGenerateWithAI && moduleContext && (
          <div className="p-4 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Sparkles className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-violet-900 mb-1">Generate Content with AI</h4>
                <p className="text-xs text-violet-700 mb-3">
                  AI will use your module title, description, and existing content to generate relevant {template?.name.toLowerCase()} content.
                </p>
                <textarea
                  className="w-full p-3 bg-white border border-violet-200 rounded-xl text-sm resize-none mb-3 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  rows={2}
                  placeholder="(Optional) Add specific instructions for AI..."
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                />
                {aiState.error && (
                  <p className="text-xs text-red-600 mb-2">{aiState.error}</p>
                )}
                <button
                  onClick={handleAIGenerate}
                  disabled={aiState.isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiState.isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Content
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {renderFieldEditor()}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-3 bg-white">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(data)}
            className="flex-1 py-3 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sub-Components
// ============================================

function ArrayFieldEditor({
  label,
  items,
  tempItem,
  setTempItem,
  onAdd,
  onRemove,
  placeholder,
  itemStyle,
  showNumbers,
}: {
  label: string;
  items: string[];
  tempItem: string;
  setTempItem: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  placeholder: string;
  itemStyle: string;
  showNumbers?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase text-gray-500 mb-2">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          value={tempItem}
          onChange={e => setTempItem(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
        />
        <button
          onClick={onAdd}
          className="p-3 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-3 rounded-lg text-sm ${itemStyle}`}
          >
            {showNumbers && (
              <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-800 flex-shrink-0">
                {i + 1}
              </span>
            )}
            <span className="flex-1">{item}</span>
            <button
              onClick={() => onRemove(i)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{label}</label>
      <select
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function SpecsEditor({
  specs,
  onAdd,
  onRemove,
}: {
  specs: Record<string, string>;
  onAdd: (key: string, value: string) => void;
  onRemove: (key: string) => void;
}) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    onAdd(newKey, newValue);
    setNewKey('');
    setNewValue('');
  };

  return (
    <div>
      <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Specifications</label>
      <div className="flex gap-2 mb-2">
        <input
          className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
          placeholder="Spec name..."
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
        />
        <input
          className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
          placeholder="Value..."
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="p-3 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="space-y-1">
        {Object.entries(specs).map(([key, value]) => (
          <div
            key={key}
            className="flex items-center justify-between p-3 bg-cyan-50 rounded-lg text-sm"
          >
            <span className="text-cyan-800">
              <span className="font-medium">{key}:</span> {value}
            </span>
            <button
              onClick={() => onRemove(key)}
              className="text-cyan-400 hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// PPE item options
const PPE_OPTIONS = [
  { id: 'hardhat', label: 'Hard Hat', icon: '🪖' },
  { id: 'safety-glasses', label: 'Safety Glasses', icon: '🥽' },
  { id: 'ear-protection', label: 'Ear Protection', icon: '🎧' },
  { id: 'dust-mask', label: 'Dust Mask', icon: '😷' },
  { id: 'respirator', label: 'Respirator', icon: '🫁' },
  { id: 'safety-gloves', label: 'Safety Gloves', icon: '🧤' },
  { id: 'steel-toe-boots', label: 'Steel Toe Boots', icon: '🥾' },
  { id: 'high-vis-vest', label: 'High-Vis Vest', icon: '🦺' },
  { id: 'face-shield', label: 'Face Shield', icon: '🛡️' },
  { id: 'fall-harness', label: 'Fall Harness', icon: '🪢' },
  { id: 'chemical-suit', label: 'Chemical Suit', icon: '🥼' },
  { id: 'welding-mask', label: 'Welding Mask', icon: '⚡' },
];

function PPESelector({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const togglePPE = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(p => p !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div>
      <label className="block text-xs font-bold uppercase text-gray-500 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {PPE_OPTIONS.map(ppe => (
          <button
            key={ppe.id}
            type="button"
            onClick={() => togglePPE(ppe.id)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
              selected.includes(ppe.id)
                ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
            }`}
          >
            <span>{ppe.icon}</span>
            <span>{ppe.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Hazard types for pictogram
const HAZARD_TYPES = [
  'rockfall', 'noise', 'vehicles', 'electrical', 'chemical', 'fire',
  'explosion', 'confined-space', 'fall', 'machinery', 'dust', 'radiation'
];

function HazardListEditor({
  hazards,
  onChange,
}: {
  hazards: Array<{ type: string; severity: string; customDescription?: string }>;
  onChange: (hazards: Array<{ type: string; severity: string; customDescription?: string }>) => void;
}) {
  const [newType, setNewType] = useState('rockfall');
  const [newSeverity, setNewSeverity] = useState('medium');
  const [newDesc, setNewDesc] = useState('');

  const addHazard = () => {
    onChange([...hazards, { type: newType, severity: newSeverity, customDescription: newDesc }]);
    setNewDesc('');
  };

  const removeHazard = (index: number) => {
    onChange(hazards.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Hazards</label>
      <div className="flex gap-2 mb-2">
        <select
          className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={newType}
          onChange={e => setNewType(e.target.value)}
        >
          {HAZARD_TYPES.map(t => (
            <option key={t} value={t}>{t.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
        <select
          className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={newSeverity}
          onChange={e => setNewSeverity(e.target.value)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          placeholder="Description..."
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
        />
        <button onClick={addHazard} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
          <Plus size={18} />
        </button>
      </div>
      <div className="space-y-1">
        {hazards.map((h, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-red-50 rounded-lg text-sm">
            <span className="text-red-800">
              <span className="font-medium capitalize">{h.type.replace('-', ' ')}</span>
              <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                h.severity === 'high' ? 'bg-red-200' : h.severity === 'medium' ? 'bg-yellow-200' : 'bg-green-200'
              }`}>{h.severity}</span>
              {h.customDescription && <span className="ml-2 text-red-600">- {h.customDescription}</span>}
            </span>
            <button onClick={() => removeHazard(i)} className="text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gas types and thresholds
const GAS_TYPES = [
  { id: 'oxygen', label: 'Oxygen (O₂)', unit: '%', safeMin: 19.5, safeMax: 23.5 },
  { id: 'methane', label: 'Methane (CH₄)', unit: '%', safeMax: 1.0 },
  { id: 'carbon-monoxide', label: 'Carbon Monoxide (CO)', unit: 'ppm', safeMax: 25 },
  { id: 'hydrogen-sulfide', label: 'Hydrogen Sulfide (H₂S)', unit: 'ppm', safeMax: 10 },
  { id: 'nitrogen-dioxide', label: 'Nitrogen Dioxide (NO₂)', unit: 'ppm', safeMax: 3 },
];

function GasReadingsEditor({
  readings,
  onChange,
}: {
  readings: Array<{ gasType: string; currentValue: number; unit: string }>;
  onChange: (readings: Array<{ gasType: string; currentValue: number; unit: string }>) => void;
}) {
  const [newGas, setNewGas] = useState('oxygen');
  const [newValue, setNewValue] = useState('20.9');

  const addReading = () => {
    const gasInfo = GAS_TYPES.find(g => g.id === newGas);
    onChange([...readings, { gasType: newGas, currentValue: parseFloat(newValue), unit: gasInfo?.unit || '%' }]);
    setNewValue('');
  };

  const removeReading = (index: number) => {
    onChange(readings.filter((_, i) => i !== index));
  };

  const updateReading = (index: number, value: number) => {
    const updated = [...readings];
    updated[index].currentValue = value;
    onChange(updated);
  };

  return (
    <div>
      <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Gas Readings</label>
      <div className="flex gap-2 mb-2">
        <select
          className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          value={newGas}
          onChange={e => setNewGas(e.target.value)}
        >
          {GAS_TYPES.map(g => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
        <input
          type="number"
          step="0.1"
          className="w-24 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          placeholder="Value"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
        />
        <button onClick={addReading} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200">
          <Plus size={18} />
        </button>
      </div>
      <div className="space-y-2">
        {readings.map((r, i) => {
          const gasInfo = GAS_TYPES.find(g => g.id === r.gasType);
          return (
            <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium w-40">{gasInfo?.label || r.gasType}</span>
              <input
                type="number"
                step="0.1"
                className="w-20 p-1 bg-white border border-gray-200 rounded text-sm text-center"
                value={r.currentValue}
                onChange={e => updateReading(i, parseFloat(e.target.value))}
              />
              <span className="text-xs text-gray-500">{r.unit}</span>
              <button onClick={() => removeReading(i)} className="ml-auto text-gray-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisualQuizQuestionsEditor({
  questions,
  onChange,
}: {
  questions: any[];
  onChange: (questions: any[]) => void;
}) {
  const addQuestion = () => {
    const newQ = {
      id: `q${Date.now()}`,
      questionText: 'New Question',
      answers: [
        { id: 'a1', icon: 'checkmark-circle', iconType: 'ionicon', label: 'Option 1', color: '#10B981' },
        { id: 'a2', icon: 'close-circle', iconType: 'ionicon', label: 'Option 2', color: '#EF4444' },
      ],
      correctAnswerId: 'a1',
      explanation: '',
    };
    onChange([...questions, newQ]);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-bold uppercase text-gray-500">Questions ({questions.length})</label>
        <button onClick={addQuestion} className="flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-600 rounded-lg text-xs hover:bg-violet-200">
          <Plus size={14} /> Add Question
        </button>
      </div>
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {questions.map((q, i) => (
          <div key={q.id} className="p-3 bg-violet-50 rounded-xl border border-violet-200">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-bold text-violet-600">Q{i + 1}</span>
              <button onClick={() => removeQuestion(i)} className="text-violet-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
            <input
              className="w-full p-2 bg-white border border-violet-200 rounded-lg text-sm mb-2"
              value={q.questionText}
              onChange={e => updateQuestion(i, 'questionText', e.target.value)}
              placeholder="Question text..."
            />
            <textarea
              className="w-full p-2 bg-white border border-violet-200 rounded-lg text-xs resize-none"
              rows={2}
              value={q.explanation || ''}
              onChange={e => updateQuestion(i, 'explanation', e.target.value)}
              placeholder="Explanation after answer..."
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SpotHazardScenesEditor({
  scenes,
  onChange,
}: {
  scenes: any[];
  onChange: (scenes: any[]) => void;
}) {
  const addScene = () => {
    const newScene = {
      id: `scene${Date.now()}`,
      name: 'New Scene',
      description: '',
      sceneIcon: 'construct',
      sceneColor: '#F59E0B',
      hazards: [],
    };
    onChange([...scenes, newScene]);
  };

  const removeScene = (index: number) => {
    onChange(scenes.filter((_, i) => i !== index));
  };

  const updateScene = (index: number, field: string, value: any) => {
    const updated = [...scenes];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-bold uppercase text-gray-500">Scenes ({scenes.length})</label>
        <button onClick={addScene} className="flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-600 rounded-lg text-xs hover:bg-pink-200">
          <Plus size={14} /> Add Scene
        </button>
      </div>
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {scenes.map((scene, i) => (
          <div key={scene.id} className="p-3 bg-pink-50 rounded-xl border border-pink-200">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-bold text-pink-600">Scene {i + 1}</span>
              <button onClick={() => removeScene(i)} className="text-pink-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
            <input
              className="w-full p-2 bg-white border border-pink-200 rounded-lg text-sm mb-2"
              value={scene.name}
              onChange={e => updateScene(i, 'name', e.target.value)}
              placeholder="Scene name..."
            />
            <textarea
              className="w-full p-2 bg-white border border-pink-200 rounded-lg text-xs resize-none"
              rows={2}
              value={scene.description || ''}
              onChange={e => updateScene(i, 'description', e.target.value)}
              placeholder="Scene description..."
            />
            <div className="mt-2 text-xs text-pink-600">
              {scene.hazards?.length || 0} hazards defined
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PracticeProblemsEditor({
  problems,
  onChange,
}: {
  problems: any[];
  onChange: (problems: any[]) => void;
}) {
  const addProblem = () => {
    const newP = {
      id: `p${Date.now()}`,
      question: 'New Question',
      type: 'multiple_choice',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: '',
      difficulty: 'medium',
    };
    onChange([...problems, newP]);
  };

  const removeProblem = (index: number) => {
    onChange(problems.filter((_, i) => i !== index));
  };

  const updateProblem = (index: number, field: string, value: any) => {
    const updated = [...problems];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-bold uppercase text-gray-500">Problems ({problems.length})</label>
        <button onClick={addProblem} className="flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-600 rounded-lg text-xs hover:bg-pink-200">
          <Plus size={14} /> Add Problem
        </button>
      </div>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {problems.map((p, i) => (
          <div key={p.id} className="p-3 bg-pink-50 rounded-xl border border-pink-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-pink-600">#{i + 1}</span>
                <select
                  className="text-xs p-1 bg-white border border-pink-200 rounded"
                  value={p.difficulty || 'medium'}
                  onChange={e => updateProblem(i, 'difficulty', e.target.value)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <button onClick={() => removeProblem(i)} className="text-pink-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
            <textarea
              className="w-full p-2 bg-white border border-pink-200 rounded-lg text-sm mb-2 resize-none"
              rows={2}
              value={p.question}
              onChange={e => updateProblem(i, 'question', e.target.value)}
              placeholder="Question..."
            />
            <div className="space-y-1 mb-2">
              {(p.options || []).map((opt: string, oi: number) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${p.id}`}
                    checked={p.correctAnswer === opt}
                    onChange={() => updateProblem(i, 'correctAnswer', opt)}
                    className="w-3 h-3"
                  />
                  <input
                    className="flex-1 p-1 bg-white border border-pink-200 rounded text-xs"
                    value={opt}
                    onChange={e => {
                      const newOpts = [...p.options];
                      const wasCorrect = p.correctAnswer === opt;
                      newOpts[oi] = e.target.value;
                      updateProblem(i, 'options', newOpts);
                      if (wasCorrect) updateProblem(i, 'correctAnswer', e.target.value);
                    }}
                  />
                </div>
              ))}
            </div>
            <textarea
              className="w-full p-2 bg-white border border-pink-200 rounded-lg text-xs resize-none"
              rows={2}
              value={p.explanation || ''}
              onChange={e => updateProblem(i, 'explanation', e.target.value)}
              placeholder="Explanation..."
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolboxTopicEditor({
  topic,
  onChange,
}: {
  topic: any;
  onChange: (topic: any) => void;
}) {
  const updateField = (field: string, value: any) => {
    onChange({ ...topic, [field]: value });
  };

  const addSafetyPoint = () => {
    const points = topic.safetyPoints || [];
    onChange({
      ...topic,
      safetyPoints: [...points, { id: `sp${Date.now()}`, icon: 'checkmark-circle', text: '', textLocal: '' }]
    });
  };

  const removeSafetyPoint = (index: number) => {
    const points = [...(topic.safetyPoints || [])];
    points.splice(index, 1);
    onChange({ ...topic, safetyPoints: points });
  };

  const updateSafetyPoint = (index: number, text: string) => {
    const points = [...(topic.safetyPoints || [])];
    points[index] = { ...points[index], text };
    onChange({ ...topic, safetyPoints: points });
  };

  return (
    <div className="space-y-3 p-3 bg-green-50 rounded-xl border border-green-200">
      <div className="text-xs font-bold text-green-700 uppercase">Topic Details</div>
      <input
        className="w-full p-2 bg-white border border-green-200 rounded-lg text-sm"
        value={topic.title || ''}
        onChange={e => updateField('title', e.target.value)}
        placeholder="Topic title..."
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="p-2 bg-white border border-green-200 rounded-lg text-sm"
          value={topic.duration || ''}
          onChange={e => updateField('duration', e.target.value)}
          placeholder="Duration (e.g., 10 min)"
        />
        <input
          className="p-2 bg-white border border-green-200 rounded-lg text-sm"
          value={topic.icon || ''}
          onChange={e => updateField('icon', e.target.value)}
          placeholder="Icon name"
        />
      </div>
      <textarea
        className="w-full p-2 bg-white border border-green-200 rounded-lg text-sm resize-none"
        rows={2}
        value={topic.keyMessage || ''}
        onChange={e => updateField('keyMessage', e.target.value)}
        placeholder="Key message..."
      />
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-green-600">Safety Points</span>
          <button onClick={addSafetyPoint} className="text-xs text-green-600 hover:text-green-800">+ Add</button>
        </div>
        <div className="space-y-1">
          {(topic.safetyPoints || []).map((sp: any, i: number) => (
            <div key={sp.id} className="flex items-center gap-2">
              <input
                className="flex-1 p-1 bg-white border border-green-200 rounded text-xs"
                value={sp.text}
                onChange={e => updateSafetyPoint(i, e.target.value)}
                placeholder={`Safety point ${i + 1}...`}
              />
              <button onClick={() => removeSafetyPoint(i)} className="text-green-400 hover:text-red-500">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <input
        className="w-full p-2 bg-white border border-green-200 rounded-lg text-sm"
        value={topic.actionItem || ''}
        onChange={e => updateField('actionItem', e.target.value)}
        placeholder="Action item..."
      />
    </div>
  );
}
