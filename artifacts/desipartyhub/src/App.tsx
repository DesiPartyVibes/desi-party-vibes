import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/theme-provider";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Categories from "@/pages/categories";
import Vendors from "@/pages/vendors";
import VendorDetail from "@/pages/vendor-detail";
import Profile from "@/pages/profile";
import Favorites from "@/pages/favorites";
import Checklist from "@/pages/checklist";
import Budget from "@/pages/budget";
import Bookings from "@/pages/bookings";
import AdminDashboard from "@/pages/admin";
import VendorDashboard from "@/pages/vendor-dashboard";
import ForgotPassword from "@/pages/forgot-password";
import VerifyEmail from "@/pages/verify-email";

// A 401/403 means "not logged in" / "not allowed" — retrying won't change
// that, it just delays the UI from settling (e.g. showing Login/Sign up
// after logout took ~10s because the default 3-retry exponential backoff
// kept useGetCurrentUser's query in a loading state). Other failures (flaky
// network, 5xx) still get a couple of retries.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/categories" component={Categories} />
      <Route path="/vendors" component={Vendors} />
      <Route path="/vendors/:id" component={VendorDetail} />
      <Route path="/profile" component={Profile} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/checklist" component={Checklist} />
      <Route path="/budget" component={Budget} />
      <Route path="/bookings" component={Bookings} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/vendor-dashboard" component={VendorDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
