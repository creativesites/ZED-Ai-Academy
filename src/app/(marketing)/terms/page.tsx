import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/legal-document";
import { CONTACT_EMAIL, COUNTRY, LEGAL_ENTITY, PLATFORM_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms that apply to learners and academies using ${PLATFORM_NAME}.`,
};

const intro = [
  `These Terms of Service ("Terms") set out the rules for using ${PLATFORM_NAME} (the "Platform"). The Platform is operated by ${LEGAL_ENTITY} ("we", "us"). These Terms apply to learners who use the Platform and to academies that run an academy on it.`,
  "Please read these Terms carefully. If you do not agree with them, do not use the Platform.",
];

const sections: LegalSection[] = [
  {
    heading: "1. Who these Terms apply to",
    body: [
      "1.1 Learners are people who create an account to take courses, join live classes or use the AI Tutor.",
      "1.2 Academies are trainers, tutors, schools and other organisations that run an academy on the Platform. Academies must also accept the Academy Agreement.",
      "1.3 By creating an account or continuing to use the Platform, you agree to these Terms.",
    ],
  },
  {
    heading: "2. Accounts",
    body: [
      "2.1 You must give accurate information when you create an account and keep it up to date.",
      "2.2 You must keep your login details confidential. You are responsible for activity on your account.",
      "2.3 Tell us as soon as possible if you think someone has used your account without permission.",
      "2.4 Children under 18 may use the Platform only with the consent of a parent or guardian.",
    ],
  },
  {
    heading: "3. Acceptable use",
    body: [
      "3.1 You must not use the Platform:",
      [
        "for any unlawful purpose, or in a way that infringes the rights of others;",
        "to share your login with people who are not authorised to use your account (staff accounts issued by an academy are the exception);",
        "to post or upload content that is abusive, hateful, threatening, sexually explicit or otherwise harmful, including any sexual content involving minors;",
        "to access other people's accounts or data, or to interfere with the security or operation of the Platform;",
        "to scrape, copy or reverse engineer the Platform, except where the law allows it;",
        "to use the AI Tutor to harass, defraud or deceive others, or to try to bypass its safety controls;",
        "to claim a certificate, qualification or identity you do not have.",
      ],
    ],
  },
  {
    heading: "4. Academies and their content",
    body: [
      "4.1 Each academy is responsible for its own courses, lessons, quizzes, live classes, descriptions, prices and other content.",
      "4.2 Academies must have the rights to any content they publish on the Platform.",
      "4.3 Academies set their own prices and refund policies, and respond to their own learners.",
      "4.4 We may remove or restrict content that breaks these Terms or the law. We do not review every item of academy content before it is published.",
    ],
  },
  {
    heading: "5. Payments, refunds and disputes",
    body: [
      "5.1 At launch, payments are made by Mobile Money or bank transfer and are confirmed manually by the academy. We may add a payment processor later. If we do, we will update these Terms.",
      "5.2 Refunds are handled by the academy, under the refund policy it publishes. Academies must state their refund policy clearly before a learner pays.",
      "5.3 If you have a dispute about a payment or access to a course, please contact the academy first. If the dispute is not resolved, contact us at " +
        `${CONTACT_EMAIL}. We may help where we can, but we are not a party to the sale between you and the academy, and we do not guarantee any refund.`,
    ],
  },
  {
    heading: "6. Certificates",
    body: [
      "6.1 Certificates are issued by the academy that ran the course, not by us. The academy decides whether a learner has earned a certificate.",
      "6.2 A certificate records that a learner completed a course run by that academy. Employers and other organisations decide for themselves whether to accept it.",
    ],
  },
  {
    heading: "7. AI features",
    body: [
      "7.1 The AI Tutor, quiz generation and other AI features give general guidance and practice. They are not professional advice, including legal, medical, financial or tax advice.",
      "7.2 AI can make mistakes. Check important information with a qualified person before you rely on it.",
      "7.3 Your messages, voice input and lesson content are processed by Google Gemini to provide AI features. Please do not enter sensitive personal information you do not need to share. See the Privacy Policy for details.",
      "7.4 Academies are responsible for the lesson content that the AI Tutor uses for their courses.",
    ],
  },
  {
    heading: "8. Intellectual property",
    body: [
      "8.1 Academies own the content they publish, including course material, lesson text, videos and quiz questions (\"Academy Content\"), subject to the rights of any third parties.",
      "8.2 Academies give us a non-exclusive, royalty-free licence to host, store, copy, process and display Academy Content, solely to operate the Platform and deliver the academy's courses.",
      `8.3 The Platform, including its software, design and the ${PLATFORM_NAME} name and branding, belongs to us or our licensors. These Terms do not give you any rights in them beyond using the Platform.`,
      "8.4 You keep the rights to what you write, such as notes and messages. You give us permission to store and process them so that we can provide the Platform to you.",
    ],
  },
  {
    heading: "9. Suspension and termination",
    body: [
      "9.1 We may suspend or end your account if you break these Terms, if the law requires it, or if we reasonably believe there is a risk to the Platform or to other users.",
      "9.2 Where it is practical and safe to do so, we will tell you why and give you a chance to respond. We may act without notice where urgent action is needed.",
      "9.3 You may stop using the Platform at any time. Contact us if you want your account closed.",
      "9.4 Academies may end their use of the Platform as set out in the Academy Agreement.",
      "9.5 Sections 4, 5, 8, 10 and 11 continue to apply after your account ends.",
    ],
  },
  {
    heading: "10. Limitation of liability",
    body: [
      "10.1 To the extent the law allows, the Platform is provided \"as is\" and \"as available\". We do not promise that it will always be available, uninterrupted or free of errors.",
      "10.2 To the extent the law allows, we are not liable for loss arising from: Academy Content; payments, refunds or access decisions made by an academy; decisions you make based on AI features; or indirect or consequential loss.",
      "10.3 [Liability cap to be set by a qualified lawyer.]",
      "10.4 Nothing in these Terms limits any liability that cannot be limited under the law of " + `${COUNTRY}.`,
    ],
  },
  {
    heading: "11. Governing law",
    body: [
      `11.1 These Terms are governed by the laws of ${COUNTRY}.`,
      `11.2 Disputes that cannot be resolved between the parties will be heard by the courts of ${COUNTRY}, unless the law requires otherwise. [Dispute resolution process to be confirmed by a qualified lawyer.]`,
    ],
  },
  {
    heading: "12. Changes to these Terms or the Platform",
    body: [
      "12.1 We may change the Platform. We may also update these Terms. When we do, we will post the new version with a new \"Last updated\" date.",
      "12.2 If a change is significant, we will tell you through the Platform before it takes effect. Continuing to use the Platform after a change takes effect means you accept the updated Terms.",
    ],
  },
  {
    heading: "13. Contact",
    body: [
      `13.1 Questions about these Terms can be sent to ${CONTACT_EMAIL}.`,
      `13.2 The Platform is operated by ${LEGAL_ENTITY}, based in ${COUNTRY}.`,
    ],
  },
];

export default function TermsPage() {
  return <LegalDocument title="Terms of Service" intro={intro} sections={sections} />;
}
