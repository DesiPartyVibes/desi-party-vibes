import { Link } from "wouter";
import { useListCategories } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Camera, Music, Utensils, Tent, Scissors, 
  Palette, Gift, Mic, Sparkles, Shirt,
  MapPin, Heart, Video, ShoppingBag, GlassWater, Plane, Speaker, Gem
} from "lucide-react";

// Mapping category slugs to lucide icons
const categoryIcons: Record<string, React.ElementType> = {
  "venues": Tent,
  "catering": Utensils,
  "photography": Camera,
  "videography": Video,
  "decorators": Palette,
  "djs-music": Music,
  "makeup-hair": Scissors,
  "mehndi-artists": Sparkles,
  "attire-jewelry": Shirt,
  "invitations": Gem,
  "priests-pandits": Heart,
  "event-planners": MapPin,
  "sweets-desserts": Gift,
  "favors-gifts": ShoppingBag,
  "bartending": GlassWater,
  "transportation": Plane,
  "entertainment": Mic,
  "rentals": Speaker,
};

export default function Categories() {
  const { data: categories, isLoading } = useListCategories();

  return (
    <Layout>
      <div className="bg-muted/30 py-12 border-b">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-serif text-4xl font-bold mb-4 text-foreground">Explore Categories</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover the perfect professionals for every aspect of your celebration.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(16)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories?.map((category) => {
              const Icon = categoryIcons[category.slug] || Sparkles;
              return (
                <Link key={category.id} href={`/vendors?category=${category.id}`}>
                  <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group text-center py-8 border-muted">
                    <CardContent className="p-0 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
                        <Icon className="h-8 w-8" />
                      </div>
                      <h3 className="font-semibold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">{category.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{category.vendorCount} vendors</p>
                      <span className="text-xs text-muted-foreground/80 line-clamp-2 px-4">
                        {category.description}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
