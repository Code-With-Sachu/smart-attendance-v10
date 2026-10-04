"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Something went wrong"
      description="This page hit an unexpected problem. Your saved attendance is safe. Please try again."
      action={<Button onClick={reset}>Try Again</Button>}
    />
  );
}
