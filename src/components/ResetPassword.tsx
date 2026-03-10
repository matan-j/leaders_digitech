import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from '@/components/ui/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import bg from '../materials/bg.png';
import logo from '../materials/logo.png';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({
        title: 'שגיאה',
        description: 'הסיסמאות אינן תואמות',
        variant: 'destructive',
      });
      return;
    }

    // Validate password length
    if (passwords.newPassword.length < 6) {
      toast({
        title: 'שגיאה',
        description: 'הסיסמה חייבת להכיל לפחות 6 תווים',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await updatePassword(passwords.newPassword);
      
      if (error) {
        toast({
          title: 'שגיאה',
          description: 'אירעה שגיאה באיפוס הסיסמה. ייתכן שהקישור פג תוקף.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'הסיסמה עודכנה בהצלחה',
          description: 'כעת תוכל להתחבר עם הסיסמה החדשה',
        });
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
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
    setPasswords({
      ...passwords,
      [e.target.name]: e.target.value,
    });
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
              יצירת סיסמה חדשה
            </CardTitle>
            <CardDescription className="text-gray-200">
              הזן סיסמה חדשה לחשבון שלך
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-gray-200">סיסמה חדשה</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={passwords.newPassword}
                    onChange={handleInputChange}
                    placeholder="הכנס סיסמה חדשה (לפחות 6 תווים)"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-200">אישור סיסמה</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwords.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="הכנס שוב את הסיסמה החדשה"
                    className="bg-white/90 text-gray-900 placeholder-gray-500"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 py-2 text-gray-600 hover:text-gray-900"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700"
                disabled={loading}
              >
                {loading ? 'מעדכן...' : 'עדכן סיסמה'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button
                variant="link"
                onClick={() => navigate('/auth')}
                className="text-sm text-blue-200 hover:text-white"
              >
                חזרה להתחברות
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;