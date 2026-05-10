/**
 * Component Templates for the Module Builder
 * These templates define all available mining training components
 */

import {
  Type,
  Shield,
  AlertTriangle,
  AlertCircle,
  FileText,
  BookOpen,
  ClipboardCheck,
  ListChecks,
  Settings,
  Wrench,
  HardHat,
  Eye,
  Wind,
  Siren,
  Play,
  Mic,
  MessageSquare,
  VideoIcon,
  Video,
  Target,
  Zap,
  CheckCircle,
  Clock,
  Users,
  Hand,
} from 'lucide-react';
import type { ComponentTemplate, ComponentType, ComponentCategory } from './types';

// Helper function to get templates by category
export function getTemplatesByCategory(category: ComponentCategory): ComponentTemplate[] {
  return COMPONENT_TEMPLATES.filter(t => t.category === category);
}

// Helper function to get a specific template
export function getTemplateByType(type: ComponentType): ComponentTemplate | undefined {
  return COMPONENT_TEMPLATES.find(t => t.type === type);
}

// Category display names and colors
export const CATEGORY_INFO: Record<ComponentCategory, { name: string; color: string }> = {
  content: { name: 'Content', color: '#64748B' },
  safety: { name: 'Safety', color: '#EF4444' },
  equipment: { name: 'Equipment & Operations', color: '#3B82F6' },
  'visual-safety': { name: 'Visual Safety (Low-Literacy)', color: '#8B5CF6' },
  assessment: { name: 'Assessment', color: '#EC4899' },
  media: { name: 'Media', color: '#06B6D4' },
};

// All component templates
export const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  // ============================================
  // Content Components
  // ============================================
  {
    type: 'text-block',
    name: 'Text Content',
    description: 'Basic text content for descriptions, introductions, and explanations',
    icon: Type,
    color: '#64748B',
    category: 'content',
    defaultData: {
      content: 'Enter your learning content here. You can describe safety protocols, introduction material, or general information.',
      format: 'plain',
    },
  },

  // ============================================
  // Safety Components (Tier 1)
  // ============================================
  {
    type: 'safety-inspection',
    name: 'Safety Inspection',
    description: 'Pre-shift safety inspection checklist for equipment',
    icon: Shield,
    color: '#EF4444',
    category: 'safety',
    defaultData: {
      equipmentType: 'General Equipment',
      items: ['Check fluid levels', 'Inspect tires/tracks', 'Test emergency brakes', 'Check lights and horn'],
      flags: [],
    },
  },
  {
    type: 'hazard-assessment',
    name: 'Hazard Assessment',
    description: 'Risk assessment and hazard identification form',
    icon: AlertTriangle,
    color: '#F59E0B',
    category: 'safety',
    defaultData: {
      hazardType: 'Falling Rocks',
      likelihood: 'Medium',
      severity: 'High',
      riskLevel: 'High',
      controls: ['Install mesh guarding', 'Scale loose rocks', 'Wear hard hat'],
    },
  },
  {
    type: 'incident-report',
    name: 'Incident Report',
    description: 'Report and document incidents and near misses',
    icon: AlertCircle,
    color: '#DC2626',
    category: 'safety',
    defaultData: {
      incidentType: 'Near Miss',
      severity: 'Medium',
      description: 'Vehicle nearly collided with wall due to slippery ramp.',
      immediateActions: 'Stopped vehicle, applied sand to ramp.',
      rootCause: 'Water leak causing slippery surface.',
    },
  },
  {
    type: 'permit-to-work',
    name: 'Permit to Work',
    description: 'Work authorization and safety permit form',
    icon: FileText,
    color: '#7C3AED',
    category: 'safety',
    defaultData: {
      task: 'Hot Work - Welding',
      location: 'Workshop Bay 3',
      hazards: ['Fire risk', 'Fumes', 'Burns', 'UV exposure'],
      controls: ['Fire extinguisher nearby', 'Welding screens', 'PPE required', 'Ventilation on'],
      approvals: ['Shift Supervisor', 'Safety Officer', 'Area Manager'],
    },
  },

  // ============================================
  // Equipment & Operations (Tier 2)
  // ============================================
  {
    type: 'operating-procedure',
    name: 'Operating Procedure',
    description: 'Standard operating procedures with step-by-step instructions',
    icon: BookOpen,
    color: '#3B82F6',
    category: 'equipment',
    defaultData: {
      equipmentType: 'Drill Rig',
      steps: [
        'Perform pre-start check',
        'Mount the cabin safely',
        'Turn on master switch',
        'Start engine and idle for 2 mins',
        'Check all gauges and displays',
      ],
    },
  },
  {
    type: 'maintenance-schedule',
    name: 'Maintenance Schedule',
    description: 'Equipment maintenance tracking and scheduling',
    icon: ClipboardCheck,
    color: '#10B981',
    category: 'equipment',
    defaultData: {
      equipmentId: 'EQ-2024-001',
      lastService: '2024-01-15',
      nextDue: '2024-02-15',
      defects: ['Hydraulic leak detected', 'Wiper blade worn'],
    },
  },
  {
    type: 'equipment-specs',
    name: 'Equipment Specifications',
    description: 'Technical specifications and capabilities',
    icon: Settings,
    color: '#0EA5E9',
    category: 'equipment',
    defaultData: {
      equipmentName: 'CAT 785D Mining Truck',
      specs: {
        'Payload Capacity': '150 tonnes',
        'Engine Power': '1,450 HP',
        'Fuel Capacity': '3,785 L',
        'Maximum Speed': '54 km/h',
        'Gross Machine Weight': '256,000 kg',
      },
    },
  },
  {
    type: 'troubleshooting',
    name: 'Troubleshooting Guide',
    description: 'Problem diagnosis and solution guide',
    icon: Wrench,
    color: '#F97316',
    category: 'equipment',
    defaultData: {
      symptom: 'Engine fails to start',
      causes: [
        'Battery is dead or low',
        'Fuel tank empty',
        'Emergency stop engaged',
        'Key switch faulty',
      ],
      solutions: [
        'Check and charge/replace battery',
        'Refuel the vehicle',
        'Release emergency stop button',
        'Contact maintenance for key switch inspection',
      ],
    },
  },

  // ============================================
  // Visual Safety (Low-Literacy) Components
  // ============================================
  {
    type: 'take5-safety',
    name: 'Take 5 Safety Check',
    description: 'Pre-task safety ritual with 5 visual steps - no reading required',
    icon: Hand,
    color: '#EF4444',
    category: 'visual-safety',
    defaultData: {
      taskName: 'Loading Ore',
      location: 'Pit Level 4',
      hazardsIdentified: ['Moving vehicles', 'Unstable ground', 'Overhead hazards'],
      controlsApplied: ['High-vis vest worn', 'Radio communication', 'Safe distance maintained'],
      audioEnabled: true,
      language: 'en',
    },
  },
  {
    type: 'pictogram-hazard',
    name: 'Pictogram Hazard Card',
    description: 'Visual hazard identification using ISO mining pictograms',
    icon: AlertTriangle,
    color: '#DC2626',
    category: 'visual-safety',
    defaultData: {
      title: 'Work Area Hazards',
      location: 'Underground Level 3',
      hazards: [
        { type: 'rockfall', severity: 'high', customDescription: 'Loose rocks above work area' },
        { type: 'noise', severity: 'medium', customDescription: 'Drilling operations nearby' },
        { type: 'vehicles', severity: 'medium', customDescription: 'LHD equipment operating' },
      ],
      requiredPPE: ['hardhat', 'safety-glasses', 'ear-protection'],
      audioEnabled: true,
    },
  },
  {
    type: 'ppe-visual-guide',
    name: 'PPE Visual Guide',
    description: 'Visual guide showing required PPE for specific tasks',
    icon: HardHat,
    color: '#3B82F6',
    category: 'visual-safety',
    defaultData: {
      taskType: 'drilling',
      taskDescription: 'Underground drilling operations',
      requiredPPE: ['hardhat', 'safety-glasses', 'ear-protection', 'dust-mask', 'steel-toe-boots', 'safety-gloves'],
      optionalPPE: ['face-shield'],
      specialInstructions: 'Double hearing protection required in high-noise areas',
      audioEnabled: true,
      language: 'en',
    },
  },
  {
    type: 'gas-testing',
    name: 'Gas Testing Card',
    description: 'Visual gas detection results with color-coded safety levels',
    icon: Wind,
    color: '#10B981',
    category: 'visual-safety',
    defaultData: {
      location: 'Stope 4, Level 6',
      readings: [
        { gasType: 'oxygen', currentValue: 20.8, unit: '%' },
        { gasType: 'methane', currentValue: 0.3, unit: '%' },
        { gasType: 'carbon-monoxide', currentValue: 8, unit: 'ppm' },
        { gasType: 'hydrogen-sulfide', currentValue: 2, unit: 'ppm' },
      ],
      testRequired: true,
      audioEnabled: true,
      language: 'en',
      showSimulation: false,
    },
  },
  {
    type: 'refuse-unsafe-work',
    name: 'Refuse Unsafe Work',
    description: 'Worker rights card for refusing unsafe work',
    icon: Hand,
    color: '#7C3AED',
    category: 'visual-safety',
    defaultData: {
      companyName: 'Mining Company Ltd',
      safetyOfficerName: 'John Safety',
      safetyOfficerContact: '+260 XXX XXX XXX',
      msdHotline: '+260 XXX XXX XXX',
      audioEnabled: true,
      language: 'en',
    },
  },
  {
    type: 'emergency-procedure',
    name: 'Emergency Procedure',
    description: 'Visual emergency response guide with step-by-step actions',
    icon: Siren,
    color: '#EF4444',
    category: 'visual-safety',
    defaultData: {
      emergencyType: 'fire',
      audioEnabled: true,
      location: 'Underground Workshop',
    },
  },

  // ============================================
  // Assessment Components
  // ============================================
  {
    type: 'visual-quiz',
    name: 'Visual Quiz',
    description: 'Image-based assessment using visual options - no reading required',
    icon: Target,
    color: '#8B5CF6',
    category: 'assessment',
    defaultData: {
      title: 'Safety Sign Recognition',
      titleLocal: '',
      questions: [
        {
          id: 'q1',
          questionText: 'Which sign means "Fire Hazard"?',
          questionTextLocal: '',
          answers: [
            { id: 'a1', icon: 'flame', iconType: 'ionicon', label: 'Fire', color: '#EF4444' },
            { id: 'a2', icon: 'flash', iconType: 'ionicon', label: 'Electric', color: '#FBBF24' },
            { id: 'a3', icon: 'skull', iconType: 'ionicon', label: 'Toxic', color: '#7C3AED' },
            { id: 'a4', icon: 'warning', iconType: 'ionicon', label: 'Warning', color: '#F59E0B' },
          ],
          correctAnswerId: 'a1',
          explanation: 'The flame symbol indicates fire hazard. Always have fire extinguisher ready.',
          explanationLocal: '',
        },
      ],
      passingScore: 70,
      audioEnabled: true,
      language: 'en',
      showLabels: true,
    },
  },
  {
    type: 'spot-the-hazard',
    name: 'Spot the Hazard',
    description: 'Interactive hazard identification in visual scenes',
    icon: Eye,
    color: '#EC4899',
    category: 'assessment',
    defaultData: {
      title: 'Find the Safety Hazards',
      titleLocal: '',
      scenes: [
        {
          id: 'scene1',
          name: 'Workshop Area',
          nameLocal: '',
          description: 'Identify hazards in this workshop scene',
          descriptionLocal: '',
          sceneIcon: 'construct',
          sceneColor: '#F59E0B',
          hazards: [
            {
              id: 'h1',
              x: 30,
              y: 40,
              size: 15,
              hazardType: 'trip',
              hazardIcon: 'warning',
              severity: 'medium',
              description: 'Cables on floor - trip hazard',
              descriptionLocal: '',
            },
          ],
        },
      ],
      timeLimit: 120,
      audioEnabled: true,
      language: 'en',
    },
  },
  {
    type: 'practice-problems',
    name: 'Practice Problems',
    description: 'Knowledge check with multiple choice and true/false questions',
    icon: ListChecks,
    color: '#EC4899',
    category: 'assessment',
    defaultData: {
      title: 'Safety Knowledge Check',
      problems: [
        {
          id: 'p1',
          question: 'What should you do FIRST when arriving at a work area?',
          type: 'multiple_choice',
          options: [
            'Start working immediately',
            'Conduct a Take 5 safety assessment',
            'Wait for supervisor',
            'Check your phone',
          ],
          correctAnswer: 'Conduct a Take 5 safety assessment',
          explanation: 'Always conduct a Take 5 before starting any task to identify hazards.',
          difficulty: 'easy',
        },
      ],
      shuffleProblems: true,
      showHints: true,
    },
  },

  // ============================================
  // Media Components
  // ============================================
  {
    type: 'youtube-video',
    name: 'YouTube Video',
    description: 'Embed YouTube training videos',
    icon: VideoIcon,
    color: '#EF4444',
    category: 'media',
    defaultData: {
      videoUrl: 'https://www.youtube.com/watch?v=example',
      title: 'Safety Training Video',
      description: 'Watch this important safety training video',
      duration: '5:30',
    },
  },
  {
    type: 'direct-video',
    name: 'Direct Video',
    description: 'Upload or link to MP4 video files',
    icon: Video,
    color: '#06B6D4',
    category: 'media',
    defaultData: {
      videoUrl: '',
      title: 'Training Video',
      description: 'Watch this training video',
      duration: '5:00',
      thumbnailUrl: '',
      language: 'en',
      completionRequired: true,
      downloadable: false,
    },
  },
  {
    type: 'audio-lesson',
    name: 'Audio Lesson',
    description: 'Audio-based learning for low-literacy workers',
    icon: Mic,
    color: '#8B5CF6',
    category: 'media',
    defaultData: {
      title: 'Safety Briefing',
      audioUrl: '',
      transcript: 'Welcome to this safety briefing. Today we will cover the important safety procedures for underground mining operations.',
      language: 'en',
      duration: '3:00',
      keyPoints: ['Always wear your PPE', 'Report hazards immediately', 'Follow the Take 5 procedure'],
      completionRequired: true,
    },
  },
  {
    type: 'daily-toolbox-talk',
    name: 'Daily Toolbox Talk',
    description: 'Daily safety briefing with team acknowledgment',
    icon: Users,
    color: '#10B981',
    category: 'media',
    defaultData: {
      shiftType: 'day',
      currentDate: new Date().toISOString().split('T')[0],
      topic: {
        id: 'topic1',
        title: 'Working at Heights Safety',
        titleLocal: '',
        icon: 'arrow-up',
        color: '#F59E0B',
        duration: '10 min',
        keyMessage: 'Always use fall protection when working above 2 meters',
        keyMessageLocal: '',
        safetyPoints: [
          { id: 'sp1', icon: 'checkmark-circle', text: 'Inspect harness before use', textLocal: '' },
          { id: 'sp2', icon: 'checkmark-circle', text: 'Attach to secure anchor point', textLocal: '' },
          { id: 'sp3', icon: 'checkmark-circle', text: 'Keep work area clear below', textLocal: '' },
        ],
        actionItem: 'Check all harnesses are tagged and in date',
        actionItemLocal: '',
      },
      supervisorName: '',
      teamName: '',
      audioEnabled: true,
      language: 'en',
      requireAcknowledgment: true,
    },
  },
];

// Export component template categories in order
export const TEMPLATE_CATEGORIES: ComponentCategory[] = [
  'content',
  'safety',
  'equipment',
  'visual-safety',
  'assessment',
  'media',
];
