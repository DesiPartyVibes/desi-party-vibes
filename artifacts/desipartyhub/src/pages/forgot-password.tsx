import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import {
  useRequestPasswordResetOtp,
  useConfirmPasswordReset,
  useResendEmailOtp,
} from "@workspace/api-client-react";
import { CheckCircle2, ArrowLeft, Loader2, Eye, EyeOff, Mail } from "lucide-react";

type Step = "request" | "confirm" | "done";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const requestOtp = useRequestPasswordResetOtp();
  const confirmReset = useConfirmPasswordReset();
  const resendOtp = useResendEmailOtp();

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");

    const val = email.trim();
    if (!val || !/\S+@\S+\.\S+/.test(val)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    requestOtp.mutate(
      { data: { email: val } },
      {
        onSuccess: () => {
          toast({ description: "We've sent a 6-digit code to your email." });
          setStep("confirm");
        },
        onError: (err: any) => {
          setEmailError(err?.data?.error || "No account found with that email address.");
        },
      }
    );
  }

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setConfirmError("");

    if (code.trim().length < 6) { setConfirmError("Enter the 6-digit code from your email."); return; }
    if (newPassword.length < 6) { setConfirmError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setConfirmError("Passwords don't match."); return; }

    confirmReset.mutate(
      { data: { email: email.trim(), code: code.trim(), newPassword } },
      {
        onSuccess: () => setStep("done"),
        onError: (err: any) => {
          setConfirmError(err?.data?.error || "That code is invalid or has expired.");
        },
      }
    );
  }

  function handleResend() {
    resendOtp.mutate(
      { data: { email: email.trim(), purpose: "password_reset" } },
      {
        onSuccess: () => toast({ description: "A new code has been sent to your email." }),
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Couldn't resend code", description: err?.data?.error || "Please try again." });
        },
      }
    );
  }

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-lg border-primary/10">

          {/* ── Step 1: Request a code ── */}
          {step === "request" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="mx-auto mb-2">
                  <img src="/logo.png" alt="Desi Party Vibes" className="h-16 w-auto" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Forgot password?</CardTitle>
                <CardDescription>
                  Enter your email and we'll send you a 6-digit code to reset your password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRequest} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                      autoFocus
                      inputMode="email"
                    />
                    {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={requestOtp.isPending}>
                    {requestOtp.isPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending code...</>
                      : "Send reset code"}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm">
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to login
                  </Link>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 2: Enter code + new password ── */}
          {step === "confirm" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                  <Mail className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Check your email</CardTitle>
                <CardDescription>
                  Enter the 6-digit code we sent to <strong>{email}</strong> and choose a new password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConfirm} className="space-y-5">
                  <div className="space-y-2 flex flex-col items-center">
                    <Label>Verification code</Label>
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
                  </div>

                  <div className="space-y-2">
                    <Label>New password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setConfirmError(""); }}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Confirm new password</Label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(""); }}
                    />
                    {confirmError && <p className="text-sm text-destructive">{confirmError}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={confirmReset.isPending}>
                    {confirmReset.isPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resetting...</>
                      : "Reset password"}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm space-y-2">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendOtp.isPending}
                    className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Didn't get a code? Resend
                  </button>
                  <div>
                    <button
                      type="button"
                      onClick={() => setStep("request")}
                      className="flex items-center justify-center gap-1 mx-auto text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
                    </button>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === "done" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Password reset!</CardTitle>
                <CardDescription>
                  Your password has been updated. You can now log in with your new password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => setLocation("/login")}>
                  Go to login
                </Button>
              </CardContent>
            </>
          )}

        </Card>
      </div>
    </Layout>
  );
}
