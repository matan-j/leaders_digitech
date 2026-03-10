
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { BookOpen, Calendar, FileText, Users, BarChart3, LogOut, Menu, X, User,Settings2Icon } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Profile from '@/pages/Profile';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Navigation = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
 const [profile, setProfile] = useState<Profile | null>(null);
  //ask matan if i should enable instructors view courses page.
  const isAdminOrManager = ['admin', 'pedagogical_manager'].includes(user?.user_metadata?.role);
   const isAdmin = ['admin'].includes(user?.user_metadata?.role);
const navigationItems = [
  { path: '/', label: 'דשבורד', icon: BookOpen },
  { path: '/calendar', label: 'יומן', icon: Calendar },
  isAdminOrManager && { path: '/lesson-report', label: 'דיווח שיעור', icon: FileText },
  { path: '/courses', label: 'קורסים', icon: Users },
  { path: '/course-assignments', label: 'הקצאות קורסים', icon: Users },
  isAdmin && { path: '/reports', label: 'דוחות ושכר', icon: BarChart3 },
  { path: '/rewards', label: 'תגמולים', icon: BarChart3 },
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
  return (
    <>
      {/* Desktop Navigation */}
      <header className="hidden md:block bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg border-b border-blue-800">
        <div className="  px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <div className="flex items-center gap-2">
           
                     <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                    <Menu className=" hidden  md:block md:h-6 md:w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 bg-white">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b">
                      <h2 className="text-lg font-semibold">תפריט ניווט</h2>
                    </div>
                    <nav className="flex-1 p-4">
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
                                  ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <Icon className="h-5 w-5 ml-3" />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
     
            {/* Hamburger Menu */}
       
              <BookOpen className="h-8 w-8 text-blue-200 ml-3" />
              <h1 className="text-xl font-bold text-white">שלום  {profile?.full_name}</h1>
            </div>
            
            {/* Hamburger Menu & User Info */}
            <div className="flex items-center ">
            
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
      <header className="md:hidden bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <BookOpen className="h-6 w-6 text-blue-200 ml-2" />
              <h1 className="text-xl font-bold text-white">שלום  {profile?.full_name}</h1>
            </div>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 bg-white">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">תפריט ניווט</h2>
                  </div>
                  <nav className="flex-1 p-4">
                    <div className="space-y-2 mb-6">
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
                                ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="h-5 w-5 ml-3" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                    <div className="border-t pt-4">
                      <div className="mb-4">
                        <span className="text-sm text-gray-600">
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
        </div>
      </header>
    </>
  );
};

export default Navigation;
