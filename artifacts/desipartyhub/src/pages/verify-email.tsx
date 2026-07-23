import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import {
  useGetCurrentUser,
  useVerifyEmail,
  useResendEmailOtp,
} from "@workspace/api-client-react";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading: userLoading, refetch } = useGetCurrentUser();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const verifyEmail = useVerifyEmail();
  const resendOtp = useResendEmailOtp();

  useEffect(() => {
    if (!userLoading && !user) setLocation("/login");
  }, [user, userLoading, setLocation]);

  useEffect(() => {
    if (user?.emailVerified) setDone(true);
  }, [user]);

  if (userLoading || !user) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (code.trim().length < 6) { setError("Enter the 6-digit code from your email."); return; }

    verifyEmail.mutate(
      { data: { email: user!.email, code: code.trim() } },
      {
        onSuccess: () => {
          setDone(true);
          refetch();
        },
        onError: (err: any) => {
          setError(err?.data?.error || "That code is invalid or has expired.");
        },
      }
    );
  }

  function handleResend() {
    resendOtp.mutate(
      { data: { email: user!.email, purpose: "signup" } },
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

          {done ? (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Email verified!</CardTitle>
                <CardDescription>Thanks — your email address is confirmed.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => setLocation("/")}>
                  Continue
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                  <MailCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Verify your email</CardTitle>
                <CardDescription>
                  Enter the 6-digit code we sent to <strong>{user.email}</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
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
                    {error && <p className="text-sm text-destructive">{error}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={verifyEmail.isPending}>
                    {verifyEmail.isPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
                      : "Verify email"}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendOtp.isPending}
                    className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Didn't get a code? Resend
                  </button>
                </div>
              </CardContent>
            </>
          )}

        </Card>
      </div>
    </Layout>
  );
}
