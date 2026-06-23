import { useState } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function handleSend() {
    if (!message.trim()) return;
    setSent(true);
    setMessage("");
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 2000);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-72 rounded-xl border bg-white shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
            <span className="font-semibold text-sm">Share Feedback</span>
            <button onClick={() => setOpen(false)} className="hover:opacity-75 transition-opacity">
              <X className="h-4 w-4" />
            </button>
          </div>

          {sent ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-green-600">Thanks for your feedback! 🙏</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">We'd love to hear how we can improve your experience.</p>
              <Textarea
                placeholder="Tell us what you think..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none text-sm"
              />
              <Button
                className="w-full"
                size="sm"
                onClick={handleSend}
                disabled={!message.trim()}
              >
                <Send className="h-3.5 w-3.5 mr-2" />
                Send Feedback
              </Button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-primary/90 active:scale-95 transition-all text-sm font-medium"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </button>
    </div>
  );
}
