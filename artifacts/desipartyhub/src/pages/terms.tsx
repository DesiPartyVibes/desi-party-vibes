import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder page: DesiPartyVibes doesn't have finalized Terms of Service
// copy yet. This exists so the "I agree to the Terms of Service" signup
// checkbox links somewhere real; replace this content with the actual terms
// when they're ready.
export default function Terms() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-4">
            <p>
              Our full Terms of Service are coming soon. In the meantime, if you have
              questions about your use of DesiPartyVibes, please reach out through our
              Contact Support option and we'll be happy to help.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
