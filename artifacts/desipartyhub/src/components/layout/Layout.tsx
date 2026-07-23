import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { FeedbackButton } from "@/components/ui/FeedbackButton";
import { EmailVerifyBanner } from "./EmailVerifyBanner";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <Navbar />
      <EmailVerifyBanner />
      <main className="flex-1 w-full flex flex-col">{children}</main>
      <Footer />
      <FeedbackButton />
    </div>
  );
}
