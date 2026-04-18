
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (

  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
                       <Rewards />
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
