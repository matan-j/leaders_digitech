
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Navigation from "@/components/layout/Navigation";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Calendar from "./pages/Calendar";
import LessonReport from "./pages/LessonReport";
import Courses from "./pages/Courses";
import CourseAssignments from "./pages/CourseAssignments";
import Rewards from "./pages/Rewards";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { VerifyPage } from "./pages/VerifyPage";
import AdminSettings from "./pages/AdminSettings";
import ResetPassword from "./components/ResetPassword";
import CRM from "./pages/CRM";
import CRMInstitution from "./pages/CRMInstitution";
import CRMInstructor from "./pages/CRMInstructor";
import Products from "./pages/Products";
import Tasks from "./pages/Tasks";
import { useFeatureSettings } from "@/hooks/useFeatureSettings";

const queryClient = new QueryClient();

const RewardsFeatureGate = () => {
  const { rewardsPageEnabled, isLoading } = useFeatureSettings();

  if (isLoading) {
    return (
      <main className="p-6 text-center text-gray-600" dir="rtl">
        טוען הגדרות...
      </main>
    );
  }

  if (!rewardsPageEnabled) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-center" dir="rtl">
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">עמוד התגמולים אינו פעיל כרגע</h1>
          <p className="mt-3 text-gray-600">
            מנהל המערכת כיבה את מודול התגמולים. ניתן להמשיך לעבוד בשאר חלקי המערכת.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            חזרה לדשבורד
          </Link>
        </div>
      </main>
    );
  }

  return <Rewards />;
};

const App = () => (

  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen bg-background">
            <Routes>
              <Route path="/auth" element={<Auth />} />
             <Route path="/verify" element={<VerifyPage />} />
             <Route path="/reset-password" element={<ResetPassword />} />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen">
                      <Navigation />
                      
                      <Index />
                    </div>
                    
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/calendar" 
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen">
                      <Navigation />
                      <Calendar />
                    </div>
                  </ProtectedRoute>
                } 
              />
           
                  <Route 
                path="/lesson-report" 
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen">
                      <Navigation />
                      <LessonReport />
                    </div>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/lesson-report/:id" 
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen">
                      <Navigation />
                      <LessonReport />
                    </div>
                  </ProtectedRoute>
                } 
              />
               <Route 
                 path="/courses" 
                 element={
                   <ProtectedRoute>
                     <div className="min-h-screen">
                       <Navigation />
                       <Courses />
                     </div>
                   </ProtectedRoute>
                 } 
               />
               <Route 
                 path="/course-assignments" 
                 element={
                   <ProtectedRoute>
                     <div className="min-h-screen">
                       <Navigation />
                       <CourseAssignments />
                     </div>
                   </ProtectedRoute>
                 } 
               />
               <Route 
                 path="/rewards" 
                 element={
                   <ProtectedRoute>
                     <div className="min-h-screen">
                       <Navigation />
                       <RewardsFeatureGate />
                     </div>
                   </ProtectedRoute>
                 } 
               />
               <Route 
                 path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'pedagogical_manager']}>
                    <div className="min-h-screen">
                      <Navigation />
                      <Reports />
                    </div>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute >
                    <div className="min-h-screen">
                      <Navigation />
                      <Profile />
                    </div>
                  </ProtectedRoute>
                } 
              />
                   <Route 
                path="/AdminSettings" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'pedagogical_manager']}>   
                    <div className="min-h-screen">
                      <Navigation />
                      <AdminSettings />
                    </div>
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/crm"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'sales_rep']}>
                    <div className="min-h-screen">
                      <Navigation />
                      <CRM />
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crm/institution/:id"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'sales_rep']}>
                    <div className="min-h-screen">
                      <Navigation />
                      <CRMInstitution />
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crm/instructor/:id"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'sales_rep']}>
                    <div className="min-h-screen">
                      <Navigation />
                      <CRMInstructor />
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crm/products"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'pedagogical_manager', 'sales_rep']}>
                    <div className="min-h-screen">
                      <Navigation />
                      <Products />
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen">
                      <Navigation />
                      <Tasks />
                    </div>
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
