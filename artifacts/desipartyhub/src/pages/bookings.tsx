import { useLocation } from "wouter";
import { useListBookings, useGetCurrentUser } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Calendar, Users, Store, MessageSquare } from "lucide-react";

export default function Bookings() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: bookings, isLoading } = useListBookings({ query: { enabled: !!user } });

  if (!userLoading && !user) {
    setLocation("/login");
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <Badge className="bg-green-500 hover:bg-green-600">Confirmed</Badge>;
      case 'pending': return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Pending</Badge>;
      case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>;
      case 'completed': return <Badge className="bg-blue-500">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="bg-muted/30 py-8 border-b">
        <div className="container mx-auto px-4">
          <h1 className="font-serif text-3xl font-bold text-foreground">My Inquiries & Bookings</h1>
          <p className="text-muted-foreground">Manage your communications with vendors.</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
          </div>
        ) : bookings?.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-xl border border-dashed">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-medium mb-2">No bookings yet</h3>
            <p className="text-muted-foreground">You haven't sent any inquiries to vendors.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings?.map((booking) => (
              <Card key={booking.id} className="overflow-hidden">
                <div className="bg-muted/30 px-6 py-3 border-b flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    Sent on {format(new Date(booking.createdAt), "MMM d, yyyy")}
                  </div>
                  {getStatusBadge(booking.status)}
                </div>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-xl font-serif font-bold mb-4">{booking.vendorName}</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span><span className="font-medium text-foreground">Date:</span> {format(new Date(booking.eventDate), "MMM d, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <Store className="h-4 w-4" />
                          <span><span className="font-medium text-foreground">Event:</span> {booking.eventType}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span><span className="font-medium text-foreground">Guests:</span> {booking.guestCount}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 relative">
                      <MessageSquare className="h-4 w-4 absolute top-4 left-4 text-muted-foreground" />
                      <p className="pl-6 text-sm text-muted-foreground italic">
                        "{booking.message}"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
