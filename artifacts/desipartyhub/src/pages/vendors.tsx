import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useListVendors, 
  useListCategories, 
  useListCities,
  useGetCurrentUser,
  useAddFavorite,
  useRemoveFavorite,
  useListFavorites
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { VendorCard } from "@/components/ui/vendor-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function Vendors() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  
  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const { data: favorites, refetch: refetchFavorites } = useListFavorites({ query: { enabled: !!user } });
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const vendorParams = {
    ...(search ? { search } : {}),
    ...(category && category !== "all" ? { category } : {}),
    ...(city && city !== "all" ? { city } : {}),
  };

  const { data: vendorData, isLoading } = useListVendors(vendorParams);

  const { data: categories } = useListCategories();
  const { data: cities } = useListCities();

  const favoriteIds = new Set(favorites?.map(f => f.id) || []);

  const handleToggleFavorite = (vendorId: number) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorite vendors.",
      });
      return;
    }

    if (favoriteIds.has(vendorId)) {
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

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Name or keyword..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>City</Label>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger>
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities?.map((c) => (
              <SelectItem key={`${c.city}-${c.state}`} value={c.city}>{c.city}, {c.state}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-4 flex gap-2">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => {
            setSearch("");
            setCategory("all");
            setCity("all");
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="bg-muted/30 py-8 border-b">
        <div className="container mx-auto px-4">
          <h1 className="font-serif text-3xl font-bold mb-2 text-foreground">Find Vendors</h1>
          <p className="text-muted-foreground">
            Discover the best professionals for your celebration.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Mobile Filters */}
          <div className="md:hidden flex justify-between items-center mb-4">
            <span className="font-medium">{vendorData?.total || 0} Results</span>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader className="mb-6">
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <FilterContent />
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Filters Sidebar */}
          <div className="hidden md:block w-64 shrink-0">
            <div className="sticky top-24">
              <h2 className="font-serif text-xl font-bold mb-6">Filters</h2>
              <FilterContent />
            </div>
          </div>

          {/* Results Grid */}
          <div className="flex-1">
            <div className="hidden md:flex justify-between items-center mb-6">
              <h2 className="font-medium text-muted-foreground">{vendorData?.total || 0} professionals found</h2>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-[400px] rounded-xl" />
                ))}
              </div>
            ) : vendorData?.vendors.length === 0 ? (
              <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed">
                <h3 className="text-xl font-medium mb-2">No vendors found</h3>
                <p className="text-muted-foreground">Try adjusting your filters to see more results.</p>
                <Button 
                  variant="outline" 
                  className="mt-6"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                    setCity("all");
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendorData?.vendors.map((vendor) => (
                  <VendorCard 
                    key={vendor.id} 
                    vendor={vendor} 
                    isFavorite={favoriteIds.has(vendor.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
