import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetCurrentUser,
  useContactSupport,
  useRequestProfileOtp,
  useVerifyProfileOtp,
  useUpdateProfile,
  useUpdateEmailPreferences,
  useUpdatePrivacy,
  useListSessions,
  useRevokeSession,
  useRevokeOtherSessions,
  useUpdateAccountStatus,
  useDeleteAccount,
  useListMyVendorClaims,
  useGetVendor,
  useUpdateVendor,
  useDeleteVendor,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { setStoredToken } from "@/lib/auth-token";
import { useTheme } from "@/components/theme/theme-provider";
import {
  Loader2,
  Sun,
  Moon,
  Monitor,
  Mail,
  Phone,
  MapPin,
  UserCog,
  Palette,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  Bell,
  Eye,
  Laptop,
  ShieldAlert,
  Smartphone,
  LogOut,
  Trash2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

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
        onError: (err: any) => {
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-3">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Contact Support</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
          <DialogDescription>
            Need help with something this page can't do yet? Tell us what's going on and we'll reply to the
            email on your account.
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

// Resizes/compresses an uploaded photo client-side into a JPEG data URL, the
// same trick used for vendor listing photos elsewhere in the app — there's
// no object-storage service wired up, and users.avatar_url is a plain text
// column, so a compressed data URL is the simplest path that needs no new
// backend work.
async function processAvatarFile(file: File): Promise<string> {
  const rawDataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't decode that image."));
    el.src = rawDataUrl;
  });

  const maxDim = 400;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing isn't supported in this browser.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

type EditableUser = {
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
};

// Editing name, email, phone, address, password, or avatar requires proving
// it's really the account owner first: request a code, verify it, and only
// then does the edit form unlock. The verify step hands back a short-lived
// "edit grant" that PATCH /auth/profile checks, so the OTP can't be reused
// beyond that one save.
function EditProfileDialog({ user }: { user: EditableUser }) {
  const { toast } = useToast();
  const requestOtp = useRequestProfileOtp();
  const verifyOtp = useVerifyProfileOtp();
  const updateProfile = useUpdateProfile();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"otp" | "form">("otp");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [editGrant, setEditGrant] = useState<string | null>(null);

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || "");
  const [address, setAddress] = useState(user.address || "");
  const [newPassword, setNewPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarProcessing, setAvatarProcessing] = useState(false);

  function resetFields() {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || "");
    setAddress(user.address || "");
    setNewPassword("");
    setAvatarUrl(user.avatarUrl || "");
    setAvatarError(null);
  }

  function closeAndReset() {
    setOpen(false);
    setStep("otp");
    setCode("");
    setOtpError("");
    setEditGrant(null);
    resetFields();
  }

  function handleOpen() {
    resetFields();
    setStep("otp");
    setCode("");
    setOtpError("");
    setEditGrant(null);
    setOpen(true);
    requestOtp.mutate(undefined, {
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Couldn't send a code",
          description: err?.data?.error || "Please try again.",
        });
        setOpen(false);
      },
    });
  }

  function handleResend() {
    requestOtp.mutate(undefined, {
      onSuccess: () => toast({ description: "A new code has been sent to your email." }),
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Couldn't resend code",
          description: err?.data?.error || "Please try again.",
        });
      },
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setOtpError("");
    if (code.trim().length < 6) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }
    verifyOtp.mutate(
      { data: { code: code.trim() } },
      {
        onSuccess: (data) => {
          setEditGrant(data.editGrant);
          setStep("form");
        },
        onError: (err: any) => {
          setOtpError(err?.data?.error || "That code is invalid or has expired.");
        },
      }
    );
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvatarError("Image is too large (max 8MB).");
      return;
    }
    setAvatarProcessing(true);
    try {
      setAvatarUrl(await processAvatarFile(file));
    } catch (err: any) {
      setAvatarError(err?.message || "Couldn't process that image. Try a different file.");
    } finally {
      setAvatarProcessing(false);
    }
  }

  function handleSave() {
    if (!editGrant) return;

    const payload: Record<string, string> = { editGrant };
    if (name.trim() && name.trim() !== user.name) payload.name = name.trim();
    if (email.trim() && email.trim() !== user.email) payload.email = email.trim();
    if (phone.trim() !== (user.phone || "")) payload.phone = phone.trim();
    if (address.trim() !== (user.address || "")) payload.address = address.trim();
    if (newPassword.trim()) payload.newPassword = newPassword.trim();
    if (avatarUrl && avatarUrl !== (user.avatarUrl || "")) payload.avatarUrl = avatarUrl;

    if (Object.keys(payload).length <= 1) {
      toast({ description: "No changes to save." });
      closeAndReset();
      return;
    }

    updateProfile.mutate(
      { data: payload as any },
      {
        onSuccess: () => {
          toast({ description: "Your profile has been updated." });
          closeAndReset();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't save changes",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeAndReset();
        else setOpen(true);
      }}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-3">
          <UserCog className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Edit Profile</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <DialogContent className="sm:max-w-md">
        {step === "otp" ? (
          <>
            <DialogHeader>
              <DialogTitle>Verify it's you</DialogTitle>
              <DialogDescription>
                Enter the 6-digit code we sent to <strong>{user.email}</strong> to unlock editing your profile.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                {otpError && <p className="text-sm text-destructive">{otpError}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={verifyOtp.isPending}>
                {verifyOtp.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={requestOtp.isPending}
                  className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Didn't get a code? Resend
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Update your details below, then save.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarUrl || ""} alt={name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-serif">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1 flex-1">
                  <Label htmlFor="avatar-upload" className="text-sm">
                    Profile photo
                  </Label>
                  <Input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} />
                  {avatarProcessing && <p className="text-xs text-muted-foreground">Processing image...</p>}
                  {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-address">Address</Label>
                <Input id="edit-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-password">
                  New password <span className="text-xs text-muted-foreground font-normal">(leave blank to keep current)</span>
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeAndReset} disabled={updateProfile.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark" | "system"; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="inline-flex rounded-md border p-1 gap-1">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            theme === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function AppearanceRow() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-3">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Appearance</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <ThemeToggle />
      </CollapsibleContent>
    </Collapsible>
  );
}

// Not OTP-gated: turning marketing/status notifications on or off isn't
// sensitive the way editing account details is, and OTP emails themselves
// keep going regardless of this setting (see the note in the row below) so
// there's no risk of a user locking themselves out of verification codes.
function EmailPreferencesRow({ emailNotifications }: { emailNotifications: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateEmailPreferences = useUpdateEmailPreferences();

  function handleChange(next: boolean) {
    updateEmailPreferences.mutate(
      { data: { emailNotifications: next } },
      {
        onSuccess: (user) => {
          queryClient.setQueryData(getGetCurrentUserQueryKey(), user);
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't update email preferences",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div>
          <p className="font-medium text-sm">Email Notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Booking updates and account activity. Security codes always send regardless of this setting.
          </p>
        </div>
      </div>
      <Switch
        checked={emailNotifications}
        onCheckedChange={handleChange}
        disabled={updateEmailPreferences.isPending}
        aria-label="Toggle email notifications"
      />
    </div>
  );
}

function PrivacyRow({ reviewsArePublic }: { reviewsArePublic: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updatePrivacy = useUpdatePrivacy();

  function handleChange(next: boolean) {
    updatePrivacy.mutate(
      { data: { reviewsArePublic: next } },
      {
        onSuccess: (user) => {
          queryClient.setQueryData(getGetCurrentUserQueryKey(), user);
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't update privacy setting",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <Eye className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div>
          <p className="font-medium text-sm">Show My Name on Reviews</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            When off, reviews you write show as "Anonymous" instead of your name.
          </p>
        </div>
      </div>
      <Switch
        checked={reviewsArePublic}
        onCheckedChange={handleChange}
        disabled={updatePrivacy.isPending}
        aria-label="Toggle review privacy"
      />
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return format(new Date(dateStr), "MMM d, yyyy");
}

function ManageSessionsDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data, isLoading, refetch } = useListSessions({ query: { enabled: open } });
  const revokeSession = useRevokeSession();
  const revokeOtherSessions = useRevokeOtherSessions();

  function handleRevoke(id: number) {
    revokeSession.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ description: "That session has been signed out." });
          refetch();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't sign out that session",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  }

  function handleRevokeAllOthers() {
    revokeOtherSessions.mutate(undefined, {
      onSuccess: () => {
        toast({ description: "All other devices have been signed out." });
        refetch();
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Couldn't sign out other devices",
          description: err?.data?.error || "Please try again.",
        });
      },
    });
  }

  const sessions = data?.sessions ?? [];
  const hasOtherSessions = sessions.some((s) => !s.isCurrent);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-3">
          <Laptop className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Manage Sessions</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Sessions</DialogTitle>
          <DialogDescription>Devices and browsers currently signed in to your account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No active sessions found.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate max-w-[220px]">
                        {s.userAgent ? s.userAgent : "Unknown device"}
                      </p>
                      {s.isCurrent && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          This device
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last active {timeAgo(s.lastUsedAt)}
                      {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                    </p>
                  </div>
                </div>
                {!s.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleRevoke(s.id)}
                    disabled={revokeSession.isPending}
                  >
                    Sign out
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        {hasOtherSessions && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleRevokeAllOthers}
              disabled={revokeOtherSessions.isPending}
              className="w-full"
            >
              {revokeOtherSessions.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out all other devices
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Everything here is destructive or account-affecting, so it sits behind
// the same "verify it's you" OTP flow as Edit Profile before any of these
// actions become clickable. Disabling/deleting the account clears the
// session server-side, so on success we send the user back to the homepage
// rather than trying to keep the page around.
function DangerZoneDialog({ user }: { user: { email: string; role: string } }) {
  const { toast } = useToast();
  const requestOtp = useRequestProfileOtp();
  const verifyOtp = useVerifyProfileOtp();
  const updateAccountStatus = useUpdateAccountStatus();
  const deleteAccount = useDeleteAccount();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"otp" | "actions">("otp");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [editGrant, setEditGrant] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<"deleteAccount" | "deleteBusiness" | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const { data: claims } = useListMyVendorClaims({ query: { enabled: open && step === "actions" && user.role === "vendor" } });
  const approvedClaim = claims?.find((c) => c.status === "approved");
  const { data: myVendor, refetch: refetchVendor } = useGetVendor(approvedClaim?.vendorId ?? 0, {
    query: { enabled: !!approvedClaim && open && step === "actions" },
  });

  function closeAndReset() {
    setOpen(false);
    setStep("otp");
    setCode("");
    setOtpError("");
    setEditGrant(null);
    setConfirmingAction(null);
    setConfirmText("");
  }

  function handleOpen() {
    setStep("otp");
    setCode("");
    setOtpError("");
    setEditGrant(null);
    setConfirmingAction(null);
    setConfirmText("");
    setOpen(true);
    requestOtp.mutate(undefined, {
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Couldn't send a code",
          description: err?.data?.error || "Please try again.",
        });
        setOpen(false);
      },
    });
  }

  function handleResend() {
    requestOtp.mutate(undefined, {
      onSuccess: () => toast({ description: "A new code has been sent to your email." }),
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Couldn't resend code",
          description: err?.data?.error || "Please try again.",
        });
      },
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setOtpError("");
    if (code.trim().length < 6) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }
    verifyOtp.mutate(
      { data: { code: code.trim() } },
      {
        onSuccess: (data) => {
          setEditGrant(data.editGrant);
          setStep("actions");
        },
        onError: (err: any) => {
          setOtpError(err?.data?.error || "That code is invalid or has expired.");
        },
      }
    );
  }

  function handleDisableAccount() {
    if (!editGrant) return;
    updateAccountStatus.mutate(
      { data: { editGrant, status: "disabled" } },
      {
        onSuccess: () => {
          toast({ description: "Your account has been temporarily disabled. Log back in anytime to reactivate it." });
          setStoredToken(null);
          window.location.href = "/";
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't disable account",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  }

  function handleDeleteAccount() {
    if (!editGrant) return;
    deleteAccount.mutate(
      { data: { editGrant } },
      {
        onSuccess: () => {
          toast({ description: "Your account has been deleted." });
          setStoredToken(null);
          window.location.href = "/";
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't delete account",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  }

  function handleToggleBusiness() {
    if (!approvedClaim || !myVendor) return;
    updateVendor.mutate(
      {
        id: approvedClaim.vendorId,
        data: { phone: myVendor.phone || "", email: myVendor.email || "", isActive: !myVendor.isActive },
      },
      {
        onSuccess: () => {
          toast({
            description: myVendor.isActive
              ? "Your business listing has been hidden from public view."
              : "Your business listing is active again.",
          });
          refetchVendor();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't update your business listing",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  }

  function handleDeleteBusiness() {
    if (!approvedClaim || !editGrant) return;
    deleteVendor.mutate(
      { id: approvedClaim.vendorId, data: { editGrant } },
      {
        onSuccess: () => {
          toast({ description: "Your business listing has been permanently deleted." });
          setConfirmingAction(null);
          setConfirmText("");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't delete your business listing",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeAndReset();
        else setOpen(true);
      }}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-destructive/5 transition-colors"
      >
        <span className="flex items-center gap-3">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <span className="font-medium text-sm text-destructive">Danger Zone</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <DialogContent className="sm:max-w-md">
        {step === "otp" ? (
          <>
            <DialogHeader>
              <DialogTitle>Verify it's you</DialogTitle>
              <DialogDescription>
                Enter the 6-digit code we sent to <strong>{user.email}</strong> to continue.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                {otpError && <p className="text-sm text-destructive">{otpError}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={verifyOtp.isPending}>
                {verifyOtp.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={requestOtp.isPending}
                  className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Didn't get a code? Resend
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-destructive">Danger Zone</DialogTitle>
              <DialogDescription>These actions affect your account{user.role === "vendor" ? " and business listing" : ""}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Account</h4>
                <div className="rounded-md border divide-y">
                  <div className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-medium">Temporarily disable account</p>
                      <p className="text-xs text-muted-foreground">
                        Signs you out everywhere. Log back in anytime to reactivate.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisableAccount}
                      disabled={updateAccountStatus.isPending}
                    >
                      <PauseCircle className="h-4 w-4 mr-1.5" />
                      Disable
                    </Button>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-destructive">Delete account permanently</p>
                        <p className="text-xs text-muted-foreground">This cannot be undone.</p>
                      </div>
                      {confirmingAction !== "deleteAccount" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive border-destructive/30"
                          onClick={() => {
                            setConfirmingAction("deleteAccount");
                            setConfirmText("");
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" />
                          Delete
                        </Button>
                      )}
                    </div>
                    {confirmingAction === "deleteAccount" && (
                      <div className="space-y-2 pt-1">
                        <Label htmlFor="confirm-delete-account" className="text-xs">
                          Type DELETE to confirm
                        </Label>
                        <Input
                          id="confirm-delete-account"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder="DELETE"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmingAction(null)}
                            disabled={deleteAccount.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={confirmText !== "DELETE" || deleteAccount.isPending}
                            onClick={handleDeleteAccount}
                          >
                            {deleteAccount.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              "Confirm delete"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {user.role === "vendor" && approvedClaim && myVendor && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Business</h4>
                  <div className="rounded-md border divide-y">
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <p className="text-sm font-medium">
                          {myVendor.isActive ? "Temporarily disable business" : "Reactivate business"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {myVendor.isActive
                            ? "Hides your listing from public search and browsing."
                            : "Your listing is currently hidden from public view."}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleToggleBusiness} disabled={updateVendor.isPending}>
                        {myVendor.isActive ? (
                          <>
                            <PauseCircle className="h-4 w-4 mr-1.5" />
                            Disable
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-4 w-4 mr-1.5" />
                            Reactivate
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-destructive">Delete business permanently</p>
                          <p className="text-xs text-muted-foreground">This cannot be undone.</p>
                        </div>
                        {confirmingAction !== "deleteBusiness" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive border-destructive/30"
                            onClick={() => {
                              setConfirmingAction("deleteBusiness");
                              setConfirmText("");
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                      {confirmingAction === "deleteBusiness" && (
                        <div className="space-y-2 pt-1">
                          <Label htmlFor="confirm-delete-business" className="text-xs">
                            Type DELETE to confirm
                          </Label>
                          <Input
                            id="confirm-delete-business"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="DELETE"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmingAction(null)}
                              disabled={deleteVendor.isPending}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={confirmText !== "DELETE" || deleteVendor.isPending}
                              onClick={handleDeleteBusiness}
                            >
                              {deleteVendor.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                "Confirm delete"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
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
                  <p className="text-muted-foreground mb-3 flex items-center gap-1.5 justify-center md:justify-start">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email}
                  </p>
                  {(user.phone || user.address) && (
                    <div className="text-sm text-muted-foreground space-y-1 mb-3">
                      {user.phone && (
                        <p className="flex items-center gap-1.5 justify-center md:justify-start">
                          <Phone className="h-3.5 w-3.5" />
                          {user.phone}
                        </p>
                      )}
                      {user.address && (
                        <p className="flex items-center gap-1.5 justify-center md:justify-start">
                          <MapPin className="h-3.5 w-3.5" />
                          {user.address}
                        </p>
                      )}
                    </div>
                  )}
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
              <div className="space-y-4">
                <h3 className="font-medium text-lg border-b pb-2">Account Settings</h3>
                <div className="rounded-md border divide-y">
                  <EditProfileDialog user={user} />
                  <AppearanceRow />
                  <EmailPreferencesRow emailNotifications={user.emailNotifications ?? true} />
                  <PrivacyRow reviewsArePublic={user.reviewsArePublic ?? true} />
                  <ManageSessionsDialog />
                  <ContactSupportDialog />
                  <DangerZoneDialog user={user} />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Layout>
  );
}
