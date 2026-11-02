"use client";

import { Suspense } from "react";

import ApprovalsPage from "@/components/approvals/approvals-page";

// The tab and the open request live in the URL, which needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ApprovalsPage />
    </Suspense>
  );
}
