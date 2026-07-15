import { useEffect, useState } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";

const BookingPage = lazy(() => import("@/pages/BookingPage"));
const ClientArea = lazy(() => import("@/pages/ClientArea"));

const MAIN_DOMAINS = [
  "flowzaapp.netlify.app",
  "localhost",
  "127.0.0.1",
  "flowza.com",
  "www.flowza.com",
  "flowza.app",
  "www.flowza.app",
  "app.flowza.com",
  "cname.flowza.com"
];

export const isPreviewDomain = (hostname: string) => {
  const cleanHost = hostname.toLowerCase().trim();

  // 1. Check if it matches exactly or is a subdomain of any of our MAIN_DOMAINS
  const isMatchMain = MAIN_DOMAINS.some(domain => {
    const cleanDomain = domain.toLowerCase().trim();
    return cleanHost === cleanDomain || cleanHost.endsWith("." + cleanDomain);
  });
  if (isMatchMain) return true;

  // 2. Check if it is a common cloud hosting preview/staging domain suffix
  if (
    cleanHost.endsWith(".netlify.app") ||
    cleanHost.endsWith(".vercel.app") ||
    cleanHost.endsWith(".github.io") ||
    cleanHost.endsWith(".run.app") ||
    cleanHost.endsWith(".gitpod.io") ||
    cleanHost.includes("ais-dev-") ||
    cleanHost.includes("ais-pre-")
  ) {
    return true;
  }

  // 3. Dynamically check from VITE_APP_URL environment variable if defined
  try {
    const appUrl = import.meta.env.VITE_APP_URL || "";
    if (appUrl) {
      const parsedUrl = new URL(appUrl);
      if (cleanHost === parsedUrl.hostname.toLowerCase().trim()) {
        return true;
      }
    }
  } catch (e) {}

  // 4. Dynamically check from VITE_MAIN_DOMAIN environment variable if defined
  try {
    const mainDomain = import.meta.env.VITE_MAIN_DOMAIN || "";
    if (mainDomain) {
      const cleanMain = mainDomain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].toLowerCase().trim();
      const cleanHostWithoutWww = cleanHost.replace(/^www\./, "");
      if (cleanHostWithoutWww === cleanMain || cleanHost === cleanMain) {
        return true;
      }
    }
  } catch (e) {}

  return false;
};

export const CustomDomainRouter = ({ tenantSlug }: { tenantSlug: string }) => {
  return (
    <Routes>
      <Route path="/" element={<BookingPage customSlug={tenantSlug} />} />
      <Route path="/area" element={<ClientArea />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const useDomainCheck = () => {
  const [loading, setLoading] = useState(true);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCustomDomain, setIsCustomDomain] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    
    // Check if user specified ?main=true, ?bypass_domain=true or already has it saved to force standard Flowza Landing
    const searchParams = new URLSearchParams(window.location.search);
    const hasBypassParam = searchParams.get("bypass_domain") === "true" || searchParams.get("main") === "true";
    const hasStoredBypass = localStorage.getItem("force_main_app") === "true";

    if (hasBypassParam) {
      localStorage.setItem("force_main_app", "true");
    }

    if (hasBypassParam || hasStoredBypass || isPreviewDomain(hostname)) {
      setIsCustomDomain(false);
      setLoading(false);
      return;
    }

    setIsCustomDomain(true);

    const fetchTenantByDomain = async () => {
      try {
        const q = query(
          collection(db, "businesses"), 
          where("custom_domain", "==", hostname), 
          where("domain_status", "==", "verified"),
          limit(1)
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          setTenantSlug(snap.docs[0].data().slug);
        } else {
          const altHostname = hostname.startsWith("www.") ? hostname.replace("www.", "") : `www.${hostname}`;
          const q2 = query(
            collection(db, "businesses"),
            where("custom_domain", "==", altHostname),
            where("domain_status", "==", "verified"),
            limit(1)
          );
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            setTenantSlug(snap2.docs[0].data().slug);
          } else {
            setError("Domínio não configurado ou inativo.");
          }
        }
      } catch (err) {
        console.error("Erro ao resolver domínio:", err);
        setError("Erro ao carregar página.");
      } finally {
        setLoading(false);
      }
    };

    fetchTenantByDomain();
  }, []);

  return { loading, tenantSlug, error, isCustomDomain };
};
