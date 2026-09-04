import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder page: DesiPartyVibes doesn't have finalized Privacy Policy copy
// yet. This exists so the "I agree to the Privacy Policy" signup checkbox
// links somewhere real; replace this content with the actual policy when
// it's ready.
export default function Privacy() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-4">
            <p>
              Our full Privacy Policy is coming soon. In the meantime, if you have
              questions about how we handle your data, please reach out through our
              Contact Support option and we'll be happy to help.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
