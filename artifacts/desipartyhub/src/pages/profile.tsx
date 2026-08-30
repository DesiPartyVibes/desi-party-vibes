import { useState } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser, useContactSupport } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

function ContactSupportDialog() {
  const { toast } = useToast();
  const contactSupport = useContactSupport();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Add a bit more detail",
        description: "Please describe your issue in at least 10 characters.",
      });
      return;
    }

    contactSupport.mutate(
      { data: { message: message.trim() } },
      {
        onSuccess: () => {
          toast({ description: "Your message has been sent. We'll get back to you soon." });
          setMessage("");
          setOpen(false);
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Couldn't send your message",
            description: err?.data?.error || "Please try again in a moment.",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Contact Support</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
          <DialogDescription>
            Let us know what you need help with — updating your profile, changing your password, or anything
            else. We'll reply to the email on your account.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Describe your issue or request..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={contactSupport.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={contactSupport.isPending}>
            {contactSupport.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send message"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetCurrentUser();

  if (!isLoading && !user) {
    setLocation("/login");
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="font-serif text-3xl font-bold mb-8">My Profile</h1>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-3">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : user ? (
          <Card className="border-primary/10 shadow-sm">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
                  <AvatarImage src={user.avatarUrl || ""} alt={user.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-3xl font-serif">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl font-serif mb-1">{user.name}</CardTitle>
                  <p className="text-muted-foreground mb-3">{user.email}</p>
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium uppercase tracking-wider">
                      {user.role}
                    </span>
                    {user.role === "vendor" && (
                      <span
                        className={
                          user.isVerified
                            ? "px-3 py-1 bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 rounded-full text-xs font-medium uppercase tracking-wider"
                            : "px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded-full text-xs font-medium uppercase tracking-wider"
                        }
                      >
                        {user.isVerified ? "Verified" : "Pending Verification"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Joined {format(new Date(user.createdAt), "MMMM yyyy")}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <h3 className="font-medium text-lg border-b pb-2">Account Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Contact support to update your profile information or change your password.
                </p>
                <div className="flex gap-4">
                  <ContactSupportDialog />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Layout>
  );
}
