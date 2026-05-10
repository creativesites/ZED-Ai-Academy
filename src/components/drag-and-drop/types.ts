/**
 * Type definitions for the Module Builder
 */

// Component types available in the builder - aligned with mobile app's mining components
export type ComponentType =
  // Content
  | 'text-block'
  // Safety Components (Tier 1)
  | 'safety-inspection'
  | 'hazard-assessment'
  | 'incident-report'
  | 'permit-to-work'
  // Equipment & Operations (Tier 2)
  | 'operating-procedure'
  | 'maintenance-schedule'
  | 'equipment-specs'
  | 'troubleshooting'
  // Low-Literacy Visual Components
  | 'take5-safety'
  | 'pictogram-hazard'
  | 'ppe-visual-guide'
  | 'gas-testing'
  | 'refuse-unsafe-work'
  | 'emergency-procedure'
  // Assessment Components
  | 'visual-quiz'
  | 'spot-the-hazard'
  | 'practice-problems'
  // Media Components
  | 'youtube-video'
  | 'direct-video'
  | 'audio-lesson'
  | 'daily-toolbox-talk';

export type ComponentCategory =
  | 'content'
  | 'safety'
  | 'equipment'
  | 'visual-safety'
  | 'assessment'
  | 'media';

export interface ComponentTemplate {
  type: ComponentType;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: ComponentCategory;
  defaultData: ComponentData;
}

export interface ComponentInstance {
  id: string;
  type: ComponentType;
  data: ComponentData;
  expanded?: boolean;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  components: ComponentInstance[];
}

// Union type for all component data types
export type ComponentData =
  | TextBlockData
  | SafetyInspectionData
  | HazardAssessmentData
  | IncidentReportData
  | PermitToWorkData
  | OperatingProcedureData
  | MaintenanceScheduleData
  | EquipmentSpecsData
  | TroubleshootingData
  | Take5SafetyData
  | PictogramHazardData
  | PPEVisualGuideData
  | GasTestingData
  | RefuseUnsafeWorkData
  | EmergencyProcedureData
  | VisualQuizData
  | SpotTheHazardData
  | PracticeProblemsData
  | YouTubeVideoData
  | DirectVideoData
  | AudioLessonData
  | DailyToolboxTalkData;

// ============================================
// Content Components
// ============================================

export interface TextBlockData {
  content: string;
  format?: 'plain' | 'markdown';
}

// ============================================
// Safety Components (Tier 1)
// ============================================

export interface SafetyInspectionData {
  equipmentType: string;
  items: string[];
  flags?: string[];
}

export interface HazardAssessmentData {
  hazardType: string;
  likelihood: 'Low' | 'Medium' | 'High' | 'Critical';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  controls: string[];
}

export interface IncidentReportData {
  incidentType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  immediateActions: string;
  rootCause?: string;
}

export interface PermitToWorkData {
  task: string;
  location: string;
  hazards: string[];
  controls: string[];
  approvals: string[];
}

// ============================================
// Equipment & Operations (Tier 2)
// ============================================

export interface OperatingProcedureData {
  equipmentType: string;
  steps: string[];
}

export interface MaintenanceScheduleData {
  equipmentId: string;
  lastService: string;
  nextDue: string;
  defects?: string[];
}

export interface EquipmentSpecsData {
  equipmentName: string;
  specs: Record<string, string>;
}

export interface TroubleshootingData {
  symptom: string;
  causes: string[];
  solutions: string[];
}

// ============================================
// Low-Literacy Visual Components
// ============================================

export type HazardType =
  | 'electrical'
  | 'fire'
  | 'toxic'
  | 'rockfall'
  | 'machinery'
  | 'vehicles'
  | 'noise'
  | 'gas'
  | 'chemical'
  | 'heat'
  | 'radiation'
  | 'general';

export type PPEItemType =
  | 'hardhat'
  | 'safety-glasses'
  | 'ear-protection'
  | 'dust-mask'
  | 'respirator'
  | 'high-vis-vest'
  | 'steel-toe-boots'
  | 'safety-gloves'
  | 'fall-harness'
  | 'face-shield'
  | 'coveralls'
  | 'knee-pads';

export type TaskTypeForPPE =
  | 'drilling'
  | 'blasting'
  | 'hauling'
  | 'welding'
  | 'confined-space'
  | 'heights'
  | 'chemical-handling'
  | 'general-underground'
  | 'surface-operations'
  | 'electrical-work';

export type GasType =
  | 'oxygen'
  | 'methane'
  | 'carbon-monoxide'
  | 'hydrogen-sulfide'
  | 'carbon-dioxide'
  | 'nitrogen-dioxide';

export type EmergencyType =
  | 'self-rescuer'
  | 'evacuation'
  | 'fire'
  | 'gas'
  | 'rockfall'
  | 'first-aid'
  | 'general';

export type SupportedLanguage = 'en' | 'bem' | 'nya' | 'ton' | 'loz';

export interface Take5SafetyData {
  taskName: string;
  location?: string;
  hazardsIdentified?: string[];
  controlsApplied?: string[];
  audioEnabled?: boolean;
  language?: SupportedLanguage;
}

export interface HazardItem {
  type: HazardType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  customDescription?: string;
}

export interface PictogramHazardData {
  title?: string;
  location?: string;
  hazards: HazardItem[];
  requiredPPE?: PPEItemType[];
  audioEnabled?: boolean;
}

export interface PPEVisualGuideData {
  taskType: TaskTypeForPPE;
  taskDescription?: string;
  requiredPPE: PPEItemType[];
  optionalPPE?: PPEItemType[];
  specialInstructions?: string;
  audioEnabled?: boolean;
  language?: SupportedLanguage;
}

export interface GasReading {
  gasType: GasType;
  currentValue: number;
  unit: string;
}

export interface GasTestingData {
  location: string;
  readings: GasReading[];
  testRequired?: boolean;
  audioEnabled?: boolean;
  language?: SupportedLanguage;
  showSimulation?: boolean;
}

export interface RefuseUnsafeWorkData {
  companyName?: string;
  safetyOfficerName?: string;
  safetyOfficerContact?: string;
  msdHotline?: string;
  audioEnabled?: boolean;
  language?: SupportedLanguage;
}

export interface EmergencyStep {
  id: number;
  icon: string;
  title: string;
  instruction: string;
  audioPrompt: string;
  color: string;
  criticalWarning?: string;
}

export interface EmergencyProcedureData {
  emergencyType: EmergencyType;
  customSteps?: EmergencyStep[];
  audioEnabled?: boolean;
  location?: string;
}

// ============================================
// Assessment Components
// ============================================

export interface VisualAnswer {
  id: string;
  icon: string;
  iconType?: 'ionicon' | 'material';
  label: string;
  labelLocal?: string;
  color: string;
}

export interface VisualQuestion {
  id: string;
  questionText: string;
  questionTextLocal?: string;
  questionIcon?: string;
  answers: VisualAnswer[];
  correctAnswerId: string;
  explanation: string;
  explanationLocal?: string;
}

export interface VisualQuizData {
  title: string;
  titleLocal?: string;
  questions: VisualQuestion[];
  passingScore?: number;
  audioEnabled?: boolean;
  language?: SupportedLanguage;
  showLabels?: boolean;
}

export interface HazardLocation {
  id: string;
  x: number;
  y: number;
  size: number;
  hazardType: string;
  hazardIcon: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  descriptionLocal?: string;
}

export interface SceneData {
  id: string;
  name: string;
  nameLocal?: string;
  description: string;
  descriptionLocal?: string;
  sceneIcon: string;
  sceneColor: string;
  hazards: HazardLocation[];
}

export interface SpotTheHazardData {
  title: string;
  titleLocal?: string;
  scenes: SceneData[];
  timeLimit?: number;
  audioEnabled?: boolean;
  language?: SupportedLanguage;
}

export interface PracticeProblem {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface PracticeProblemsData {
  title: string;
  problems: PracticeProblem[];
  shuffleProblems?: boolean;
  showHints?: boolean;
}

// ============================================
// Media Components
// ============================================

export interface YouTubeVideoData {
  videoUrl: string;
  title?: string;
  description?: string;
  duration?: string;
}

export interface DirectVideoData {
  videoUrl: string;
  title?: string;
  description?: string;
  duration?: string;
  thumbnailUrl?: string;
  language?: SupportedLanguage;
  captionsUrl?: string;
  completionRequired?: boolean;
  downloadable?: boolean;
}

export interface AudioLessonData {
  title: string;
  audioUrl?: string;
  transcript: string;
  language: SupportedLanguage;
  duration?: string;
  keyPoints?: string[];
  completionRequired?: boolean;
}

export interface SafetyPoint {
  id: string;
  icon: string;
  iconType?: 'ionicon' | 'material';
  text: string;
  textLocal?: string;
}

export interface ToolboxTopic {
  id: string;
  title: string;
  titleLocal?: string;
  icon: string;
  color: string;
  duration: string;
  keyMessage: string;
  keyMessageLocal?: string;
  safetyPoints: SafetyPoint[];
  actionItem: string;
  actionItemLocal?: string;
}

export interface DailyToolboxTalkData {
  shiftType: 'day' | 'night' | 'general';
  currentDate?: string;
  topic: ToolboxTopic;
  supervisorName?: string;
  teamName?: string;
  audioEnabled?: boolean;
  language?: SupportedLanguage;
  requireAcknowledgment?: boolean;
}

// ============================================
// Module Builder Props & State
// ============================================

export interface ModuleBuilderProps {
  moduleId?: string;
  moduleTitle?: string;
  moduleDescription?: string;
  initialSections?: Section[];
  onSave?: (data: ModuleBuilderOutput) => Promise<void>;
  onCancel?: () => void;
}

export interface ModuleBuilderOutput {
  title: string;
  description: string;
  sections: Section[];
  metadata: {
    totalComponents: number;
    estimatedDuration: number;
    componentTypes: ComponentType[];
    createdAt: string;
    updatedAt: string;
  };
}

export interface EditModalProps {
  component: ComponentInstance;
  moduleContext?: {
    title: string;
    description: string;
    sections: Section[];
  };
  onSave: (data: ComponentData) => void;
  onClose: () => void;
  onGenerateWithAI?: (context: AIGenerationContext) => Promise<ComponentData>;
}

export interface AIGenerationContext {
  componentType: ComponentType;
  moduleTitle: string;
  moduleDescription: string;
  existingContent: string[];
  currentSectionTitle: string;
  specificPrompt?: string;
}
