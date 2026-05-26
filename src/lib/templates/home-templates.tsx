import { ModernTemplate } from "./home/ModernTemplate";
import { ClassicTemplate } from "./home/ClassicTemplate";
import { MinimalTemplate } from "./home/MinimalTemplate";
import { DarkTemplate } from "./home/DarkTemplate";
import { CorporateTemplate } from "./home/CorporateTemplate";
import { CreativeTemplate } from "./home/CreativeTemplate";
import { TechTemplate } from "./home/TechTemplate";
import { ElegantTemplate } from "./home/ElegantTemplate";

type TemplateProps = {
  tenant: any;
  courses: any[];
  membership: any;
  content: any;
  brandColor: string;
  template: string;
  adminProfile?: any;
  stats?: {
    students: string;
    rating: string;
    success: string;
  };
};

export function TemplateRenderer({ tenant, courses, membership, content, brandColor, template, adminProfile, stats }: TemplateProps) {
  const academyName = tenant.name;
  const heroTitle = content.hero_title || `Wisdom in Love & Faith with Maureen Mulenga`;
  const heroSubtitle = content.hero_subtitle || "Maureen Sinovia Mulenga is a devoted Christian, speaker, entrepreneur, and author of 'Let's Fix'. Join Bloom Academy to discover healing, better standards, and relationships that honor God.";
  const aboutTitle = content.about_title || "About Maureen Sinovia Mulenga";
  const aboutText = content.about_text || "Founder of Me and My Sisters and a graduate of UNZA, Maureen writes with warmth, conviction, and vulnerability. Based in Lusaka, she is a faith-rooted relationship voice dedicated to women's empowerment and practical wisdom.";
  const aboutImage = content.about_image || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop";
  const ctaTitle = content.cta_title || "Start Your Journey";
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
    stats
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