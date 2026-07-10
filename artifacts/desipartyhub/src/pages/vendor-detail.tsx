import { useState } from "react";
import { useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetVendor, 
  useListVendorReviews,
  useCreateBooking,
  useCreateReview,
  useGetCurrentUser,
  useAddFavorite,
  useRemoveFavorite,
  useListFavorites,
  getGetVendorQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MapPin, Star, Heart, Phone, Mail, Globe, Calendar, Users, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const bookingSchema = z.object({
  eventDate: z.string().min(1, { message: "Date is required" }),
  eventType: z.string().min(1, { message: "Event type is required" }),
  guestCount: z.coerce.number().min(1, { message: "Guest count is required" }),
  message: z.string().min(10, { message: "Please provide some details about your event" }),
});

const reviewSchema = z.object({
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().min(5, { message: "Review must be at least 5 characters" }).optional().or(z.literal("")),
});

function StarRatingInput({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          className="p-0.5"
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              star <= active ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function VendorDetail() {
  const [, params] = useRoute("/vendors/:id");
  const vendorId = parseInt(params?.id || "0");
  
  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const { data: vendor, isLoading } = useGetVendor(vendorId, { query: { enabled: !!vendorId, queryKey: getGetVendorQueryKey(vendorId) } });
  const { data: reviews, refetch: refetchReviews } = useListVendorReviews(vendorId, { query: { enabled: !!vendorId } });
  const { data: favorites, refetch: refetchFavorites } = useListFavorites({ query: { enabled: !!user } });
  
  const createBooking = useCreateBooking();
  const createReview = useCreateReview();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const isFavorite = favorites?.some(f => f.id === vendorId) || false;

  const bookingForm = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      eventDate: "",
      eventType: "",
      guestCount: 100,
      message: "",
    },
  });

  const reviewForm = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: "",
    },
  });

  const handleToggleFavorite = () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to save vendors." });
      return;
    }

    if (isFavorite) {
      removeFavorite.mutate(
        { vendorId },
        {
          onSuccess: () => {
            refetchFavorites();
            toast({ description: "Removed from favorites" });
          }
        }
      );
    } else {
      addFavorite.mutate(
        { data: { vendorId } },
        {
          onSuccess: () => {
            refetchFavorites();
            toast({ description: "Added to favorites" });
          }
        }
      );
    }
  };

  const onBookingSubmit = (values: z.infer<typeof bookingSchema>) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to send an inquiry." });
      return;
    }

    createBooking.mutate(
      { data: { vendorId, ...values } },
      {
        onSuccess: () => {
          toast({ title: "Inquiry sent!", description: "The vendor will contact you soon." });
          bookingForm.reset();
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to send inquiry." });
        }
      }
    );
  };

  const onReviewSubmit = (values: z.infer<typeof reviewSchema>) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to leave a review." });
      return;
    }

    createReview.mutate(
      { vendorId, data: { rating: values.rating, comment: values.comment ? values.comment : undefined } },
      {
        onSuccess: () => {
          toast({ title: "Review added!", description: "Thank you for your feedback." });
          reviewForm.reset();
          refetchReviews();
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to add review." });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-[400px] w-full rounded-2xl mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div><Skeleton className="h-[500px] w-full" /></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!vendor) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Vendor not found</h1>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero Image */}
      <div className="w-full h-[400px] md:h-[500px] relative">
        <img src={vendor.imageUrl} alt={vendor.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 text-white">
          <div className="container mx-auto">
            <Badge className="bg-primary hover:bg-primary/90 border-none mb-4">
              {vendor.categoryName}
            </Badge>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-serif font-bold mb-2">{vendor.name}</h1>
                <div className="flex items-center gap-4 text-white/90">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{vendor.city}, {vendor.state}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{vendor.rating.toFixed(1)}</span>
                    <span>({vendor.reviewCount} reviews)</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-white/10 border-white/20 hover:bg-white/20 text-white backdrop-blur-sm"
                onClick={handleToggleFavorite}
              >
                <Heart className={`mr-2 h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                {isFavorite ? "Saved" : "Save to Favorites"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* About */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">About</h2>
              <div className="prose max-w-none text-muted-foreground whitespace-pre-wrap">
                {vendor.longDescription || vendor.description}
              </div>
            </section>

            {/* Gallery (if any) */}
            {vendor.gallery && vendor.gallery.length > 0 && (
              <section>
                <h2 className="text-2xl font-serif font-bold mb-4">Gallery</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {vendor.gallery.map((img, i) => (
                    <img key={i} src={img} alt={`${vendor.name} gallery ${i}`} className="w-full h-48 object-cover rounded-xl" />
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-6">Reviews</h2>
              
              <Tabs defaultValue="reviews">
                <TabsList className="mb-6">
                  <TabsTrigger value="reviews">All Reviews</TabsTrigger>
                  <TabsTrigger value="write">Write a Review</TabsTrigger>
                </TabsList>
                
                <TabsContent value="reviews" className="space-y-6">
                  {reviews?.length === 0 ? (
                    <p className="text-muted-foreground italic">No reviews yet. Be the first to review!</p>
                  ) : (
                    reviews?.map((review) => (
                      <div key={review.id} className="border-b pb-6 last:border-0">
                        <div className="flex items-center gap-4 mb-2">
                          <Avatar>
                            <AvatarImage src={review.userAvatarUrl || ""} />
                            <AvatarFallback>{review.userName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{review.userName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="flex text-yellow-400">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-current" : "text-muted"}`} />
                                ))}
                              </div>
                              <span>{format(new Date(review.createdAt), "MMM d, yyyy")}</span>
                            </div>
                          </div>
                        </div>
                        {review.comment && <p className="text-foreground mt-3">{review.comment}</p>}
                      </div>
                    ))
                  )}
                </TabsContent>
                
                <TabsContent value="write">
                  <Card>
                    <CardContent className="pt-6">
                      <Form {...reviewForm}>
                        <form onSubmit={reviewForm.handleSubmit(onReviewSubmit)} className="space-y-4">
                          <FormField
                            control={reviewForm.control}
                            name="rating"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rating</FormLabel>
                                <FormControl>
                                  <StarRatingInput value={field.value} onChange={field.onChange} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={reviewForm.control}
                            name="comment"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Your Review <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                                <FormControl>
                                  <Textarea rows={4} placeholder="Share your experience..." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" disabled={createReview.isPending}>
                            {createReview.isPending ? "Submitting..." : "Submit Review"}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </section>
          </div>

          {/* Sidebar / Booking Form */}
          <div className="space-y-6">
            <Card className="border-primary/20 shadow-lg sticky top-24">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-xl font-serif">Request Pricing & Info</CardTitle>
                <div className="text-lg font-medium text-primary mt-2">
                  ${vendor.priceMin.toLocaleString()} - ${vendor.priceMax.toLocaleString()}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...bookingForm}>
                  <form onSubmit={bookingForm.handleSubmit(onBookingSubmit)} className="space-y-4">
                    <FormField
                      control={bookingForm.control}
                      name="eventType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select event type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {["Wedding", "Birthday Party", "Engagement", "Baby Shower", "Mehndi Night", "Sangeet", "Garba", "Corporate Event", "Other"].map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={bookingForm.control}
                        name="eventDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Event Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={bookingForm.control}
                        name="guestCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Guests</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={bookingForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message to Vendor</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Hi! I'm interested in your services for my upcoming event..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full text-lg h-12" disabled={createBooking.isPending}>
                      {createBooking.isPending ? "Sending..." : "Send Inquiry"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-medium text-lg border-b pb-2 mb-4">Contact Info</h3>
                {vendor.phone && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone className="h-5 w-5 text-primary" />
                    <span>{vendor.phone}</span>
                  </div>
                )}
                {vendor.email && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Mail className="h-5 w-5 text-primary" />
                    <span>{vendor.email}</span>
                  </div>
                )}
                {vendor.website && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Globe className="h-5 w-5 text-primary" />
                    <a href={vendor.website} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                      Visit Website
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
