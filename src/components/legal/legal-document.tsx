import Layout from "@/components/layout/Layout";

export const LEGAL_LAST_UPDATED = "2026-10-29";

/** A paragraph, or a list of bullet points when given an array. */
export type LegalBlock = string | string[];

export type LegalSection = {
  heading: string;
  body: LegalBlock[];
};

type LegalDocumentProps = {
  title: string;
  intro: string[];
  sections: LegalSection[];
};

export function LegalDocument({ title, intro, sections }: LegalDocumentProps) {
  return (
    <Layout headerStyle={2} footerStyle={1} breadcrumbTitle={title}>
      <article className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
          <div
            role="note"
            className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
          >
            Draft: to be reviewed by a qualified lawyer before launch.
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-[#062e39] sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: {LEGAL_LAST_UPDATED}</p>

          <div className="mt-8 space-y-4">
            {intro.map((paragraph) => (
              <p key={paragraph} className="leading-7 text-slate-600">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-bold text-[#062e39]">{section.heading}</h2>
                <div className="mt-4 space-y-4">
                  {section.body.map((block, index) =>
                    Array.isArray(block) ? (
                      <ul key={index} className="list-disc space-y-2 pl-6 leading-7 text-slate-600">
                        {block.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={index} className="leading-7 text-slate-600">
                        {block}
                      </p>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>
    </Layout>
  );
}
