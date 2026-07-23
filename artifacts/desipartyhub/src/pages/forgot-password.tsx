import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";

type Step = "form" | "done";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("form");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [inputError, setInputError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setInputError("");
    setPasswordError("");

    const val = emailOrPhone.trim();
    if (!val) { setInputError("Enter your email or phone number."); return; }
    if (val.length < 4) { setInputError("Enter a valid email or phone number."); return; }
    if (newPassword.length < 6) { setPasswordError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords don't match."); return; }

    setLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const res = await fetch(`${apiBase}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emailOrPhone: val, newPassword }),
      });
      const data = await res.json();
      if (res.status === 404) {
        setInputError("No account found with that email or phone number.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setStep("done");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Something went wrong." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-lg border-primary/10">

          {/* ── Step 1: Reset password directly ── */}
          {step === "form" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="mx-auto mb-2">
                  <img src="/logo.png" alt="Desi Party Vibes" className="h-16 w-auto" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Forgot password?</CardTitle>
                <CardDescription>
                  Enter your email or mobile number and choose a new password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleReset} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="emailOrPhone">Email or phone number</Label>
                    <Input
                      id="emailOrPhone"
                      type="text"
                      placeholder=""
                      value={emailOrPhone}
                      onChange={(e) => { setEmailOrPhone(e.target.value); setInputError(""); }}
                      autoFocus
                      inputMode="email"
                    />
                    {inputError && <p className="text-sm text-destructive">{inputError}</p>}
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
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                    />
                    {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resetting...</>
                      : "Reset password"}
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

          {/* ── Step 2: Done ── */}
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
