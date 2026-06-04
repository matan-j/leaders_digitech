
import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { BookOpen, Calendar, FileText, Users, BarChart3, LogOut, Menu, X, User, Settings2Icon, Briefcase, FolderKanban, Package } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Profile from '@/pages/Profile';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { useFeatureSettings } from '@/hooks/useFeatureSettings';

interface CRMNotification {
  id: string; title: string; body: string | null;
  is_read: boolean; created_at: string;
}

const formatAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'עכשיו';
  if (diff < 60) return `לפני ${diff} דק׳`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  return `לפני ${Math.floor(h / 24)} ימים`;
};

const NotificationBell = ({ userId }: { userId: string }) => {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<CRMNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from('crm_notifications')
      .select('id, title, body, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setNotifs(data as CRMNotification[]);
  };

  useEffect(() => { load(); }, [userId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id: string) => {
    await supabase.from('crm_notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(p => !p); load(); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, position: 'relative', padding: '4px 6px', color: 'white' }}
        title="התראות"
      >
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, background: '#DC2626', color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 700, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 500, background: '#fff', border: '1px solid #E4E7ED', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', width: 300, maxHeight: 380, overflowY: 'auto', direction: 'rtl' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E4E7ED', fontWeight: 700, fontSize: 13, color: '#111827' }}>התראות</div>
          {notifs.length === 0 && <div style={{ padding: '20px 16px', fontSize: 13, color: '#6B7280', textAlign: 'center' }}>אין התראות</div>}
          {notifs.map(n => (
            <div key={n.id} style={{ padding: '11px 16px', borderBottom: '1px solid #F0F2F5', background: n.is_read ? '#fff' : '#EEF2FF' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: '#111827' }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{n.body}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{formatAgo(n.created_at)}</span>
                {!n.is_read && <button onClick={() => markRead(n.id)} style={{ fontSize: 11, color: '#3B5BDB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>סמן כנקרא</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Navigation = () => {
  const { user, signOut } = useAuth();
  const { rewardsPageEnabled } = useFeatureSettings();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
 const [profile, setProfile] = useState<Profile | null>(null);
  //ask matan if i should enable instructors view courses page.
  const isAdminOrManager = ['admin', 'pedagogical_manager'].includes(user?.user_metadata?.role);
  const isAdmin = ['admin'].includes(user?.user_metadata?.role);
  const isCrmUser = ['admin', 'sales_rep'].includes(user?.user_metadata?.role);
const navigationItems = [
  { path: '/', label: 'דשבורד', icon: BookOpen },
  { path: '/calendar', label: 'יומן', icon: Calendar },
  isAdminOrManager && { path: '/lesson-report', label: 'דיווח שיעור', icon: FileText },
  { path: '/courses', label: 'קורסים', icon: Users },
  { path: '/course-assignments', label: 'הקצאות קורסים', icon: Users },
  isAdmin && { path: '/reports', label: 'דוחות ושכר', icon: BarChart3 },
  isCrmUser && { path: '/crm', label: 'CRM', icon: Briefcase },
  (isCrmUser || isAdminOrManager) && { path: '/crm/products', label: 'קטלוג מוצרים', icon: Package },
  { path: '/tasks', label: 'פרויקטים', icon: FolderKanban },
  rewardsPageEnabled && { path: '/rewards', label: 'תגמולים', icon: BarChart3 },
  { path: '/profile', label: 'פרופיל', icon: User },
   isAdminOrManager && { path: '/AdminSettings', label: 'הגדרות מנהל ', icon: Settings2Icon },

].filter(Boolean);

  const handleSignOut = async () => {
    await signOut();
  };
 const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        toast({
          title: "שגיאה",
          description: "לא ניתן לטעון את הפרופיל",
          variant: "destructive",
        });
        return;
      }
      console.log("datatataq ", data);
      setProfile(data);

    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };
    useEffect(() => {
      fetchProfile();
    }, []);
  console.log('[Nav] role:', user?.user_metadata?.role, 'isCrmUser:', isCrmUser);

  const renderNavItems = () => (
    <div className="space-y-2">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-accent text-accent-foreground border-r-4 border-primary'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-5 w-5 ml-3" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Desktop Header */}
      <header className="hidden md:block bg-brand-gradient shadow-brand-header">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center h-20 gap-4">

            {/* Start cluster: menu + greeting */}
            <div className="flex items-center gap-2 justify-self-start">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 bg-card">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <h2 className="text-lg font-semibold">תפריט ניווט</h2>
                    </div>
                    <nav className="flex-1 p-4">
                      {renderNavItems()}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
              {profile?.full_name && (
                <span className="text-sm font-medium text-white/90 hidden lg:inline-block">
                  שלום {profile.full_name}
                </span>
              )}
            </div>

            {/* Center: brand logo */}
            <div className="justify-self-center">
              <BrandLogo variant="header" />
            </div>

            {/* End cluster: bell + sign out */}
            <div className="flex items-center gap-2 justify-self-end">
              {user && <NotificationBell userId={user.id} />}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center space-x-2 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              >
                <LogOut className="h-4 w-4 ml-2" />
                <span>יציאה</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-brand-gradient shadow-brand-header">
        <div className="px-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center h-16 gap-2">

            {/* Start: menu */}
            <div className="flex items-center justify-self-start">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 px-2">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 bg-card">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <h2 className="text-lg font-semibold">תפריט ניווט</h2>
                    </div>
                    <nav className="flex-1 p-4">
                      <div className="mb-6">
                        {renderNavItems()}
                      </div>
                      <div className="border-t border-border pt-4">
                        <div className="mb-4">
                          <span className="text-sm text-muted-foreground">
                            משתמש: {user?.user_metadata?.full_name || user?.email}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleSignOut}
                          className="w-full flex items-center justify-center space-x-2"
                        >
                          <LogOut className="h-4 w-4 ml-2" />
                          <span>יציאה</span>
                        </Button>
                      </div>
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Center: compact brand logo */}
            <div className="justify-self-center">
              <BrandLogo variant="compact" />
            </div>

            {/* End: bell */}
            <div className="flex items-center justify-self-end">
              {user && <NotificationBell userId={user.id} />}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Navigation;
