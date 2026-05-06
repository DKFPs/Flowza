import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, FileText, Activity, ShieldCheck, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getCountFromServer, getDocs, limit, query, where } from "firebase/firestore";

export default function GlobalMetrics() {
  const [stats, setStats] = useState({
      businesses: 0,
      clients: 0,
      appointments: 0,
  });
  const [businessesList, setBusinessesList] = useState<Record<string, unknown>[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string>("all");

  useEffect(() => {
    async function loadBusinesses() {
        try {
            const q = query(collection(db, "businesses"), limit(100));
            const snap = await getDocs(q);
            setBusinessesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch(e) {
            console.error("Error loading businesses for filter", e);
        }
    }
    loadBusinesses();
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const statsObj = { businesses: 0, clients: 0, appointments: 0 };
        
        if (selectedBusiness === "all") {
            try {
                const biz = await getCountFromServer(collection(db, "businesses"));
                statsObj.businesses = biz.data().count;
            } catch(e) { console.error("Error biz", e); }
            
            try {
                const cli = await getCountFromServer(collection(db, "clients"));
                statsObj.clients = cli.data().count;
            } catch(e) { console.error("Error cli", e); }
    
            try {
                const app = await getCountFromServer(collection(db, "appointments"));
                statsObj.appointments = app.data().count;
            } catch(e) { console.error("Error appts", e); }
        } else {
            statsObj.businesses = 1; // It's a single business
            
            try {
                const cli = await getCountFromServer(query(collection(db, "clients"), where("business_id", "==", selectedBusiness)));
                statsObj.clients = cli.data().count;
            } catch(e) { console.error("Error cli", e); }
    
            try {
                const app = await getCountFromServer(query(collection(db, "appointments"), where("business_id", "==", selectedBusiness)));
                statsObj.appointments = app.data().count;
            } catch(e) { console.error("Error appts", e); }
        }

        setStats(statsObj);
      } catch (e) {
          console.error("Error fetching global stats", e);
      }
    }
    loadStats();
  }, [selectedBusiness]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Global</h2>
          <p className="text-slate-500">Métricas vitais de todos os tenants (businesses) no sistema.</p>
        </div>
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
               className="h-9 px-3 py-1 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
               value={selectedBusiness}
               onChange={(e) => setSelectedBusiness(e.target.value)}
            >
                <option value="all">Ver Global (Todos)</option>
                {businessesList.map(b => (
                    <option key={b.id} value={b.id}>{b.name || b.id}</option>
                ))}
            </select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Businesses</CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg"><Activity className="w-4 h-4 text-blue-600" /></div>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats.businesses}</div>
            </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Clients (CRM)</CardTitle>
                <div className="p-2 bg-emerald-100 rounded-lg"><Users className="w-4 h-4 text-emerald-600" /></div>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats.clients}</div>
            </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Appts</CardTitle>
                <div className="p-2 bg-indigo-100 rounded-lg"><FileText className="w-4 h-4 text-indigo-600" /></div>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats.appointments}</div>
            </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Status Geral</CardTitle>
                <div className="p-2 bg-slate-100 rounded-lg"><ShieldCheck className="w-4 h-4 text-slate-600" /></div>
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold text-green-600 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                    Saudável
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
