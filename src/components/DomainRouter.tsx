import { useEffect, useState } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";

const BookingPage = lazy(() => import("@/pages/BookingPage"));
const ClientArea = lazy(() => import("@/pages/ClientArea"));

const STANDARD_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "app.flowza.com",
  "flowza.com",
  "flowza.app",
  "cname.flowza.com",
  "ais-dev-",
  "ais-pre-"
];

export const isPreviewDomain = (hostname: string) => {
  return hostname.endsWith(".run.app") || STANDARD_DOMAINS.some(d => hostname.includes(d));
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
    
    if (isPreviewDomain(hostname)) {
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
