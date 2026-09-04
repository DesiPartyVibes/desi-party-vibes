import { useState } from "react";
import { useListEvents } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { EventCard } from "@/components/ui/event-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EVENT_CATEGORIES } from "@/lib/event-categories";
import { CitySuggestInput } from "@/components/ui/city-suggest-input";

interface FilterContentProps {
  category: string;
  city: string;
  state: string;
  upcomingOnly: boolean;
  onCategoryChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onUpcomingChange: (v: boolean) => void;
  onClear: () => void;
}

function FilterContent({
  category,
  city,
  state,
  upcomingOnly,
  onCategoryChange,
  onCityChange,
  onStateChange,
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

  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [state, setState] = useState(searchParams.get("state") || "");
  const [upcomingOnly, setUpcomingOnly] = useState(true);

  const eventParams = {
    limit: 100,
    upcoming: upcomingOnly,
    ...(category && category !== "all" ? { category } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
  };

  const { data: eventData, isLoading } = useListEvents(eventParams);

  const handleClear = () => {
    setCategory("all");
    setCity("");
    setState("");
    setUpcomingOnly(true);
  };

  const filterProps: FilterContentProps = {
    category,
    city,
    state,
    upcomingOnly,
    onCategoryChange: setCategory,
    onCityChange: setCity,
    onStateChange: setState,
    onUpcomingChange: setUpcomingOnly,
    onClear: handleClear,
  };

  return (
    <Layout>
      <div className="bg-muted/30 py-8 border-b">
        <div className="container mx-auto px-4">
          <h1 className="font-serif text-3xl font-bold mb-2 text-foreground">Events Around the US</h1>
          <p className="text-muted-foreground">
            Diwali melas, community gatherings, concerts, and more from South Asian communities nationwide.
          </p>
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
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
