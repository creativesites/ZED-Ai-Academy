import { ModernTemplate } from "./home/ModernTemplate";
import { ClassicTemplate } from "./home/ClassicTemplate";
import { MinimalTemplate } from "./home/MinimalTemplate";
import { DarkTemplate } from "./home/DarkTemplate";
import { CorporateTemplate } from "./home/CorporateTemplate";
import { CreativeTemplate } from "./home/CreativeTemplate";
import { TechTemplate } from "./home/TechTemplate";
import { ElegantTemplate } from "./home/ElegantTemplate";
import type { AcademyStats } from "@/lib/tenants/academy-stats";

type TemplateProps = {
  tenant: any;
  courses: any[];
  membership: any;
  content: any;
  brandColor: string;
  template: string;
  adminProfile?: any;
  stats?: AcademyStats;
};

const NO_STATS: AcademyStats = { students: null, rating: null, success: null };

export function TemplateRenderer({ tenant, courses, membership, content, brandColor, template, adminProfile, stats }: TemplateProps) {
  const academyName = tenant.name || "Zed AI Academy";
  const heroTitle = content.hero_title || `Welcome to ${academyName}`;
  const heroSubtitle = content.hero_subtitle || "Empowering leaders, professionals, and students with modern practical skills, live workshops, and certified mastery.";
  const aboutTitle = content.about_title || `About ${academyName}`;
  const aboutText = content.about_text || `${academyName} is dedicated to delivering world-class curriculum, hands-on mentorship, and transformative learning experiences tailored for real-world impact.`;
  const aboutImage = content.about_image || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop";
  const ctaTitle = content.cta_title || "Start Your Journey Today";
  const ctaButton = content.cta_button || "Enroll Now";

  const sharedProps = { 
    tenant, 
    courses, 
    membership, 
    brandColor, 
    heroTitle, 
    heroSubtitle, 
    aboutTitle, 
    aboutText, 
    aboutImage, 
    ctaTitle, 
    ctaButton, 
    content,
    adminProfile,
    // Real numbers only (see computeAcademyStats); templates hide missing values.
    stats: stats ?? NO_STATS,
  };

  switch (template) {
    case "modern": return <ModernTemplate {...sharedProps} />;
    case "classic": return <ClassicTemplate {...sharedProps} />;
    case "minimal": return <MinimalTemplate {...sharedProps} />;
    case "dark_mode": return <DarkTemplate {...sharedProps} />;
    case "corporate": return <CorporateTemplate {...sharedProps} />;
    case "creative": return <CreativeTemplate {...sharedProps} />;
    case "tech": return <TechTemplate {...sharedProps} />;
    case "elegant": return <ElegantTemplate {...sharedProps} />;
    default: return <ModernTemplate {...sharedProps} />;
  }
}