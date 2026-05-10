/**
 * Create Module Page - Unified Builder Theme
 * AI methods generate component-based content, then open in builder for editing
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Upload, FileText,
  BrainCircuit,
  Clock, Type, Settings2,
  AlertCircle, Layout
} from 'lucide-react';
import { DragDropModuleBuilder, type ModuleBuilderOutput } from '@/components/drag-and-drop';
import type { Section } from '@/components/drag-and-drop/types';

type ModuleCategory = 'safety' | 'equipment' | 'technical' | 'compliance';
type GenMethod = 'prompt' | 'document' | 'drag-and-drop';

export default function CreateModulePage() {
  const router = useRouter();
  const [step, setStep] = useState<'input' | 'generating' | 'builder'>('input');
  const [method, setMethod] = useState<GenMethod>('prompt');

  // Common Metadata
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ModuleCategory>('safety');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);

  // AI Specifics
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Builder state
  const [initialSections, setInitialSections] = useState<Section[]>([
    { id: 'section-1', title: 'Introduction', components: [] }
  ]);

  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

 

  const handleGenerate = async () => {
    console.log('this is when we generate content')
    setInitialSections([{ id: 'section-1', title: 'Introduction', components: [] }]);
      setStep('builder');
  };

  // Handler for saving from builder
  const handleBuilderSave = async (output: ModuleBuilderOutput) => {
    console.log('saving apa')
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">

      

      {step === 'input' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

          {/* Method Selection Toggles */}
          <div className="flex p-2 bg-white dark:bg-[#5d6274]/10 rounded-[2rem] border border-[#6c8cc3]/10 shadow-sm overflow-x-auto">
            {[
              { id: 'prompt', label: 'AI Prompt', icon: Type, desc: 'Generate from description' },
              { id: 'document', label: 'Doc Synthesis', icon: Upload, desc: 'Extract from document' },
              { id: 'drag-and-drop', label: 'Visual Builder', icon: Layout, desc: 'Build from scratch' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id as GenMethod)}
                className={`flex-1 min-w-[140px] flex flex-col items-center justify-center gap-2 py-4 rounded-2xl transition-all ${
                  method === m.id
                    ? 'bg-[#5d6274] text-white shadow-lg'
                    : 'text-[#6c8cc3] hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <m.icon className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-[#5d6274]/5 border border-[#6c8cc3]/10 rounded-[3rem] p-10 shadow-sm space-y-8">

            {/* Common Metadata Fields */}
            {method !== 'document' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-[#6c8cc3]/10 pb-8">
                <div className="space-y-6 md:col-span-2">
                   <label className="text-[10px] font-black text-[#6c8cc3] uppercase tracking-[0.2em] ml-2">Module Identity</label>
                   <input
                    value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. HIGH-VOLTAGE LOCKOUT/TAGOUT"
                    className="w-full bg-slate-50 dark:bg-[#5d6274]/20 border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 ring-indigo-500/20 outline-none"
                   />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#6c8cc3] uppercase tracking-[0.2em] ml-2 flex items-center gap-2"><Settings2 className="w-3 h-3"/> Classification</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="w-full bg-slate-50 dark:bg-[#5d6274]/20 border-none rounded-2xl p-5 text-sm font-bold outline-none">
                        <option value="safety">Tier 1: Safety</option>
                        <option value="equipment">Tier 2: Equipment</option>
                        <option value="technical">Tier 3: Technical</option>
                        <option value="compliance">Tier 4: Compliance</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#6c8cc3] uppercase tracking-[0.2em] ml-2 flex items-center gap-2"><Clock className="w-3 h-3"/> Duration (Min)</label>
                    <input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-[#5d6274]/20 border-none rounded-2xl p-5 text-sm font-bold outline-none" />
                </div>
                <div className="md:col-span-2 space-y-2">
                   <label className="text-[10px] font-black text-[#6c8cc3] uppercase tracking-[0.2em] ml-2">Description</label>
                   <textarea
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief overview of learning objectives..."
                    rows={2} className="w-full bg-slate-50 dark:bg-[#5d6274]/20 border-none rounded-3xl p-6 text-sm font-medium outline-none"
                   />
                </div>
              </div>
            )}

            {/* --- AI PROMPT INPUT --- */}
            {method === 'prompt' && (
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-[#6c8cc3] uppercase tracking-[0.2em] ml-2 flex items-center gap-2"><BrainCircuit className="w-3 h-3"/> AI Directives (Optional)</label>
                 <textarea
                  value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Tell the AI specifically what to focus on (e.g., 'Emphasize the new 2024 OSHA changes regarding...')"
                  rows={4} className="w-full bg-indigo-50/50 dark:bg-[#5d6274]/20 border border-indigo-100 dark:border-indigo-500/20 rounded-3xl p-6 text-sm font-medium outline-none focus:ring-2 ring-indigo-500/20"
                 />
                 <p className="text-xs text-[#5d6274]/50 ml-2">AI will generate content as interactive components you can edit in the builder.</p>
              </div>
            )}

            {/* --- DOCUMENT UPLOAD --- */}
            {method === 'document' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#6c8cc3] uppercase tracking-[0.2em] ml-2">Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="w-full bg-slate-50 dark:bg-[#5d6274]/20 border-none rounded-2xl p-5 text-sm font-bold outline-none">
                        <option value="safety">Tier 1: Safety</option>
                        <option value="equipment">Tier 2: Equipment</option>
                        <option value="technical">Tier 3: Technical</option>
                        <option value="compliance">Tier 4: Compliance</option>
                    </select>
                  </div>
                </div>

                <div className="border-4 border-dashed border-[#6c8cc3]/10 rounded-[3rem] p-12 text-center group hover:border-indigo-500/20 transition-all">
                  {uploadedFile ? (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto"><FileText className="text-indigo-600"/></div>
                      <p className="text-sm font-black text-[#5d6274]">{uploadedFile.name}</p>
                      <button onClick={() => setUploadedFile(null)} className="text-[10px] font-black text-rose-500 uppercase">Clear File</button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><Upload className="text-[#6c8cc3]"/></div>
                      <p className="text-[10px] font-black text-[#6c8cc3] uppercase tracking-[0.2em]">Source Documentation (PDF/TXT)</p>
                      <p className="text-xs text-[#5d6274]/50 mt-2">AI will extract content and create interactive components</p>
                      <input type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={(e) => setUploadedFile(e.target.files?.[0] || null)} />
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#6c8cc3] uppercase tracking-[0.2em] ml-2">Additional Instructions (Optional)</label>
                  <textarea
                    value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Any specific focus areas or formatting preferences..."
                    rows={2} className="w-full bg-slate-50 dark:bg-[#5d6274]/20 border-none rounded-2xl p-4 text-sm font-medium outline-none"
                  />
                </div>
              </div>
            )}

            {/* --- VISUAL BUILDER INFO --- */}
            {method === 'drag-and-drop' && (
              <div className="text-center py-8 space-y-4">
                <div className="p-4 bg-indigo-50 rounded-2xl inline-block">
                  <Layout className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-[#5d6274]">Visual Module Builder</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Build your module from scratch using drag-and-drop components.
                  Add safety inspections, quizzes, videos, and more.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 p-4 rounded-2xl flex items-center gap-3 text-rose-600 text-xs font-bold border border-rose-100">
                <AlertCircle className="w-4 h-4"/> {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={
                (method === 'prompt' && (!title || !description)) ||
                (method === 'document' && !uploadedFile) ||
                (method === 'drag-and-drop' && (!title || !description))
              }
              className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100"
            >
              {method === 'drag-and-drop' ? (
                <><Layout className="w-5 h-5" /> Launch Visual Builder</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate & Open in Builder</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading State (for AI generation) */}
      {step === 'generating' && (
        <div className="py-20 text-center space-y-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <BrainCircuit className="absolute inset-0 m-auto w-10 h-10 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#5d6274] uppercase tracking-tight">Generating Content</h3>
            <p className="text-[10px] font-bold text-[#6c8cc3] uppercase tracking-widest mt-2 animate-pulse">
              Creating interactive components...
            </p>
          </div>
        </div>
      )}

      {/* Full-screen Builder */}
      {step === 'builder' && (
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
          <DragDropModuleBuilder
            moduleTitle={title}
            moduleDescription={description}
            initialSections={initialSections}
            onSave={handleBuilderSave}
            onCancel={() => setStep('input')}
          />
        </div>
      )} 
    </div>
  );
}
