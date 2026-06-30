import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import WelcomePage from "@/pages/welcome";
import ChatPage from "@/pages/chat";
import NotFound from "@/pages/not-found";
import ImprintPage from "@/pages/imprint";
import FAQPage from "@/pages/faq";

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    // Always start every new page at the very top.
    // This fixes /imprint and /faq opening from the middle after scrolling on the start page.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location]);

  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={WelcomePage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/imprint" component={ImprintPage} />
        <Route path="/faq" component={FAQPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-bg-dark text-text-primary">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
