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
import { PartyPopper, User, Store, Loader2, ArrowLeft, Smartphone, ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const COUNTRIES = [
  { code: "+1",   flag: "🇺🇸", name: "US/Canada" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "+33",  flag: "🇫🇷", name: "France" },
  { code: "+31",  flag: "🇳🇱", name: "Netherlands" },
  { code: "+960", flag: "🇲🇻", name: "Maldives" },
];

function CountryCodePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.code === value) ?? COUNTRIES[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-10 flex items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring shrink-0 font-medium"
        >
          <span>{selected.flag}</span>
          <span>{selected.code}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 max-h-72 overflow-auto" align="start">
        {COUNTRIES.map((c) => (
          <button
            key={`${c.code}-${c.name}`}
            type="button"
            onClick={() => { onChange(c.code); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors text-left ${c.code === value && c.name === selected.name ? "bg-primary/5 font-medium" : ""}`}
          >
            <span className="text-base">{c.flag}</span>
            <span className="font-mono text-muted-foreground w-10 shrink-0">{c.code}</span>
            <span className="truncate">{c.name}</span>
            {c.code === value && c.name === selected.name && (
              <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const formSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  phone: z.string().min(5, { message: "Enter a valid phone number." }),
  address: z.string().optional(),
  role: z.enum(["user", "vendor"], { required_error: "Please select an account type." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerUser = useRegisterUser();
  const sendOtp = useSendOtp();
  const { data: currentUser, isLoading: userLoading } = useGetCurrentUser();

  const [step, setStep] = useState<"form" | "verify">("form");
  const [savedValues, setSavedValues] = useState<FormValues | null>(null);
  const [savedFullPhone, setSavedFullPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [countryCode, setCountryCode] = useState("+1");

  const roleParam = new URLSearchParams(window.location.search).get("role");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      role: roleParam === "vendor" ? "vendor" : "user",
    },
  });

  useEffect(() => {
    if (!userLoading && currentUser) setLocation("/");
  }, [currentUser, userLoading, setLocation]);

  useEffect(() => {
    if (step !== "verify") return;
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown]);

  if (!userLoading && currentUser) return null;

  function buildFullPhone(localNumber: string) {
    const digits = localNumber.replace(/\D/g, "");
    return `${countryCode}${digits}`;
  }

  function dispatchOtp(values: FormValues) {
    const fullPhone = buildFullPhone(values.phone);
    sendOtp.mutate(
      { data: { phone: fullPhone } },
      {
        onSuccess: (data: any) => {
          setSavedValues(values);
          setSavedFullPhone(fullPhone);
          setOtpCode("");
          setOtpError("");
          setCountdown(60);
          setStep("verify");
          if (data?.devCode) {
            setDevCode(data.devCode);
            toast({
              title: "Dev mode — no SMS sent",
              description: `Your code is: ${data.devCode}`,
              duration: 30000,
            });
          }
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Couldn't send code",
            description: "Check the phone number and try again.",
          });
        },
      }
    );
  }

  function onSubmit(values: FormValues) {
    dispatchOtp(values);
  }

  function handleResend() {
    if (!savedValues) return;
    dispatchOtp(savedValues);
  }

  function handleVerify() {
    if (!savedValues) return;
    if (otpCode.length !== 6) { setOtpError("Enter the 6-digit code."); return; }
    setOtpError("");

    registerUser.mutate(
      { data: { ...savedValues, phone: savedFullPhone, otpCode } as any },
      {
        onSuccess: () => {
          toast({ title: "Account created!", description: "Welcome to Desi Party Vibes!" });
          window.location.href = "/";
        },
        onError: (error: any) => {
          const msg = error?.response?.data?.error || error.message || "Registration failed.";
          if (msg.toLowerCase().includes("verif") || msg.toLowerCase().includes("code")) {
            setOtpError(msg);
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

          {/* ── Step 1: Registration form ── */}
          {step === "form" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="mx-auto mb-2">
                  <img src="/logo.png" alt="Desi Party Vibes" className="h-16 w-auto" />
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

                    {/* Name */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl><Input placeholder="" {...field} /></FormControl>
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
                            <FormControl><Input placeholder="" {...field} /></FormControl>
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
                          <FormControl><Input type="email" placeholder="" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Phone with country picker */}
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile Number</FormLabel>
                          <div className="flex gap-2">
                            <CountryCodePicker value={countryCode} onChange={setCountryCode} />
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder=""
                                inputMode="numeric"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.replace(/[^\d\s\-().]/g, ""))}
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Address */}
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                          <FormControl><Input placeholder="" {...field} /></FormControl>
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
                          <FormControl><Input type="password" placeholder="" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={sendOtp.isPending}>
                      {sendOtp.isPending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending code...</>
                        : "Sign up"}
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 text-center text-sm">
                  <span className="text-muted-foreground">Already have an account? </span>
                  <Link href="/login" className="text-primary font-medium hover:underline">Log in</Link>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 2: OTP verification ── */}
          {step === "verify" && (
            <>
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                  <Smartphone className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-serif font-bold">Verify your number</CardTitle>
                <CardDescription>
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{savedFullPhone}</span>
                </CardDescription>
                {devCode && (
                  <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Dev mode — your code: <strong className="font-mono tracking-wider">{devCode}</strong>
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Input
                    placeholder=""
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="tracking-[0.5em] text-2xl font-mono text-center h-14"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setOtpError("");
                    }}
                    autoFocus
                  />
                  {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}
                </div>

                <Button
                  className="w-full"
                  onClick={handleVerify}
                  disabled={registerUser.isPending || otpCode.length !== 6}
                >
                  {registerUser.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating account...</>
                    : "Verify & create account"}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep("form"); setDevCode(null); }}
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
                      disabled={sendOtp.isPending}
                      className="text-primary font-medium hover:underline disabled:opacity-50"
                    >
                      {sendOtp.isPending ? "Sending..." : "Resend code"}
                    </button>
                  )}
                </div>
              </CardContent>
            </>
          )}

        </Card>
      </div>
    </Layout>
  );
}
