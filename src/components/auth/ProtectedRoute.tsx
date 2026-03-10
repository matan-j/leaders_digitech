import { useAuth } from "./AuthProvider";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // רשימת תפקידים מורשים (לא חובה)
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth(); // אם יש לך משתנה loading מה־AuthProvider

  // אם עדיין טוען נתוני משתמש – אל תנווט עדיין (כדי למנוע הבהוב)
  if (loading) {
    return <div className="flex justify-center items-center h-screen text-gray-500">טוען...</div>;
  }

  // אם אין משתמש מחובר — שלח לעמוד ההתחברות
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const role = user?.user_metadata?.role;

  // אם יש הגבלת תפקידים וה-role של המשתמש לא מורשה — החזר לעמוד הראשי
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  // אחרת, הצג את התוכן
  return <>{children}</>;
};
