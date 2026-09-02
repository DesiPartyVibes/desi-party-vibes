import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetCurrentUser,
  useContactSupport,
  useRequestProfileOtp,
  useVerifyProfileOtp,
  useUpdateProfile,
} from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme/theme-provider";
import { Loader2, Sun, Moon, Monitor, Mail, Phone, MapPin, UserCog, Palette, MessageCircle, ChevronRight, ChevronDown } from "lucide-react";

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
