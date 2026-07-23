import { useState } from "react";
import { Link } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { MailWarning, X } from "lucide-react";

export function EmailVerifyBanner() {
  const { data: user } = useGetCurrentUser();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !user || user.emailVerified) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm text-amber-800 dark:text-amber-500">
        <div className="flex items-center gap-2">
          <MailWarning className="h-4 w-4 shrink-0" />
          <span>
            Please verify your email address. <Link href="/verify-email" className="font-medium underline underline-offset-2">Verify now</Link>
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-800/70 hover:text-amber-800 dark:text-amber-500/70 dark:hover:text-amber-500 shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
