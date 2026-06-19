import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useGetHomepageStats, 
  useListFeaturedVendors, 
  useListCategories,
  useListCities
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VendorCard } from "@/components/ui/vendor-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, Sparkles, Building2, Users } from "lucide-react";

export default function Home() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const { data: stats } = useGetHomepageStats();
  const { data: featuredVendors, isLoading: vendorsLoading } = useListFeaturedVendors();
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const { data: cities } = useListCities();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      setLocation(`/vendors?search=${encodeURIComponent(search)}`);
    } else {
      setLocation('/vendors');
    }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative w-full h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0" style={{background: "linear-gradient(135deg, #7B2D00 0%, #C2410C 20%, #EA580C 40%, #D97706 60%, #92400E 80%, #4A1942 100%)"}} />
        <div className="absolute inset-0 z-0 opacity-20" style={{backgroundImage: "radial-gradient(circle at 20% 50%, #FCD34D 0%, transparent 50%), radial-gradient(circle at 80% 20%, #F9A8D4 0%, transparent 40%), radial-gradient(circle at 60% 80%, #A78BFA 0%, transparent 40%)"}} />
        <div className="absolute inset-0 z-0 opacity-10" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M30 0 L32 10 L40 8 L35 16 L45 18 L36 22 L40 32 L30 28 L20 32 L24 22 L15 18 L25 16 L20 8 L28 10 Z'/%3E%3C/g%3E%3C/svg%3E\")"}} />
        
        <div className="relative z-20 container mx-auto px-4 text-center text-white">
          <Badge className="bg-primary/90 text-primary-foreground hover:bg-primary border-none mb-6 text-sm py-1 px-3">
            Premium Indian Celebrations
          </Badge>
          <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 tracking-tight drop-shadow-lg">
            Plan Your Perfect <br/> <span className="text-primary-foreground drop-shadow-xl italic">Celebration</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-10 max-w-2xl mx-auto drop-shadow-md">
            Discover and book the finest trusted vendors for weddings, engagements, and cultural events in the US.
          </p>
          
          <div className="max-w-3xl mx-auto bg-white p-2 rounded-full shadow-2xl">
            <form onSubmit={handleSearch} className="flex items-center">
              <div className="flex-1 flex items-center pl-4 border-r border-gray-200">
                <Search className="h-5 w-5 text-muted-foreground mr-2" />
                <Input 
                  placeholder="What are you looking for? (e.g. DJ, Photographer)" 
                  className="border-none shadow-none focus-visible:ring-0 text-foreground text-base h-12"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="rounded-full h-12 px-8 text-base">
                Search
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {stats && (
        <section className="py-12 bg-card border-b">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border">
              <div>
                <div className="text-3xl font-serif font-bold text-primary mb-2">{stats.totalVendors}+</div>
                <div className="text-sm font-medium text-muted-foreground">Trusted Vendors</div>
              </div>
              <div>
                <div className="text-3xl font-serif font-bold text-primary mb-2">{stats.totalBookings}+</div>
                <div className="text-sm font-medium text-muted-foreground">Events Planned</div>
              </div>
              <div>
                <div className="text-3xl font-serif font-bold text-primary mb-2">{stats.totalCategories}</div>
                <div className="text-sm font-medium text-muted-foreground">Categories</div>
              </div>
              <div>
                <div className="text-3xl font-serif font-bold text-primary mb-2">{stats.totalCities}</div>
                <div className="text-sm font-medium text-muted-foreground">US Cities</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Categories */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-serif font-bold text-foreground mb-3">Popular Categories</h2>
              <p className="text-muted-foreground max-w-xl">Everything you need from mandap decorators to dhol players.</p>
            </div>
            <Button variant="outline" asChild className="hidden md:flex">
              <Link href="/categories">View All</Link>
            </Button>
          </div>

          {categoriesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories?.slice(0, 6).map((cat) => (
                <Link key={cat.id} href={`/vendors?category=${cat.id}`}>
                  <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group text-center py-6 border-muted">
                    <CardContent className="p-0 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <h3 className="font-medium text-sm text-foreground mb-1">{cat.name}</h3>
                      <span className="text-xs text-muted-foreground">{cat.vendorCount} vendors</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          
          <Button variant="outline" asChild className="w-full mt-6 md:hidden">
            <Link href="/categories">View All Categories</Link>
          </Button>
        </div>
      </section>

      {/* Featured Vendors */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-foreground mb-3">Featured Professionals</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Top-rated vendors highly recommended by the community.</p>
          </div>

          {vendorsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1,2,3].map(i => <Skeleton key={i} className="h-[400px] rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredVendors?.slice(0, 3).map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <Button size="lg" asChild>
              <Link href="/vendors">Explore All Vendors</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl font-serif font-bold mb-6">Ready to plan your celebration?</h2>
          <p className="text-lg mb-10 max-w-2xl mx-auto opacity-90">
            Join thousands of couples and families who have found their perfect vendors on Desi Party Vibes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-secondary-foreground" asChild>
              <Link href="/register">Create Free Account</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground hover:bg-primary-foreground hover:text-primary" asChild>
              <Link href="/vendors">Browse Vendors First</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";