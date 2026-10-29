import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/legal-document";
import { CONTACT_EMAIL, COUNTRY, DPO_EMAIL, LEGAL_ENTITY, PLATFORM_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${PLATFORM_NAME} collects, uses, shares and protects personal data, in line with Zambia's Data Protection Act No. 3 of 2021.`,
};

const intro = [
  `This Privacy Policy explains how ${PLATFORM_NAME}, operated by ${LEGAL_ENTITY}, handles personal data. It is written to align with the Data Protection Act No. 3 of 2021 of ${COUNTRY} (the "Act").`,
  "Academies that run courses on the Platform decide how learner data is used for their courses. This policy explains our role in that process and what we do for ourselves.",
];

const sections: LegalSection[] = [
  {
    heading: "1. Who is responsible for your data",
    body: [
      "1.1 Academy learner data. When you learn with an academy, that academy is the data controller for your personal data as it relates to its courses. It decides why and how that data is used. We process the data on the academy's behalf as a data processor, to deliver its courses.",
      `1.2 Platform data. For information we need to run the Platform itself, such as your account and the security of the Platform, ${LEGAL_ENTITY} is the data controller.`,
      "1.3 If you have a question about how an academy uses your data, contact the academy first. We will help the academy respond to your request.",
    ],
  },
  {
    heading: "2. What we collect",
    body: [
      "2.1 We may collect the following:",
      [
        "Account information: your name, email address, login details (managed by our authentication provider) and your role, such as learner, teacher or academy owner.",
        "Profile information: details you choose to add, and any details an academy asks you to provide.",
        "Learning progress: lessons started and completed, bookmarks and notes.",
        "Assessments: quiz answers, scores and results.",
        "Live class attendance: whether you joined a live class and when.",
        "AI Tutor conversations: the messages you send and the responses you receive, and, if you use voice features, your voice recordings and their transcripts.",
        "Payment references: the Mobile Money or bank transfer reference, and whether the academy has confirmed the payment. We do not store card numbers.",
        "Technical information: device and browser details, IP address and basic log data needed to run and secure the Platform.",
      ],
    ],
  },
  {
    heading: "3. How we use your data and our legal basis",
    body: [
      "3.1 We use personal data only for the purposes below. The lawful grounds are those permitted by the Act, such as your consent, the performance of a contract, compliance with a legal obligation, and our legitimate interests where these do not override your rights.",
      [
        "Creating and managing accounts (performance of a contract).",
        "Delivering courses, live classes, quizzes and certificates (performance of a contract with the academy and with you).",
        "Providing AI Tutor responses (performance of a contract), and processing voice recordings (your consent).",
        "Confirming payments and keeping payment records (performance of a contract and legal obligation).",
        "Keeping the Platform secure and preventing fraud or misuse (legitimate interests).",
        "Responding to support requests (performance of a contract and legitimate interests).",
        "Meeting legal and regulatory obligations (legal obligation).",
      ],
      "3.2 Where we rely on your consent, you can withdraw it at any time. Withdrawing consent does not affect processing done before you withdrew it.",
    ],
  },
  {
    heading: "4. AI processing",
    body: [
      "4.1 Lesson content, your AI Tutor messages and your voice input are sent to Google Gemini so that we can produce AI Tutor responses and speech. We limit what we send to what is needed for the feature.",
      "4.2 AI responses can be inaccurate. Please read our Terms of Service on AI features.",
      "4.3 [Confirm with Google's terms whether input data is used to train models, and update this section to match.]",
    ],
  },
  {
    heading: "5. Who we share data with",
    body: [
      "5.1 We use the following service providers (processors) to run the Platform:",
      [
        "Clerk: account sign-in and authentication.",
        "Supabase: database and file storage.",
        "Vercel: hosting and delivery of the website.",
        "Google (Gemini): AI Tutor responses and voice features.",
        "Email provider: sending account and service emails. This will be added before launch and will be listed here when it is.",
      ],
      "5.2 Academies receive the learner data needed to run their own courses, including progress, assessments, attendance and payment confirmations.",
      "5.3 We may disclose personal data where the law requires it, or to protect the rights and safety of people using the Platform.",
      "5.4 We do not sell personal data.",
    ],
  },
  {
    heading: "6. Transfers outside Zambia",
    body: [
      "6.1 Some of our service providers store or process data outside Zambia. This means your personal data may be transferred and processed in other countries.",
      "6.2 When we transfer personal data outside Zambia, we will do so only where the Act allows it and with appropriate safeguards. [Safeguards to be confirmed by a qualified lawyer.]",
    ],
  },
  {
    heading: "7. How long we keep data",
    body: [
      "7.1 Account and learning records are kept while your account is active and for [period to be set] after you close it, unless the law requires us to keep them longer.",
      "7.2 AI Tutor conversations and voice recordings are kept for [period to be set].",
      "7.3 Payment references are kept for [period to be set] for accounting and record-keeping.",
      "7.4 For academy learner data, the academy decides the retention period, within the law. We follow its instructions.",
    ],
  },
  {
    heading: "8. Your rights",
    body: [
      "8.1 Under the Act you have the right to:",
      [
        "be informed about how your data is used;",
        "access the personal data we hold about you;",
        "ask us to correct inaccurate or incomplete data;",
        "object to certain processing, and ask us to restrict or delete your data where the Act allows;",
        "withdraw consent where we rely on it;",
        "complain to the data protection authority in Zambia (the Office of the Data Protection Commissioner).",
      ],
      `8.2 To exercise your rights, email ${DPO_EMAIL} or ${CONTACT_EMAIL}. If your data is held for an academy, we may pass your request to that academy. We will respond within the time set by the Act. [Response time to be confirmed by a qualified lawyer.]`,
    ],
  },
  {
    heading: "9. Children",
    body: [
      "9.1 Children under 18 may use the Platform only with the consent of a parent or guardian. We ask that a parent or guardian gives that consent before a child creates an account.",
      "9.2 Academies that enrol children must also meet their own obligations under the Act. Please see the Academy Agreement.",
    ],
  },
  {
    heading: "10. Security",
    body: [
      "10.1 We protect personal data with appropriate technical and organisational measures. These include access controls, row-level security on our database, and keeping server-side keys out of the browser.",
      "10.2 No system is completely secure. If a breach is likely to affect your rights, we will notify you and the regulator as the Act requires.",
    ],
  },
  {
    heading: "11. Cookies and similar technologies",
    body: [
      "11.1 We use cookies and browser storage that are needed to sign you in and keep the Platform working.",
      "11.2 [List any analytics or other non-essential cookies here before launch, and link to consent controls if they are used.]",
    ],
  },
  {
    heading: "12. Changes to this policy",
    body: [
      "12.1 We may update this policy. We will post the new version with a new \"Last updated\" date, and we will tell you through the Platform if the change is significant.",
    ],
  },
  {
    heading: "13. Contact and data protection officer",
    body: [
      `13.1 Data protection officer: ${DPO_EMAIL}.`,
      `13.2 General privacy questions: ${CONTACT_EMAIL}.`,
      `13.3 Controller: ${LEGAL_ENTITY}, ${COUNTRY}.`,
    ],
  },
];

export default function PrivacyPage() {
  return <LegalDocument title="Privacy Policy" intro={intro} sections={sections} />;
}
