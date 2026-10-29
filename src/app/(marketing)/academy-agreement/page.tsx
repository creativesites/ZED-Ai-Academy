import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/legal-document";
import { CONTACT_EMAIL, COUNTRY, LEGAL_ENTITY, PLATFORM_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Academy Agreement",
  description: `The agreement that applies to academies (tenants) that run an academy on ${PLATFORM_NAME}.`,
};

const intro = [
  `This Academy Agreement ("Agreement") is between ${LEGAL_ENTITY} (the "Platform", "we", "us") and the person or organisation that creates an academy on ${PLATFORM_NAME} (the "Academy", "you"). You accept this Agreement when you create an academy.`,
  "This Agreement works together with our Terms of Service and Privacy Policy. If there is a conflict, this Agreement applies to academies in relation to their academy.",
];

const sections: LegalSection[] = [
  {
    heading: "1. Who may open an academy",
    body: [
      "1.1 You must be at least 18 years old and authorised to act for the trainer, tutor, school or organisation that runs the Academy.",
      "1.2 You must give accurate information about yourself and the Academy, and keep it up to date.",
      "1.3 We may refuse to open an academy, or close one, if it does not meet these requirements.",
    ],
  },
  {
    heading: "2. The Academy's responsibilities",
    body: [
      "2.1 Accurate content. Course descriptions, lesson content, quizzes, prices and certificates must be accurate and not misleading.",
      `2.2 Lawful use. The Academy must comply with the laws of ${COUNTRY} and any other law that applies to it, including consumer protection and data protection laws.`,
      "2.3 Payments and refunds. The Academy handles its learners' payments and refunds. It must publish a refund policy, confirm payments promptly, and give learners access once payment is confirmed.",
      "2.4 Learner support. The Academy must respond to its learners' questions and complaints within a reasonable time.",
      "2.5 Certificates. The Academy issues certificates only to learners who have met its completion requirements.",
      "2.6 Staff. The Academy must make sure that anyone who uses the Academy on its behalf is authorised and follows this Agreement.",
    ],
  },
  {
    heading: "3. Platform fees",
    body: [
      "3.1 The Platform's fees are as shown on the Pricing page at the time you subscribe or make a purchase. [Founder to confirm that the Pricing page shows all fees.]",
      "3.2 We may change our fees. If we do, we will give the Academy notice before the change takes effect. [Notice period to be set.]",
    ],
  },
  {
    heading: "4. Data ownership and processing",
    body: [
      "4.1 The Academy controls its learner data. It decides why and how learners' personal data is used for its courses.",
      "4.2 For learner data, the Platform acts as a data processor on the Academy's behalf. We process that data only to run the Academy and deliver its courses, follow the Academy's reasonable instructions, and keep the data secure.",
      "4.3 We use the service providers listed in our Privacy Policy. We will tell the Academy before we add a provider that will process its learner data.",
      "4.4 The Academy must have a lawful basis for collecting learner data, must tell its learners how it uses their data, and must handle requests from its learners about their data.",
      "4.5 For data we control, such as our own account and Platform records, our Privacy Policy applies.",
      "4.6 [A separate data processing agreement may be required. To be confirmed by a qualified lawyer.]",
    ],
  },
  {
    heading: "5. Content licence",
    body: [
      "5.1 The Academy owns the content it publishes on the Platform (\"Academy Content\").",
      "5.2 The Academy gives us a non-exclusive, royalty-free licence to host, store, copy, process and display Academy Content, solely to operate the Platform and deliver the Academy's courses.",
      "5.3 The Academy must have the rights to all Academy Content it uploads or embeds, including images, music, text and videos from third-party services. The Academy must follow the terms of any third-party service it uses.",
    ],
  },
  {
    heading: "6. Staff accounts and staff codes",
    body: [
      "6.1 The Academy may invite staff, such as teachers and assistants, to work on its Academy using staff accounts or staff codes.",
      "6.2 Staff codes are confidential. The Academy must not publish them or share them with people it does not want to join.",
      "6.3 The Academy is responsible for the people it invites, for removing their access when they leave, and for everything done through staff accounts it manages.",
      "6.4 We may disable a staff code that appears to be misused, and we will tell the Academy if we do.",
    ],
  },
  {
    heading: "7. Suspension",
    body: [
      "7.1 We may suspend the Academy, or part of it, if it breaks this Agreement, breaks the law, creates a risk to learners or the Platform, or if a regulator requires it.",
      "7.2 Where it is lawful, practical and safe to do so, we will tell the Academy why and give it a chance to put things right. We may act without notice where urgent action is needed.",
      "7.3 During a suspension, we will try to limit the effect on learners who have paid for courses, and we will work with the Academy to do so.",
    ],
  },
  {
    heading: "8. Ending this Agreement and exporting data",
    body: [
      `8.1 The Academy may end this Agreement at any time by contacting us at ${CONTACT_EMAIL}. [Self-service closing option to be added if available.]`,
      "8.2 We may end this Agreement, with notice where possible, if the Academy seriously or repeatedly breaks it, stops paying fees that are due, or if the law requires it.",
      "8.3 Before this Agreement ends, the Academy may export its data, including its course content, learner records, assessment results and certificates. [Export format and the time the Academy has to export its data to be confirmed.]",
      "8.4 After the Academy's data has been exported, or the export period has ended, we will delete or return the remaining data as the Academy instructs. We may keep data where the law requires us to.",
      "8.5 Sections 4, 5, 8 and 9 continue to apply after this Agreement ends.",
    ],
  },
  {
    heading: "9. Liability and governing law",
    body: [
      "9.1 The limitations of liability in our Terms of Service apply to this Agreement.",
      `9.2 This Agreement is governed by the laws of ${COUNTRY}. Disputes are dealt with as set out in our Terms of Service. [Dispute resolution process to be confirmed by a qualified lawyer.]`,
    ],
  },
  {
    heading: "10. Changes and contact",
    body: [
      "10.1 We may update this Agreement. We will post the new version with a new \"Last updated\" date and tell Academies through the Platform if a change is significant.",
      `10.2 Questions about this Agreement can be sent to ${CONTACT_EMAIL}.`,
      `10.3 The Platform is operated by ${LEGAL_ENTITY}, based in ${COUNTRY}.`,
    ],
  },
];

export default function AcademyAgreementPage() {
  return <LegalDocument title="Academy Agreement" intro={intro} sections={sections} />;
}
