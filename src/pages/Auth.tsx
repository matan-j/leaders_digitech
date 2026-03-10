
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from '@/components/ui/use-toast';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import bg from '../materials/bg.png';
import logo from '../materials/logo.png';

const Auth = () => {
  const { user, signIn, signUp, resetPassword } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: '',
    phone: '',
  });

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        // Handle password reset
        const { error } = await resetPassword(formData.email);
        if (error) {
          toast({
            title: 'שגיאה',
            description: 'אירעה שגיאה בשליחת המייל',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'מייל נשלח בהצלחה',
            description: 'נא לבדוק את תיבת המייל ולעקוב אחר ההוראות לאיפוס הסיסמה',
          });
          setIsForgotPassword(false);
          setFormData({ ...formData, email: '', password: '' });
        }
      } else if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast({
            title: 'שגיאה בהתחברות',
            description: error.message === 'Invalid login credentials' 
              ? 'פרטי התחברות שגויים' 
              : error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'התחברות הושלמה',
            description: 'ברוך הבא למערכת ניהול המנחים',
          });
        }
      } else {
        if (!formData.fullName.trim()) {
          toast({
            title: 'שגיאה',
            description: 'נא למלא שם מלא',
            variant: 'destructive',
          });
          return;
        }
        
        const { error } = await signUp(
          formData.email, 
          formData.password, 
          formData.fullName, 
          formData.role as 'instructor' | 'pedagogical_manager' | 'admin',
          formData.phone
        );
        if (error) {
          toast({
            title: 'שגיאה ברישום',
            description: error.message === 'User already registered' 
              ? 'משתמש כבר רשום במערכת' 
              : error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'הרישום הושלם',
            description: 'נא לבדוק את תיבת המייל לאישור החשבון',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה לא צפויה',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRoleChange = (value: string) => {
    setFormData({
      ...formData,
      role: value,
    });
  };

  const handleForgotPasswordClick = () => {
    setIsForgotPassword(true);
    setFormData({ ...formData, password: '' });
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setFormData({ email: '', password: '', fullName: '', role: 'instructor', phone: '' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <Card
        className="w-full max-w-md relative overflow-hidden rounded-2xl shadow-xl bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      >
        <div className="relative z-10">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logo} alt="Logo" className="h-30 w-64 mb-5" />
            </div>
            <CardTitle className="text-2xl font-bold text-white drop-shadow-md">
              {isForgotPassword 
                ? 'איפוס סיסמה' 
                : (isLogin ? 'התחברות למערכת' : 'רישום למערכת')}
            </CardTitle>
            <CardDescription className="text-gray-200">
              {isForgotPassword
                ? 'הזן את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה'
                : (isLogin
                  ? 'הכנס את פרטיך להתחברות למערכת ניהול המנחים'
                  : 'צור חשבון חדש במערכת ניהול המנחים')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && !isForgotPassword && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-gray-200">שם מלא</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      placeholder="הכנס שם מלא"
                      className="bg-white/90 text-gray-900 placeholder-gray-500"
                      required={!isLogin}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-gray-200">טלפון</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="מספר טלפון"
                      className="bg-white/90 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-gray-200">תפקיד</Label>
                    <Select value={formData.role} onValueChange={handleRoleChange}>
                      <SelectTrigger className="bg-white/90 text-gray-900">
                        <SelectValue placeholder="בחר תפקיד" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instructor">מדריך/מרצה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-200">אימייל</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="example@domain.com"
                  className="bg-white/90 text-gray-900 placeholder-gray-500"
                  required
                />
              </div>

              {!isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-200">סיסמה</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="הכנס סיסמה"
                      className="bg-white/90 text-gray-900 placeholder-gray-500"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute left-0 top-0 h-full px-3 py-2 text-gray-600 hover:text-gray-900"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {isLogin && !isForgotPassword && (
                <div className="text-right">
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleForgotPasswordClick}
                    className="text-sm text-blue-200 hover:text-white p-0 h-auto"
                  >
                    שכחתי סיסמה
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700"
                disabled={loading}
              >
                {loading ? 'מעבד...' : (isForgotPassword ? 'שלח קישור לאיפוס' : (isLogin ? 'התחבר' : 'הירשם'))}
              </Button>
            </form>

            <div className="mt-6 text-center">
              {isForgotPassword ? (
                <Button
                  variant="link"
                  onClick={handleBackToLogin}
                  className="text-sm text-blue-200 hover:text-white inline-flex items-center gap-1"
                >
                  <ArrowRight className="h-4 w-4" />
                  חזרה להתחברות
                </Button>
              ) : (
                <Button
                  variant="link"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setFormData({ email: '', password: '', fullName: '', role: 'instructor', phone: '' });
                  }}
                  className="text-sm text-blue-200 hover:text-white"
                >
                  {isLogin
                    ? 'אין לך חשבון? לחץ כאן להרשמה'
                    : 'יש לך כבר חשבון? לחץ כאן להתחברות'}
                </Button>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};

export default Auth;