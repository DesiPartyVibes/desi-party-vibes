import { Link } from "wouter";
import { Event } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { format } from "date-fns";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const date = new Date(event.eventDate);

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
        </div>
        <CardContent className="p-5">
          <Badge variant="outline" className="text-xs bg-muted/50 border-primary/20 text-primary mb-2">
            {event.category}
          </Badge>

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
