import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetCurrentUser,
  useListVendors,
  useListMyVendorClaims,
  useCreateVendorClaim,
} from "@workspace/api-client-react";
import { Store, Search, Clock } from "lucide-react";

export default function VendorDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();

  const { data: claims, refetch: refetchClaims } = useListMyVendorClaims({
    query: { enabled: !!user && user.role === "vendor" },
  });

  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: searchResults, isLoading: searchLoading } = useListVendors(
    { search: searchTerm, limit: 10 },
    { query: { enabled: searchTerm.trim().length > 1 } }
  );

  const createClaim = useCreateVendorClaim();

  if (!userLoading && (!user || user.role !== "vendor")) {
    setLocation("/");
    return null;
  }

  if (userLoading) return null;

  const approvedClaim = claims?.find((c) => c.status === "approved");
  const pendingClaims = claims?.filter((c) => c.status === "pending") ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(search.trim());
  };

  const handleClaim = (vendorId: number) => {
    createClaim.mutate(
      { data: { vendorId } },
      {
        onSuccess: () => {
          toast({ description: "Claim submitted — an admin will review it shortly." });
          refetchClaims();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't submit claim",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="bg-slate-900 text-white py-8">
        <div className="container mx-auto px-4 flex items-center gap-3">
          <Store className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-serif font-bold">My Business</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {!user?.isVerified && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6 text-amber-800 dark:text-amber-500">
              Your vendor account is pending admin approval. You'll be able to claim a business listing once approved.
            </CardContent>
          </Card>
        )}

        {approvedClaim ? (
          <Card>
            <CardHeader>
              <CardTitle>Your Business</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium">{approvedClaim.vendorName}</p>
                <p className="text-sm text-muted-foreground">Linked to your account</p>
              </div>
              <Button variant="outline" asChild>
                <a href={`/vendors/${approvedClaim.vendorId}`}>View Listing</a>
              </Button>
            </CardContent>
          </Card>
        ) : user?.isVerified ? (
          <Card>
            <CardHeader>
              <CardTitle>Is Your Business Already Listed?</CardTitle>
              <p className="text-sm text-muted-foreground pt-1">
                If we've already added your business to Desi Party Vibes, search for it below and claim it so you're recognized as the owner.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by business name..."
                />
                <Button type="submit"><Search className="h-4 w-4" /></Button>
              </form>

              {searchLoading && <p className="text-sm text-muted-foreground">Searching...</p>}

              {searchResults && searchResults.vendors.length > 0 && (
                <div className="space-y-2">
                  {searchResults.vendors.map((v) => (
                    <div key={v.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div>
                        <p className="font-medium">{v.name}</p>
                        <p className="text-sm text-muted-foreground">{v.city}, {v.state} · {v.categoryName}</p>
                      </div>
                      {v.isClaimed ? (
                        <Badge variant="secondary">Already Claimed</Badge>
                      ) : pendingClaims.some((c) => c.vendorId === v.id) ? (
                        <Badge variant="outline">Claim Pending</Badge>
                      ) : (
                        <Button size="sm" onClick={() => handleClaim(v.id)} disabled={createClaim.isPending}>
                          This Is My Business
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchTerm && !searchLoading && searchResults?.vendors.length === 0 && (
                <p className="text-sm text-muted-foreground">No matching listings found.</p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {pendingClaims.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Pending Claim Requests</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {pendingClaims.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.vendorName}</span>
                  <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending Review</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
