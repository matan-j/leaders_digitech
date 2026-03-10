import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, createClient } from '@supabase/supabase-js';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { supabase } from '@/integrations/supabase/client';


type UserRole = 'instructor' | 'pedagogical_manager' | 'admin' | '';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password:string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role?: UserRole,
    phone?: string
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: any }>;  // הוסף את זה
  updatePassword: (newPassword: string) => Promise<{ error: any }>;  // הוסף את זה
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`, // עדכן את ה-URL בהתאם
    });
    return { error };
  } catch (error) {
    return { error };
  }
};

const updatePassword = async (newPassword: string) => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  } catch (error) {
    return { error };
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


// --- AUTH PROVIDER COMPONENT (FIXED) ---

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listener handles the initial session on page load AND any subsequent auth changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in, creating profile if needed...');
          await createProfileIfNeeded(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const createProfileIfNeeded = async (user: User) => {
    // This is a placeholder for your actual profile creation logic.
    // In a real app, you would interact with your 'profiles' table here.
    console.log('createProfileIfNeeded called for user:', user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'instructor',
    phone: string = ''
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role, phone },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
     resetPassword,  // הוסף את זה
  updatePassword, // הוסף את זה
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};



const Navigation = () => {
    const { user, signOut } = useAuth();
    return (
        <nav style={{ padding: '1rem', backgroundColor: '#eee', display: 'flex', justifyContent: 'space-between' }}>
            <span>My App</span>
            {user && <button onClick={signOut}>Sign Out</button>}
        </nav>
    );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/auth" />;
    }

    return <>{children}</>;
};

const Layout: React.FC = () => (
    <div>
        <Navigation />
        <main style={{ padding: '1rem' }}>
            <Outlet />
        </main>
    </div>
);


// --- PAGE COMPONENTS (PLACEHOLDERS) ---

const Index = () => <h2>Home Page</h2>;
const Calendar = () => <h2>Calendar Page</h2>;
const Profile = () => <h2>Profile Page</h2>;
const NotFound = () => <h2>404 - Page Not Found</h2>;
const VerifyPage = () => <h2>Please check your email to verify your account.</h2>;
const Auth = () => {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await signIn(email, password);
        if (error) {
            alert('Error logging in: ' + error.message);
        } else {
            // Navigation will happen automatically via ProtectedRoute
        }
    };

    return (
        <div>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required /><br />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required /><br />
                <button type="submit">Log In</button>
            </form>
        </div>
    );
};


// --- MAIN APP COMPONENT ---

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/verify" element={<VerifyPage />} />

        {/* Protected Routes */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Index />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="profile" element={<Profile />} />
          {/* Add other nested protected routes here */}
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
