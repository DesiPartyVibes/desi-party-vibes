import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  useGetCurrentUser,
  useListVendors,
  useListCategories,
  useListMyVendorClaims,
  useCreateVendorClaim,
  useCreateVendor,
  useGetVendor,
  useUpdateVendor,
  useListVendorBookings,
  useUpdateBookingStatus,
  useListMyEvents,
  useDeleteEvent,
} from "@workspace/api-client-react";
import { Store, Search, Clock, Plus, Pencil, Inbox, CalendarDays, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { PhotoField } from "@/components/ui/photo-field";
import { EventFormDialog } from "@/components/events/event-form-dialog";

const registerSchema = z.object({
  name: z.string().min(2, "Business name is required"),
  categoryId: z.coerce.number().min(1, "Please choose a category"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  description: z.string().min(10, "Give customers a short description (10+ characters)"),
  priceMin: z.coerce.number().min(0),
  priceMax: z.coerce.number().min(0),
  imageUrl: z.string().url("Please add a photo for your listing"),
  phone: z.string().trim().min(7, "Phone number is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  website: z.string().url().optional().or(z.literal("")),
});

type RegisterValues = z.infer<typeof registerSchema>;

// Same shape as registerSchema minus the strict min-length requirements,
// since an existing listing may already have shorter values than a brand
// new one would be required to.
const editSchema = z.object({
  name: z.string().min(1, "Business name is required"),
  categoryId: z.coerce.number().min(1, "Please choose a category"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  description: z.string().min(1, "Description is required"),
  priceMin: z.coerce.number().min(0),
  priceMax: z.coerce.number().min(0),
  imageUrl: z.string().url("Please add a photo for your listing"),
  phone: z.string().trim().min(7, "Phone number is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  website: z.string().url().optional().or(z.literal("")),
});

type EditValues = z.infer<typeof editSchema>;

const eventStatusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

const bookingStatusLabels: Record<string, string> = {
  pending: "New Request",
  confirmed: "Confirmed",
  cancelled: "Declined",
  completed: "Completed",
};

const bookingStatusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  confirmed: "default",
  cancelled: "destructive",
  completed: "secondary",
};

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

  const { data: categories } = useListCategories();
  const createClaim = useCreateVendorClaim();
  const createVendor = useCreateVendor();

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      categoryId: 0,
      city: "",
      state: "",
      description: "",
      priceMin: 0,
      priceMax: 0,
      imageUrl: "",
      phone: "",
      email: "",
      website: "",
    },
  });

  const approvedClaim = claims?.find((c) => c.status === "approved");
  const pendingClaims = claims?.filter((c) => c.status === "pending") ?? [];

  // Full listing details for the owned business, so the edit dialog can be
  // pre-filled with the current values rather than starting blank.
  const { data: myVendor } = useGetVendor(approvedClaim?.vendorId ?? 0, {
    query: { enabled: !!approvedClaim },
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const updateVendor = useUpdateVendor();
  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      categoryId: 0,
      city: "",
      state: "",
      description: "",
      priceMin: 0,
      priceMax: 0,
      imageUrl: "",
      phone: "",
      email: "",
      website: "",
    },
  });

  useEffect(() => {
    if (myVendor) {
      editForm.reset({
        name: myVendor.name,
        categoryId: myVendor.categoryId,
        city: myVendor.city,
        state: myVendor.state,
        description: myVendor.description,
        priceMin: myVendor.priceMin,
        priceMax: myVendor.priceMax,
        imageUrl: myVendor.imageUrl,
        phone: myVendor.phone ?? "",
        email: myVendor.email ?? "",
        website: myVendor.website ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myVendor?.id]);

  // Incoming booking requests against the vendor's own listing.
  const { data: vendorBookings, refetch: refetchBookings } = useListVendorBookings({
    query: { enabled: !!approvedClaim },
  });
  const updateBookingStatus = useUpdateBookingStatus();

  const handleBookingDecision = (bookingId: number, status: "confirmed" | "cancelled") => {
    updateBookingStatus.mutate(
      { id: bookingId, data: { status } },
      {
        onSuccess: () => {
          toast({
            description: status === "confirmed" ? "Booking confirmed." : "Booking declined.",
          });
          refetchBookings();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't update booking",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  };

  // My submitted events, any status - shown once the vendor account itself
  // is verified, same gate as submitting one in the first place.
  const { data: myEvents, refetch: refetchEvents } = useListMyEvents({
    query: { enabled: !!user?.isVerified },
  });
  const deleteEvent = useDeleteEvent();

  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);

  const handleDeleteEvent = (eventId: number) => {
    deleteEvent.mutate(
      { id: eventId },
      {
        onSuccess: () => {
          toast({ description: "Event removed." });
          refetchEvents();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't remove event",
            description: err?.data?.error || "Please try again.",
          });
        },
      }
    );
  };

  if (!userLoading && (!user || user.role !== "vendor")) {
    setLocation("/");
    return null;
  }

  if (userLoading) return null;

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

  const openRegisterDialog = () => {
    registerForm.reset({
      name: search.trim() || "",
      categoryId: categories?.[0]?.id || 0,
      city: "",
      state: "",
      description: "",
      priceMin: 0,
      priceMax: 0,
      imageUrl: "",
      phone: "",
      email: "",
      website: "",
    });
    setIsRegisterOpen(true);
  };

  const onRegisterSubmit = (values: RegisterValues) => {
    const { email, website, ...rest } = values;
    createVendor.mutate(
      {
        data: {
          ...rest,
          email: email || undefined,
          website: website || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Business registered!", description: "Your listing is live and linked to your account." });
          setIsRegisterOpen(false);
          refetchClaims();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't register your business",
            description: err?.data?.error || "Please check the form and try again.",
          });
        },
      }
    );
  };

  const onEditSubmit = (values: EditValues) => {
    if (!approvedClaim) return;
    const { email, website, ...rest } = values;
    updateVendor.mutate(
      {
        id: approvedClaim.vendorId,
        data: {
          ...rest,
          email: email || undefined,
          website: website || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ description: "Your listing has been updated." });
          setIsEditOpen(false);
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't update your listing",
            description: err?.data?.error || "Please check the form and try again.",
          });
        },
      }
    );
  };

  const registerDialog = (
    <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register Your Business</DialogTitle>
        </DialogHeader>
        <Form {...registerForm}>
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4 pt-2">
            <FormField
              control={registerForm.control}
              name="name"
              render={({ field }) => (
                <FormItem><FormLabel>Business Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={registerForm.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ? field.value.toString() : undefined}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories?.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={registerForm.control}
                name="city"
                render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="state"
                render={({ field }) => (
                  <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="priceMin"
                render={({ field }) => (
                  <FormItem><FormLabel>Min Price ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="priceMax"
                render={({ field }) => (
                  <FormItem><FormLabel>Max Price ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
            </div>
            <PhotoField control={registerForm.control} />
            <FormField
              control={registerForm.control}
              name="description"
              render={({ field }) => (
                <FormItem><FormLabel>Short Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={registerForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={registerForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={registerForm.control} name="website" render={({ field }) => (<FormItem><FormLabel>Website</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>)} />

            <Button type="submit" className="w-full" disabled={createVendor.isPending}>
              {createVendor.isPending ? "Registering..." : "Register My Business"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  const editDialog = (
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Your Listing</DialogTitle>
        </DialogHeader>
        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
            <FormField
              control={editForm.control}
              name="name"
              render={({ field }) => (
                <FormItem><FormLabel>Business Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={editForm.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ? field.value.toString() : undefined}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories?.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={editForm.control}
                name="city"
                render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="state"
                render={({ field }) => (
                  <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="priceMin"
                render={({ field }) => (
                  <FormItem><FormLabel>Min Price ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="priceMax"
                render={({ field }) => (
                  <FormItem><FormLabel>Max Price ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
            </div>
            <PhotoField control={editForm.control} />
            <FormField
              control={editForm.control}
              name="description"
              render={({ field }) => (
                <FormItem><FormLabel>Short Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={editForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={editForm.control} name="website" render={({ field }) => (<FormItem><FormLabel>Website</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>)} />

            <Button type="submit" className="w-full" disabled={updateVendor.isPending}>
              {updateVendor.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  const eventDialog = (
    <EventFormDialog
      open={isEventDialogOpen}
      onOpenChange={setIsEventDialogOpen}
      onSubmitted={refetchEvents}
      defaultCity={myVendor?.city}
      defaultState={myVendor?.state}
      vendorClaim={approvedClaim ? { vendorId: approvedClaim.vendorId, vendorName: approvedClaim.vendorName } : null}
    />
  );

  return (
    <Layout>
      <div className="bg-slate-900 text-white py-8">
        <div className="container mx-auto px-4 flex items-center gap-3">
          <Store className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-serif font-bold">My Business</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        {!user?.isVerified && user?.isRejected && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-6 text-destructive">
              Your vendor application was not approved. If you believe this was a mistake or have questions, please contact our support team.
            </CardContent>
          </Card>
        )}

        {!user?.isVerified && !user?.isRejected && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6 text-amber-800 dark:text-amber-500">
              Your vendor account is pending admin approval. You'll be able to claim or register a business listing once approved.
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
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit Listing
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/vendors/${approvedClaim.vendorId}`}>View Listing</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : user?.isVerified ? (
          <Card>
            <CardHeader>
              <CardTitle>Is Your Business Already Listed?</CardTitle>
              <p className="text-sm text-muted-foreground pt-1">
                If we've already added your business to Desi Party Vibes, search for it below and claim it so you're recognized as the owner.
                Can't find it? You can register it yourself instead.
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
                <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">No matching listings found for "{searchTerm}".</p>
                  <Button size="sm" variant="outline" onClick={openRegisterDialog} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Register "{searchTerm}" as a New Business
                  </Button>
                </div>
              )}

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={openRegisterDialog}
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Don't see your business at all? Register it instead.
                </button>
              </div>
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

        {approvedClaim && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Incoming Bookings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!vendorBookings || vendorBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No booking requests yet.</p>
              ) : (
                vendorBookings.map((b) => (
                  <div key={b.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{b.userName}</p>
                      <Badge variant={bookingStatusVariants[b.status] ?? "outline"}>
                        {bookingStatusLabels[b.status] ?? b.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {b.eventType} · {b.eventDate} · {b.guestCount} guests
                    </p>
                    {b.message && <p className="text-sm">{b.message}</p>}
                    {b.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleBookingDecision(b.id, "confirmed")}
                          disabled={updateBookingStatus.isPending}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBookingDecision(b.id, "cancelled")}
                          disabled={updateBookingStatus.isPending}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {user?.isVerified && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Your Events</CardTitle>
              </div>
              <Button size="sm" onClick={() => setIsEventDialogOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Submit Event
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {!myEvents || myEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">You haven't submitted any events yet.</p>
              ) : (
                myEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between border rounded-lg p-3 gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(e.eventDate), "MMM d, yyyy")} · {e.city}, {e.state}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={eventStatusVariants[e.status] ?? "outline"} className="capitalize">
                        {e.status}
                      </Badge>
                      {e.status !== "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteEvent(e.id)}
                          disabled={deleteEvent.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {registerDialog}
      {editDialog}
      {eventDialog}
    </Layout>
  );
}
