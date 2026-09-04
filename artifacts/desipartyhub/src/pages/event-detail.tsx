import { useRoute, Link } from "wouter";
import { useGetEvent, useListEvents } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { CalendarDays, MapPin, Ticket, ArrowLeft, Store, Languages, Share2, Info } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { EventCard } from "@/components/ui/event-card";

export default function EventDetail() {
  const [, params] = useRoute("/events/:id");
  const id = parseInt(params?.id || "0");
  const { data: event, isLoading } = useGetEvent(id, { query: { enabled: !!id } });
  const { toast } = useToast();

  // "More events from this organizer" - re-uses the public list endpoint
  // with the vendorId filter, same pattern as Sulekha's organizer page
  // showing an artist/organizer's other upcoming shows.
  const { data: moreFromOrganizer } = useListEvents(
    { vendorId: event?.vendorId ?? undefined, upcoming: true, limit: 4 },
    { query: { enabled: !!event?.vendorId } }
  );
  const otherEvents = (moreFromOrganizer?.events ?? []).filter((e) => e.id !== event?.id);

  const handleShare = async () => {
    if (!event) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url });
      } catch {
        // User cancelled the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ description: "Event link copied to clipboard" });
    } catch {
      toast({ variant: "destructive", description: "Couldn't copy the link" });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
          <Link href="/events"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Events</Link>
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : !event ? (
          <div className="text-center py-20">
            <h1 className="text-2xl font-serif font-bold mb-2">Event not found</h1>
            <p className="text-muted-foreground mb-6">This event may not exist or hasn't been approved yet.</p>
            <Button asChild>
              <Link href="/events">Browse Events</Link>
            </Button>
          </div>
        ) : (
          <>
            <Card className="overflow-hidden border-primary/10 shadow-sm">
              {event.imageUrl && (
                <AspectRatio ratio={16 / 9}>
                  <img src={event.imageUrl} alt={event.title} className="object-cover w-full h-full" />
                </AspectRatio>
              )}
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs bg-muted/50 border-primary/20 text-primary">
                    {event.category}
                  </Badge>
                  {event.language && (
                    <Badge variant="outline" className="text-xs bg-muted/50 border-secondary/40 text-secondary-foreground gap-1">
                      <Languages className="h-3 w-3" /> {event.language}
                    </Badge>
                  )}
                  {event.status !== "approved" && (
                    <Badge variant="secondary" className="text-xs capitalize">{event.status}</Badge>
                  )}
                </div>

                <div className="flex items-start justify-between gap-4">
                  <h1 className="font-serif text-3xl font-bold">{event.title}</h1>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={handleShare} aria-label="Share this event">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Structured "Event Details" block, similar to how Sulekha
                    lays out date/venue/organizer as a scannable list rather
                    than burying it all in prose. */}
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      {format(new Date(event.eventDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                      {event.endDate ? ` – ${format(new Date(event.endDate), "MMMM d, yyyy 'at' h:mm a")}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {event.venue ? `${event.venue}, ` : ""}
                      {event.city}, {event.state}
                    </span>
                  </div>
                  {event.vendorName && (
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      <span>
                        Hosted by{" "}
                        {event.vendorId ? (
                          <Link href={`/vendors/${event.vendorId}`} className="text-foreground font-medium hover:text-primary hover:underline">
                            {event.vendorName}
                          </Link>
                        ) : (
                          <span className="text-foreground font-medium">{event.vendorName}</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-foreground leading-relaxed whitespace-pre-line">{event.description}</p>

                {event.additionalInfo && (
                  <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Info className="h-4 w-4" /> Good to know
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{event.additionalInfo}</p>
                  </div>
                )}

                {event.ticketUrl && (
                  <Button asChild className="gap-1.5">
                    <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
                      <Ticket className="h-4 w-4" /> Tickets / More Info
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {otherEvents.length > 0 && (
              <div className="mt-10">
                <h2 className="font-serif text-xl font-bold mb-4">
                  More events from {event.vendorName}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {otherEvents.slice(0, 4).map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
