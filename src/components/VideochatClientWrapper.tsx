'use client';

import dynamic from "next/dynamic";

const Videochat = dynamic(() => import("./Videochat"), { 
  ssr: false
});

export default function VideochatClientWrapper() {
  return <Videochat />;
}