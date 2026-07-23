import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

const queryClient = new QueryClient();

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
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
