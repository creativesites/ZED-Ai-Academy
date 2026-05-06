'use client';

import dynamic from "next/dynamic";

const Videochat = dynamic<{ slug: string; JWT: string }>(() => import("./Videochat"), { ssr: false });

export default function VideochatClientWrapper({ slug, JWT }: { slug: string; JWT: string }) {
  return <Videochat slug={slug} JWT={JWT} />;
}