import VideochatClientWrapper from "@/components/VideochatClientWrapper";
import Script from "next/script";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24 bg-slate-50">
      <div className="w-full max-w-4xl h-[700px] flex flex-col">
        <VideochatClientWrapper />
      </div>
      <Script src="/coi-serviceworker.js" strategy="beforeInteractive" />
    </main>
  );
}