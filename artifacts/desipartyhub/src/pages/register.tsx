import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegisterUser, useGetCurrentUser } from "@workspace/api-client-react";
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
import { PartyPopper, User, Store } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(["user", "vendor"], { required_error: "Please select an account type." }),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerUser = useRegisterUser();
  const { data: currentUser, isLoading: userLoading } = useGetCurrentUser();

  const roleParam = new URLSearchParams(window.location.search).get("role");
  const defaultRole = roleParam === "vendor" ? "vendor" : "user";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: defaultRole,
    },
  });

  useEffect(() => {
    if (!userLoading && currentUser) {
      setLocation("/");
    }
  }, [currentUser, userLoading, setLocation]);

  if (!userLoading && currentUser) {
    return null;
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    registerUser.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({
            title: "Account created!",
            description: "You have successfully registered.",
          });
          window.location.href = "/";
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: error.message || "An error occurred during registration.",
          });
        },
      }
    );
  }

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-lg border-primary/10">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
              <PartyPopper className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-serif font-bold">Create an account</CardTitle>
            <CardDescription>
              Join the premium Indian celebrations marketplace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>I am a...</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-2 gap-4"
                        >
                          <label className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 p-4 hover:border-primary/50 ${field.value === 'user' ? 'border-primary bg-primary/5' : 'border-muted'}`}>
                            <RadioGroupItem value="user" className="sr-only" />
                            <User className={`h-6 w-6 ${field.value === 'user' ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className={`text-sm font-medium ${field.value === 'user' ? 'text-primary' : 'text-foreground'}`}>
                              Customer
                            </span>
                          </label>
                          <label className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 p-4 hover:border-primary/50 ${field.value === 'vendor' ? 'border-primary bg-primary/5' : 'border-muted'}`}>
                            <RadioGroupItem value="vendor" className="sr-only" />
                            <Store className={`h-6 w-6 ${field.value === 'vendor' ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className={`text-sm font-medium ${field.value === 'vendor' ? 'text-primary' : 'text-foreground'}`}>
                              Vendor
                            </span>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Anjali Sharma" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" type="email" {...field} />
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={registerUser.isPending}
                >
                  {registerUser.isPending ? "Creating account..." : "Sign up"}
                </Button>
              </form>
            </Form>
            
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link href="/login" className="text-primary font-medium hover:underline">
                Log in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
