import { Link } from "wouter";
import { Event } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, Share2, Sparkles } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface EventCardProps {
  event: Event;
}

// An event is "Just Listed" for a few days after it's approved and goes
// live - a lightweight, no-schema-change stand-in for the "Just Listed" /
// urgency badges Sulekha Events shows, using the createdAt we already have.
const JUST_LISTED_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

export function EventCard({ event }: EventCardProps) {
  const date = new Date(event.eventDate);
  const { toast } = useToast();
  const isJustListed = Date.now() - new Date(event.createdAt).getTime() < JUST_LISTED_WINDOW_MS;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/events/${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url });
      } catch {
        // User cancelled the share sheet - nothing to do.
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
    <Card className="group overflow-hidden transition-all hover:shadow-lg border-muted">
      <Link href={`/events/${event.id}`}>
        <div className="relative">
          <AspectRatio ratio={4 / 3}>
            {event.imageUrl ? (
              <img
                src={event.imageUrl}
                alt={event.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <CalendarDays className="h-10 w-10 text-primary/50" />
              </div>
            )}
          </AspectRatio>
          <Badge className="absolute top-3 left-3 bg-primary/90 text-primary-foreground border-none">
            {format(date, "MMM d")}
          </Badge>
          {isJustListed && (
            <Badge className="absolute top-3 right-3 bg-amber-500/90 text-white border-none gap-1">
              <Sparkles className="h-3 w-3" /> Just Listed
            </Badge>
          )}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute bottom-3 right-3 h-8 w-8 rounded-full opacity-90 hover:opacity-100"
            onClick={handleShare}
            aria-label="Share this event"
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="outline" className="text-xs bg-muted/50 border-primary/20 text-primary">
              {event.category}
            </Badge>
            {event.language && (
              <Badge variant="outline" className="text-xs bg-muted/50 border-secondary/40 text-secondary-foreground">
                {event.language}
              </Badge>
            )}
          </div>

          <h3 className="font-serif text-xl font-semibold line-clamp-1 mb-1 group-hover:text-primary transition-colors">
            {event.title}
          </h3>

          <div className="flex items-center text-sm text-muted-foreground mb-2 gap-1">
            <CalendarDays className="h-4 w-4" />
            <span>{format(date, "EEEE, MMM d, yyyy 'at' h:mm a")}</span>
          </div>

          <div className="flex items-center text-sm text-muted-foreground mb-3 gap-1">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">
              {event.venue ? `${event.venue}, ` : ""}
              {event.city}, {event.state}
            </span>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 h-10">{event.description}</p>

          {event.vendorName && (
            <div className="border-t border-border pt-3 mt-3 text-sm text-muted-foreground">
              Hosted by <span className="text-foreground font-medium">{event.vendorName}</span>
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}
