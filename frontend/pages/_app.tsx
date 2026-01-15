import React, { Component } from "react";
import type { AppProps } from "next/app";
import { AppProvider } from "@/lib/app-context";
import { LayoutProvider, LayoutStyles } from "@/layouts";
import Layout from "@/components/Layout";
import { ToastProvider } from "@/components/Toast";
import "@/styles/globals.css";
import "@/styles/animations.css";
import "@/styles/marketing.css";

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
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "60vh", padding: "2rem", textAlign: "center", color: "var(--text)",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.3 }}>⚠️</div>
          <h1 style={{ marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", maxWidth: 400 }}>
            An unexpected error occurred. Please try refreshing the page.
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

  return (
    <AppProvider>
      <ErrorBoundary>
        <ToastProvider>
          <LayoutProvider>
            <LayoutStyles />
            <Layout activeNav={activeNav}>
              <PageTransition key={router.asPath}>
                <Component {...pageProps} />
              </PageTransition>
            </Layout>
          </LayoutProvider>
        </ToastProvider>
      </ErrorBoundary>
    </AppProvider>
  );
}
