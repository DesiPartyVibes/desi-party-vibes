import { useState, useRef, useEffect, useCallback } from "react";
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
import { Search, SlidersHorizontal, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return 1;
  // Only score against words >= 2 chars; single chars are treated as "still typing"
  const qWords = q.split(/\s+/).filter((w) => w.length >= 2);
  if (qWords.length === 0) return 0;
  const tWords = t.split(/\s+/).filter(Boolean);
  let matched = 0;
  for (const qw of qWords) {
    let best = false;
    for (const tw of tWords) {
      if (qw.length <= 3) {
        // Short query words: only prefix match so "te" hits "temple" but not "patel"
        if (tw.startsWith(qw)) { best = true; break; }
      } else {
        // Longer words: substring match is precise enough
        if (tw.includes(qw) || qw.includes(tw)) { best = true; break; }
        const maxDist = qw.length <= 5 ? 1 : 2;
        if (levenshtein(qw, tw) <= maxDist) { best = true; break; }
      }
    }
    if (best) matched++;
  }
  return matched / qWords.length;
}

interface VendorSuggestion {
  kind: "vendor";
  id: number;
  name: string;
  categoryName: string;
}

interface CategorySuggestion {
  kind: "category";
  id: number;
  name: string;
  slug: string;
}

type Suggestion = VendorSuggestion | CategorySuggestion;

interface VendorSuggestionItem {
  id: number;
  name: string;
  categoryName: string;
}

interface FilterContentProps {
  search: string;
  category: string;
  city: string;
  categories: Array<{ id: number; name: string; slug: string }> | undefined;
  cities: Array<{ city: string; state: string }> | undefined;
  suggestionPool: VendorSuggestionItem[];
  onSearchChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onClear: () => void;
}

function FilterContent({
  search,
  category,
  city,
  categories,
  cities,
  suggestionPool,
  onSearchChange,
  onCategoryChange,
  onCityChange,
  onClear,
}: FilterContentProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestions: Suggestion[] = search.trim().length >= 1
    ? [
        // Category matches first — clicking applies the category filter
        ...(categories ?? [])
          .map((c) => ({ ...c, score: fuzzyScore(search, c.name) }))
          .filter((c) => c.score > 0.4)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((c): CategorySuggestion => ({ kind: "category", id: c.id, name: c.name, slug: c.slug })),
        // Vendor name matches after
        ...suggestionPool
          .map((v) => ({ ...v, score: fuzzyScore(search, v.name) }))
          .filter((v) => v.score > 0.35)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map((v): VendorSuggestion => ({ kind: "vendor", id: v.id, name: v.name, categoryName: v.categoryName })),
      ]
    : [];

  useEffect(() => {
    setActiveSuggestion(-1);
  }, [search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectSuggestion = useCallback(
    (s: Suggestion) => {
      if (s.kind === "category") {
        onCategoryChange(s.slug);
        onSearchChange("");
      } else {
        onSearchChange(s.name);
      }
      setShowSuggestions(false);
    },
    [onCategoryChange, onSearchChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter" && activeSuggestion >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeSuggestion]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    [showSuggestions, suggestions, activeSuggestion, selectSuggestion]
  );

  const hasSuggestions = showSuggestions && suggestions.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            ref={inputRef}
            placeholder="Name or keyword..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />

          {hasSuggestions && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <button
                  key={`${s.kind}-${s.id}`}
                  type="button"
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                    i === activeSuggestion
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/60"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(s);
                  }}
                  onMouseEnter={() => setActiveSuggestion(i)}
                >
                  {s.kind === "category" ? (
                    <LayoutGrid className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 text-sm font-medium truncate">{s.name}</span>
                  {s.kind === "category" ? (
                    <span className="text-xs font-medium text-primary shrink-0 bg-primary/10 px-1.5 py-0.5 rounded">Category</span>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">{s.categoryName}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>City</Label>
        <Select value={city} onValueChange={onCityChange}>
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

      <div className="pt-4">
        <Button variant="outline" className="w-full" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}

export default function Vendors() {
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
    limit: 100,
    ...(search ? { search } : {}),
    ...(category && category !== "all" ? { category } : {}),
    ...(city && city !== "all" ? { city } : {}),
  };

  const { data: vendorData, isLoading } = useListVendors(vendorParams);
  const { data: allVendorsData } = useListVendors({ limit: 200 });
  const { data: categories } = useListCategories();
  const { data: cities } = useListCities();

  const suggestionPool: SuggestionItem[] = (allVendorsData?.vendors ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    categoryName: v.categoryName ?? "",
  }));

  const favoriteIds = new Set(favorites?.map(f => f.id) || []);

  const handleClear = () => {
    setSearch("");
    setCategory("all");
    setCity("all");
  };

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
          },
        }
      );
    } else {
      addFavorite.mutate(
        { vendorId },
        {
          onSuccess: () => {
            refetchFavorites();
            toast({ description: "Added to favorites" });
          },
        }
      );
    }
  };

  const filterProps: FilterContentProps = {
    search,
    category,
    city,
    categories,
    cities,
    suggestionPool,
    onSearchChange: setSearch,
    onCategoryChange: setCategory,
    onCityChange: setCity,
    onClear: handleClear,
  };

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
                <Button variant="outline" className="mt-6" onClick={handleClear}>
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
