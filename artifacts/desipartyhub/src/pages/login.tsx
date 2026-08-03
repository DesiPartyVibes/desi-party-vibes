import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useLoginUser,
  useConfirmLoginOtp,
  useResendEmailOtp,
  useGetCurrentUser,
} from "@workspace/api-client-react";
import { setStoredToken } from "@/lib/auth-token";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, ArrowLeft, Loader2 } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginUser = useLoginUser();
  const confirmLoginOtp = useConfirmLoginOtp();
  const resendOtp = useResendEmailOtp();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const [showPassword, setShowPassword] = useState(false);

  const [step, setStep] = useState<"password" | "otp">("password");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState("");

  if (!userLoading && user) {
    setLocation("/");
    return null;
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    loginUser.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ description: "We've sent a 6-digit code to your email." });
          setPendingEmail(values.email);
          setCode("");
          setVerifyError("");
          setStep("otp");
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: error?.data?.error || error.message || "Please check your credentials and try again.",
          });
        },
      }
    );
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError("");

    if (code.trim().length < 6) {
      setVerifyError("Enter the 6-digit code from your email.");
      return;
    }

    confirmLoginOtp.mutate(
      { data: { email: pendingEmail, code: code.trim() } },
      {
        onSuccess: (data) => {
          setStoredToken(data.token);
          toast({ title: "Welcome back!", description: "You have successfully logged in." });
          window.location.href = "/";
        },
        onError: (err: any) => {
          setVerifyError(err?.data?.error || "That code is invalid or has expired.");
        },
      }
    );
  }

  function handleResend() {
    resendOtp.mutate(
      { data: { email: pendingEmail, purpose: "login" } },
      {
        onSuccess: () => toast({ description: "A new code has been sent to your email." }),
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't resend code",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  }

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-lg border-primary/10">

          {step === "password" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="mx-auto mb-2">
                  <img src="/logo.png" alt="Desi Party Vibes" className="h-16 w-auto" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Welcome back</CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="name@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Password</FormLabel>
                            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                              Forgot password?
                            </Link>
                          </div>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="pr-10"
                                {...field}
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
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginUser.isPending}
                    >
                      {loginUser.isPending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending code...</>
                        : "Log in"}
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 text-center text-sm">
                  <span className="text-muted-foreground">Don't have an account? </span>
                  <Link href="/register" className="text-primary font-medium hover:underline">
                    Sign up
                  </Link>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 2: Confirm login with OTP ── */}
          {step === "otp" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                  <Mail className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Check your email</CardTitle>
                <CardDescription>
                  Enter the 6-digit code we sent to <strong>{pendingEmail}</strong> to finish logging in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerify} className="space-y-5">
                  <div className="space-y-2 flex flex-col items-center">
                    <Label>Login code</Label>
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
                    {verifyError && <p className="text-sm text-destructive">{verifyError}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={confirmLoginOtp.isPending}>
                    {confirmLoginOtp.isPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
                      : "Verify & log in"}
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
                      onClick={() => setStep("password")}
                      className="flex items-center justify-center gap-1 mx-auto text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </button>
                  </div>
                </div>
              </CardContent>
            </>
          )}

        </Card>
      </div>
    </Layout>
  );
}
