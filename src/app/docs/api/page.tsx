"use client";

import { useEffect, useRef } from "react";

export default function ApiDocsPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const script = document.createElement("script");
    script.id = "api-reference";
    script.type = "application/json";
    script.dataset.url = "/api/openapi";
    ref.current.appendChild(script);

    const scalar = document.createElement("script");
    scalar.src = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";
    ref.current.appendChild(scalar);
  }, []);

  return <div ref={ref} className="min-h-dvh" />;
}
