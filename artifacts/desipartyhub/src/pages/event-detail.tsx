import { useRoute, Link } from "wouter";
import { useGetEvent } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { CalendarDays, MapPin, Ticket, ArrowLeft, Store } from "lucide-react";
import { format } from "date-fns";

export default function EventDetail() {
  const [, params] = useRoute("/events/:id");
  const id = parseInt(params?.id || "0");
  const { data: event, isLoading } = useGetEvent(id, { query: { enabled: !!id } });

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
          <Card className="overflow-hidden border-primary/10 shadow-sm">
            {event.imageUrl && (
              <AspectRatio ratio={16 / 9}>
                <img src={event.imageUrl} alt={event.title} className="object-cover w-full h-full" />
              </AspectRatio>
            )}
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-muted/50 border-primary/20 text-primary">
                  {event.category}
                </Badge>
                {event.status !== "approved" && (
                  <Badge variant="secondary" className="text-xs capitalize">{event.status}</Badge>
                )}
              </div>

              <h1 className="font-serif text-3xl font-bold">{event.title}</h1>

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
                    <span>Hosted by {event.vendorName}</span>
                  </div>
                )}
              </div>

              <p className="text-foreground leading-relaxed whitespace-pre-line">{event.description}</p>

              {event.ticketUrl && (
                <Button asChild className="gap-1.5">
                  <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
                    <Ticket className="h-4 w-4" /> Tickets / More Info
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
