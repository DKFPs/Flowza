import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
  User 
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type AppRole = "admin" | "superadmin" | "client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  isAdmin: false,
  isGlobalAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

  const fetchRole = async (firebaseUser: User) => {
    try {
      const userId = firebaseUser.uid;
      
      // Checa Global Admin
      let globalAdmin = false;
      if (firebaseUser.email === "italocar19@gmail.com") {
         globalAdmin = true;
      } else {
         const userDocRef = doc(db, "users", userId);
         const userDocSnap = await getDoc(userDocRef);
         if (userDocSnap.exists() && userDocSnap.data().role === "admin") {
             globalAdmin = true;
         }
      }
      setIsGlobalAdmin(globalAdmin);

      const docRef = doc(db, "profiles", userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRole(data.role as AppRole);
      } else {
        setRole(null);
      }
    } catch (error) {
      console.error("Error fetching role:", error);
      setRole(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchRole(firebaseUser);
      } else {
        setRole(null);
        setIsGlobalAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, isAdmin: role === "admin", isGlobalAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
