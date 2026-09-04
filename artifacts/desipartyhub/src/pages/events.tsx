import { useState } from "react";
import {
  useListEvents,
  useGetCurrentUser,
  useAddEventFavorite,
  useRemoveEventFavorite,
  useListEventFavorites,
  useListMyVendorClaims,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { EventCard } from "@/components/ui/event-card";
import { EventFormDialog } from "@/components/events/event-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Search, SlidersHorizontal, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { EVENT_CATEGORIES } from "@/lib/event-categories";
import { EVENT_LANGUAGES } from "@/lib/event-languages";
import { CitySuggestInput } from "@/components/ui/city-suggest-input";
import { POPULAR_METRO_CITIES } from "@/lib/us-cities";

interface FilterContentProps {
  category: string;
  city: string;
  state: string;
  language: string;
  upcomingOnly: boolean;
  onCategoryChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onLanguageChange: (v: string) => void;
  onUpcomingChange: (v: boolean) => void;
  onClear: () => void;
}

function FilterContent({
  category,
  city,
  state,
  language,
  upcomingOnly,
  onCategoryChange,
  onCityChange,
  onStateChange,
  onLanguageChange,
  onUpcomingChange,
  onClear,
}: FilterContentProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EVENT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Language</Label>
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Languages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            {EVENT_LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>City</Label>
        <CitySuggestInput
          value={city}
          onChange={onCityChange}
          onCitySelect={(selectedCity, selectedState) => {
            onCityChange(selectedCity);
            onStateChange(selectedState);
          }}
          placeholder="Any city"
        />
      </div>

      <div className="space-y-2">
        <Label>State</Label>
        <Input placeholder="Any state" value={state} onChange={(e) => onStateChange(e.target.value)} />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="upcoming-only" className="cursor-pointer">Upcoming only</Label>
        <Switch id="upcoming-only" checked={upcomingOnly} onCheckedChange={onUpcomingChange} />
      </div>

      <div className="pt-2">
        <Button variant="outline" className="w-full" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}

export default function Events() {
  const searchParams = new URLSearchParams(window.location.search);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [state, setState] = useState(searchParams.get("state") || "");
  const [language, setLanguage] = useState(searchParams.get("language") || "all");
  const [upcomingOnly, setUpcomingOnly] = useState(true);

  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const { data: eventFavorites, refetch: refetchEventFavorites } = useListEventFavorites({ query: { enabled: !!user } });
  const addEventFavorite = useAddEventFavorite();
  const removeEventFavorite = useRemoveEventFavorite();
  const favoriteEventIds = new Set(eventFavorites?.map((e) => e.id) || []);

  // If the signed-in user is a vendor with an approved listing, the create
  // dialog offers the same "this event is hosted by <business>" option the
  // vendor dashboard has - fetched only for that case, same as there.
  const { data: claims } = useListMyVendorClaims({ query: { enabled: user?.role === "vendor" } });
  const approvedClaim = claims?.find((c) => c.status === "approved");

  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);

  const openSubmitDialog = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to submit an event.",
      });
      return;
    }
    setIsEventDialogOpen(true);
  };

  const handleToggleFavorite = (eventId: number) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorite events.",
      });
      return;
    }

    if (favoriteEventIds.has(eventId)) {
      removeEventFavorite.mutate(
        { eventId },
        {
          onSuccess: () => {
            refetchEventFavorites();
            toast({ description: "Removed from favorites" });
          },
        }
      );
    } else {
      addEventFavorite.mutate(
        { eventId },
        {
          onSuccess: () => {
            refetchEventFavorites();
            toast({ description: "Added to favorites" });
          },
        }
      );
    }
  };

  const eventParams = {
    limit: 100,
    upcoming: upcomingOnly,
    ...(search ? { search } : {}),
    ...(category && category !== "all" ? { category } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(language && language !== "all" ? { language } : {}),
  };

  const { data: eventData, isLoading } = useListEvents(eventParams);

  const handleClear = () => {
    setSearch("");
    setCategory("all");
    setCity("");
    setState("");
    setLanguage("all");
    setUpcomingOnly(true);
  };

  const handlePickCity = (pickedCity: string, pickedState: string) => {
    setCity(pickedCity);
    setState(pickedState);
  };

  const filterProps: FilterContentProps = {
    category,
    city,
    state,
    language,
    upcomingOnly,
    onCategoryChange: setCategory,
    onCityChange: setCity,
    onStateChange: setState,
    onLanguageChange: setLanguage,
    onUpcomingChange: setUpcomingOnly,
    onClear: handleClear,
  };

  return (
    <Layout>
      <div className="bg-muted/30 py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
            <div>
              <h1 className="font-serif text-3xl font-bold mb-2 text-foreground">Events Around the US</h1>
              <p className="text-muted-foreground">
                Diwali melas, community gatherings, concerts, and more from South Asian communities nationwide.
              </p>
            </div>
            <Button onClick={openSubmitDialog} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Submit Event
            </Button>
          </div>

          {/* Top search bar - the fastest path to "find me something"; the
              category/language/city/state filters live in the sidebar below
              for people who want to narrow things down further. */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search events by name or keyword..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Popular Cities quick-filter chips - one click to jump straight
              to events in a major metro, same idea as Sulekha's city menu. */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-xs font-medium text-muted-foreground self-center mr-1">Popular:</span>
            {POPULAR_METRO_CITIES.slice(0, 8).map((c) => (
              <button
                key={`${c.city}-${c.state}`}
                type="button"
                onClick={() => handlePickCity(c.city, c.state)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  city === c.city
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                {c.city}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Mobile Filters */}
          <div className="md:hidden flex justify-between items-center mb-4">
            <span className="font-medium">{eventData?.total || 0} Results</span>
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
                <FilterContent {...filterProps} />
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Filters Sidebar */}
          <div className="hidden md:block w-64 shrink-0">
            <div className="sticky top-24">
              <h2 className="font-serif text-xl font-bold mb-6">Filters</h2>
              <FilterContent {...filterProps} />
            </div>
          </div>

          {/* Results Grid */}
          <div className="flex-1">
            <div className="hidden md:flex justify-between items-center mb-6">
              <h2 className="font-medium text-muted-foreground">{eventData?.total || 0} events found</h2>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-[400px] rounded-xl" />
                ))}
              </div>
            ) : eventData?.events.length === 0 ? (
              <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed">
                <h3 className="text-xl font-medium mb-2">No events found</h3>
                <p className="text-muted-foreground">Try adjusting your filters to see more results.</p>
                <Button variant="outline" className="mt-6" onClick={handleClear}>
                  Clear all filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {eventData?.events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isFavorite={favoriteEventIds.has(event.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <EventFormDialog
        open={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        vendorClaim={approvedClaim ? { vendorId: approvedClaim.vendorId, vendorName: approvedClaim.vendorName } : null}
      />
    </Layout>
  );
}
