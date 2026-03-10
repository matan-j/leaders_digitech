// MobileNavigation.tsx (updated for matching desktop styling and routing)
import React from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Calendar, FileText, Users, BarChart3, User, Award } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

const MobileNavigation = () => {
  const { user } = useAuth();
const isAdminOrManager = ['admin', 'pedagogical_manager'].includes(user?.user_metadata?.role);
const isAdmin = ['admin'].includes(user?.user_metadata?.role);
  
  const navItems = [
    { path: '/', label: 'דשבורד', icon: BookOpen },
    { path: '/calendar', label: 'יומן', icon: Calendar },
    ...(isAdminOrManager ?[{ path: '/lesson-report', label: 'שיעור', icon: FileText }]:[]),
    { path: '/courses', label: 'קורסים', icon: Users } ,
   { path: '/course-assignments', label: 'הקצאות', icon: Users } ,
    ...(isAdmin ? [{ path: '/reports', label: 'דוחות', icon: BarChart3 }] : []),
    { path: '/rewards', label: 'תגמולים', icon: Award },
    { path: '/profile', label: 'פרופיל', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 md:hidden z-50">
      <div className="flex justify-between items-center">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex flex-col items-center text-xs px-1 py-1 ${
                isActive ? 'text-blue-600 font-bold' : 'text-gray-500'
              }`
            }
          >
            <Icon className="h-5 w-5 mb-0.5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default MobileNavigation;
