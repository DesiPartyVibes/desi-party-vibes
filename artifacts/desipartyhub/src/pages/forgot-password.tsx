import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Smartphone, CheckCircle2, ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";

type Step = "lookup" | "verify" | "done";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("lookup");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [inputError, setInputError] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const val = emailOrPhone.trim();
    if (!val) { setInputError("Enter your email or phone number."); return; }
    if (val.length < 4) { setInputError("Enter a valid email or phone number."); return; }
    setInputError("");
    setLoadingSend(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone: val }),
      });
      const data = await res.json();
      if (res.status === 404) {
        setInputError("No account found with that email or phone number.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to send code");

      setUserId(data.userId);
      const raw: string = data.phone ?? "";
      setMaskedPhone(raw ? `***-***-${raw.slice(-4)}` : "your registered number");
      setDevCode(data.devCode ?? null);
      if (data.devCode) {
        toast({ title: "Dev mode — no SMS sent", description: `Your code is: ${data.devCode}`, duration: 30000 });
      }
      setCountdown(60);
      setStep("verify");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Something went wrong." });
    } finally {
      setLoadingSend(false);
    }
  }

  async function handleResend() {
    setLoadingSend(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone: emailOrPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      if (data.userId) setUserId(data.userId);
      setDevCode(data.devCode ?? null);
      if (data.devCode) {
        toast({ title: "Dev mode — new code", description: `Your code is: ${data.devCode}`, duration: 30000 });
      }
      setCountdown(60);
      setOtpCode("");
      setOtpError("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoadingSend(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setOtpError("");
    setPasswordError("");

    if (otpCode.length !== 6) { setOtpError("Enter the 6-digit code."); return; }
    if (newPassword.length < 6) { setPasswordError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords don't match."); return; }
    if (!userId) { setOtpError("Session expired. Please start over."); return; }

    setLoadingReset(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, otpCode, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setStep("done");
    } catch (err: any) {
      const msg: string = err.message || "Something went wrong.";
      if (msg.toLowerCase().includes("code") || msg.toLowerCase().includes("verif")) {
        setOtpError(msg);
      } else {
        setPasswordError(msg);
      }
    } finally {
      setLoadingReset(false);
    }
  }

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-lg border-primary/10">

          {/* ── Step 1: Email or phone lookup ── */}
          {step === "lookup" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Forgot password?</CardTitle>
                <CardDescription>
                  Enter your email or mobile number — we'll send a reset code to your registered phone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendCode} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="emailOrPhone">Email or phone number</Label>
                    <Input
                      id="emailOrPhone"
                      type="text"
                      placeholder="name@example.com or +1 813 555 0123"
                      value={emailOrPhone}
                      onChange={(e) => { setEmailOrPhone(e.target.value); setInputError(""); }}
                      autoFocus
                      inputMode="email"
                    />
                    {inputError && <p className="text-sm text-destructive">{inputError}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={loadingSend}>
                    {loadingSend
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

          {/* ── Step 2: OTP + new password ── */}
          {step === "verify" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                  <Smartphone className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Enter reset code</CardTitle>
                <CardDescription>
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{maskedPhone}</span>
                </CardDescription>
                {devCode && (
                  <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Dev mode — your code: <strong className="font-mono tracking-wider">{devCode}</strong>
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <form onSubmit={handleReset} className="space-y-5">
                  <div className="space-y-2">
                    <Label>Verification code</Label>
                    <Input
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="tracking-[0.5em] text-2xl font-mono text-center h-14"
                      value={otpCode}
                      onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                      autoFocus
                    />
                    {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>New password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                    />
                    {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loadingReset || otpCode.length !== 6 || !newPassword || !confirmPassword}
                  >
                    {loadingReset
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resetting...</>
                      : "Reset password"}
                  </Button>
                </form>

                <div className="flex items-center justify-between text-sm mt-5">
                  <button
                    type="button"
                    onClick={() => { setStep("lookup"); setDevCode(null); }}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>

                  {countdown > 0 ? (
                    <span className="text-muted-foreground">Resend in {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loadingSend}
                      className="text-primary font-medium hover:underline disabled:opacity-50"
                    >
                      {loadingSend ? "Sending..." : "Resend code"}
                    </button>
                  )}
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
