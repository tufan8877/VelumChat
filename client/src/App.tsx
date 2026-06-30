import { useLayoutEffect } from "react";
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

if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

function resetEveryScrollContainer() {
  const targets: Array<Window | HTMLElement> = [window, document.documentElement, document.body];

  document.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (el.scrollTop > 0 || el.scrollLeft > 0) targets.push(el);
  });

  for (const target of targets) {
    try {
      if (target === window) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } else {
        (target as HTMLElement).scrollTop = 0;
        (target as HTMLElement).scrollLeft = 0;
      }
    } catch {}
  }
}

function ScrollToTop() {
  const [location] = useLocation();

  useLayoutEffect(() => {
    resetEveryScrollContainer();
    requestAnimationFrame(resetEveryScrollContainer);
    setTimeout(resetEveryScrollContainer, 0);
    setTimeout(resetEveryScrollContainer, 50);
    setTimeout(resetEveryScrollContainer, 150);
  }, [location]);

  return null;
}

function Router() {
  const [location] = useLocation();

  return (
    <>
      <ScrollToTop />
      <div key={location} className="min-h-screen">
        <Switch>
          <Route path="/" component={WelcomePage} />
          <Route path="/chat" component={ChatPage} />
          <Route path="/imprint" component={ImprintPage} />
          <Route path="/faq" component={FAQPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
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
