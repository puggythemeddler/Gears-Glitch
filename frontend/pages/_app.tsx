import React, { Component, useState, useEffect } from "react";
import type { AppProps } from "next/app";
import { Sora, Archivo } from "next/font/google";
import { AppProvider } from "@/lib/app-context";
import { LayoutProvider, LayoutStyles } from "@/layouts";
import Layout from "@/components/Layout";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import OfflinePage from "@/components/OfflinePage";
import "@/styles/globals.css";
import "@/styles/animations.css";
import "@/styles/marketing.css";

const sora = Sora({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-sora-next",
  display: "swap",
});

const archivo = Archivo({
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-archivo-next",
  display: "swap",
});

function getActiveNav(path: string): string {
  const p = path.split("?")[0].replace(/\/$/, "") || "/";
  if (p === "/") return "home";
  const segments = p.split("/").filter(Boolean);
  return segments[0] || "home";
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-state" style={{ minHeight: "60vh" }} role="alert">
          <div className="error-state-icon">!</div>
          <div className="error-state-title">This page couldn&apos;t load</div>
          <p className="error-state-desc">
            An unexpected error occurred while rendering the page. Your data is safe —
            refreshing usually fixes it. If it keeps happening, contact support.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

export default function MyApp({ Component, pageProps, router }: AppProps) {
  const activeNav = getActiveNav(router.asPath);
  const [offline, setOffline] = useState<false | "active" | "dismissing">(false);

  useEffect(() => {
    if (!navigator.onLine) setOffline("active");
    const goOnline = () => {
      if (offline) setOffline("dismissing");
    };
    const goOffline = () => setOffline("active");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [offline]);

  useEffect(() => {
    if (offline !== "dismissing") return;
    const t = setTimeout(() => setOffline(false), 700);
    return () => clearTimeout(t);
  }, [offline]);

  return (
    <div className={`${sora.variable} ${archivo.variable}`} style={{ minHeight: "100vh" }}>
      <AppProvider>
        <ErrorBoundary>
          <ToastProvider>
            <ConfirmProvider>
              <LayoutProvider>
                <LayoutStyles />
                <Layout activeNav={activeNav}>
                  <PageTransition key={router.asPath}>
                    <Component {...pageProps} />
                  </PageTransition>
                </Layout>
              </LayoutProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ErrorBoundary>
        {offline && <OfflinePage dismissing={offline === "dismissing"} />}
      </AppProvider>
    </div>
  );
}
