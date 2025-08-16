import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { WebVitals } from './_components/WebVitals'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: "Tracil - Clinical Data Lineage Platform",
  description: "Improve traceability across Protocol/SAP, CRF, SDTM, ADaM, and TLF artifacts with AI-powered lineage analysis.",
  keywords: ["clinical data", "lineage", "traceability", "CDISC", "SDTM", "ADaM", "pharmaceutical"],
  authors: [{ name: "Tracil Team" }],
  openGraph: {
    title: "Tracil - Clinical Data Lineage Platform",
    description: "AI-powered clinical data lineage and traceability platform",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tracil - Clinical Data Lineage Platform",
    description: "AI-powered clinical data lineage and traceability platform",
  },

  robots: {
    index: true,
    follow: true,
  },
};

// Loading component for Suspense fallback
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span className="ml-2 text-muted-foreground">Loading...</span>
    </div>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            {children}
          </Suspense>
        </ErrorBoundary>
        
        {/* Performance monitoring and analytics */}
        <WebVitals />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
