import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegisterUser, useSendOtp, useGetCurrentUser } from "@workspace/api-client-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { PartyPopper, User, Store, Phone, CheckCircle2, Loader2 } from "lucide-react";

const formSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  phone: z.string().min(7, { message: "Enter a valid phone number." }),
  address: z.string().optional(),
  role: z.enum(["user", "vendor"], { required_error: "Please select an account type." }),
  otpCode: z.string().length(6, { message: "Enter the 6-digit code." }),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerUser = useRegisterUser();
  const sendOtp = useSendOtp();
  const { data: currentUser, isLoading: userLoading } = useGetCurrentUser();

  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  const roleParam = new URLSearchParams(window.location.search).get("role");
  const defaultRole = roleParam === "vendor" ? "vendor" : "user";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      role: defaultRole,
      otpCode: "",
    },
  });

  useEffect(() => {
    if (!userLoading && currentUser) setLocation("/");
  }, [currentUser, userLoading, setLocation]);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  if (!userLoading && currentUser) return null;

  async function handleSendCode() {
    const phone = form.getValues("phone");
    if (!phone || phone.length < 7) {
      form.setError("phone", { message: "Enter a valid phone number first." });
      return;
    }

    sendOtp.mutate(
      { data: { phone } },
      {
        onSuccess: (data: any) => {
          setOtpSent(true);
          setOtpCountdown(60);
          if (data?.devCode) {
            setDevCode(data.devCode);
            toast({
              title: "Dev Mode — No SMS sent",
              description: `Your code is: ${data.devCode}`,
              duration: 30000,
            });
          } else {
            toast({
              title: "Code sent!",
              description: `A 6-digit code was sent to ${phone}.`,
            });
          }
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Failed to send code",
            description: "Please check the phone number and try again.",
          });
        },
      }
    );
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    registerUser.mutate(
      { data: values as any },
      {
        onSuccess: () => {
          toast({ title: "Account created!", description: "Welcome to Desi Party Vibes!" });
          window.location.href = "/";
        },
        onError: (error: any) => {
          const msg = error?.response?.data?.error || error.message || "Registration failed.";
          if (msg.toLowerCase().includes("verification")) {
            form.setError("otpCode", { message: msg });
          } else {
            toast({ variant: "destructive", title: "Registration failed", description: msg });
          }
        },
      }
    );
  }

  const watchedRole = form.watch("role");

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
        <Card className="w-full max-w-lg shadow-lg border-primary/10">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
              <PartyPopper className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-serif font-bold">Create an account</CardTitle>
            <CardDescription>Join the premier Indian celebrations marketplace</CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                {/* Account type */}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>I am a...</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                          <label className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 p-4 hover:border-primary/50 ${watchedRole === "user" ? "border-primary bg-primary/5" : "border-muted"}`}>
                            <RadioGroupItem value="user" className="sr-only" />
                            <User className={`h-6 w-6 ${watchedRole === "user" ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-sm font-medium ${watchedRole === "user" ? "text-primary" : "text-foreground"}`}>Customer</span>
                          </label>
                          <label className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 p-4 hover:border-primary/50 ${watchedRole === "vendor" ? "border-primary bg-primary/5" : "border-muted"}`}>
                            <RadioGroupItem value="vendor" className="sr-only" />
                            <Store className={`h-6 w-6 ${watchedRole === "vendor" ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-sm font-medium ${watchedRole === "vendor" ? "text-primary" : "text-foreground"}`}>Vendor</span>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Name row */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl><Input placeholder="Anjali" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input placeholder="Sharma" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="name@example.com" type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Phone + Send Code */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="+1 (813) 555-0123"
                            type="tel"
                            {...field}
                            disabled={otpSent}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant={otpSent ? "outline" : "secondary"}
                          className="shrink-0 text-sm px-3"
                          onClick={handleSendCode}
                          disabled={sendOtp.isPending || otpCountdown > 0}
                        >
                          {sendOtp.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : otpSent ? (
                            otpCountdown > 0 ? `Resend (${otpCountdown}s)` : "Resend"
                          ) : (
                            "Send Code"
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* OTP field — shown after code is sent */}
                {otpSent && (
                  <FormField
                    control={form.control}
                    name="otpCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-primary" />
                          Verification Code
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="6-digit code"
                            maxLength={6}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="tracking-widest text-lg font-mono text-center"
                            {...field}
                          />
                        </FormControl>
                        {devCode && (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Dev mode — your code: <strong>{devCode}</strong>
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Address */}
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                      <FormControl><Input placeholder="123 Main St, Tampa, FL 33601" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerUser.isPending || !otpSent}
                >
                  {registerUser.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account...</>
                  ) : !otpSent ? (
                    "Verify your number to sign up"
                  ) : (
                    "Sign up"
                  )}
                </Button>

                {!otpSent && (
                  <p className="text-xs text-center text-muted-foreground">
                    Enter your mobile number and click <strong>Send Code</strong> to verify it before signing up.
                  </p>
                )}

              </form>
            </Form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link href="/login" className="text-primary font-medium hover:underline">Log in</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
