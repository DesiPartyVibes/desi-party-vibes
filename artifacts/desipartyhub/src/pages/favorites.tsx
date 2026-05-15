import { useLocation } from "wouter";
import { useListFavorites, useGetCurrentUser, useRemoveFavorite } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { VendorCard } from "@/components/ui/vendor-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Favorites() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: favorites, isLoading: favoritesLoading, refetch } = useListFavorites({ 
    query: { enabled: !!user } 
  });
  const removeFavorite = useRemoveFavorite();
  const { toast } = useToast();

  if (!userLoading && !user) {
    setLocation("/login");
    return null;
  }

  const handleRemoveFavorite = (vendorId: number) => {
    removeFavorite.mutate(
      { vendorId },
      {
        onSuccess: () => {
          refetch();
          toast({ description: "Removed from favorites" });
        }
      }
    );
  };

  return (
    <Layout>
      <div className="bg-muted/30 py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-8 w-8 text-red-500 fill-red-500" />
            <h1 className="font-serif text-3xl font-bold text-foreground">Saved Vendors</h1>
          </div>
          <p className="text-muted-foreground">
            Your shortlisted professionals for the big day.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {favoritesLoading || userLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[400px] rounded-xl" />
            ))}
          </div>
        ) : favorites?.length === 0 ? (
          <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed">
            <Heart className="h-16 w-16 text-muted mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold mb-2">No saved vendors yet</h2>
            <p className="text-muted-foreground mb-6">Start exploring vendors and save your favorites here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {favorites?.map((vendor) => (
              <VendorCard 
                key={vendor.id} 
                vendor={vendor} 
                isFavorite={true}
                onToggleFavorite={handleRemoveFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
