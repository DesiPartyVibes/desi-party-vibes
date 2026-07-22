import { useLocation } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

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
                  <p className="text-muted-foreground mb-3">{user.email}</p>
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
              <div className="space-y-6">
                <h3 className="font-medium text-lg border-b pb-2">Account Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Contact support to update your profile information or change your password.
                </p>
                <div className="flex gap-4">
                  <Button variant="outline">Contact Support</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Layout>
  );
}
