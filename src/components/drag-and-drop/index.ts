/**
 * Module Builder - Drag and Drop Components
 * Export all components and types for external use
 */

// Main builder component
export { default as DragDropModuleBuilder } from './DragDropModuleBuilder';

// Sub-components
export { EditModal } from './EditModal';
export { renderMobilePreview } from './MobilePreviewComponents';
export { MobilePreviewContainer } from './MobilePreviewContainer';
export { ComponentPreviewCard } from './ComponentPreviewCard';

// Templates and utilities
export {
  COMPONENT_TEMPLATES,
  CATEGORY_INFO,
  TEMPLATE_CATEGORIES,
  getTemplateByType,
  getTemplatesByCategory,
} from './templates';

// Types
export type {
  ComponentType,
  ComponentCategory,
  ComponentTemplate,
  ComponentInstance,
  Section,
  ComponentData,
  ModuleBuilderProps,
  ModuleBuilderOutput,
  EditModalProps,
  AIGenerationContext,
  // Component-specific data types
  TextBlockData,
  SafetyInspectionData,
  HazardAssessmentData,
  IncidentReportData,
  PermitToWorkData,
  OperatingProcedureData,
  MaintenanceScheduleData,
  EquipmentSpecsData,
  TroubleshootingData,
  Take5SafetyData,
  PictogramHazardData,
  PPEVisualGuideData,
  GasTestingData,
  RefuseUnsafeWorkData,
  EmergencyProcedureData,
  VisualQuizData,
  SpotTheHazardData,
  PracticeProblemsData,
  YouTubeVideoData,
  DirectVideoData,
  AudioLessonData,
  DailyToolboxTalkData,
} from './types';
