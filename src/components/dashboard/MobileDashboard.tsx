import React, { useState } from 'react';
import {
  CalendarIcon,
  Users,
  BookOpen,
  BarChart3,
  Award,
  Plus,
  Clock,
  MapPin,
  Star,
  Heart,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { WeeklyCalendar } from '../ui/WeeklyCalendar';
import { useNavigate } from 'react-router-dom';

export interface ClassItem {
  time: string;
  title: string;
  instructor: string;
  booked: number;
  capacity: number;
  avatars: string[];
  status: "available" | "booked";
  date?: string;
}

interface MobileDashboardProps {
  stats: {
    totalLessons: number;
    activeStudents: number;
    activeCourses: number;
    monthlyEarnings: number;
    upcomingLessons: any[];
    recentActivity: any[];
  };
  lessons: any[];
}


const MobileDashboard: React.FC<MobileDashboardProps> = ({ stats, lessons }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const navigate = useNavigate();

  return (
    <div className="min-h-screen mb-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 text-gray-900">
      <main className="p-4 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-1 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            דשבורד מנהל פדגוגי
          </h2>
          <p className="text-sm text-gray-600">צפייה בפעילות השבועית</p>
        </div>

        {/* תגמולים Card */}
        <Card 
          className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 border-0 shadow-xl cursor-pointer active:scale-95 transition-all duration-200"
          onClick={() => navigate('/rewards')}
        >
          <CardContent className="p-6 text-center text-white">
            <div className="flex items-center justify-center mb-3">
              <Award className="h-8 w-8 text-white mr-3 animate-pulse" />
              <div className="text-right">
                <span className="text-2xl font-bold block">
                  ₪{stats.monthlyEarnings.toLocaleString()}
                </span>
                <span className="text-xs text-white/80">זמינים לתגמול</span>
              </div>
            </div>
            <p className="text-white font-bold text-sm mb-1">🏆 לידים שווים מחכים לכם</p>
            <p className="text-white/90 text-xs mb-3">לחצו לצפייה בכל התגמולים</p>
            <Button 
              size="sm"
              variant="secondary" 
              className="bg-white/20 text-white border-white/30 hover:bg-white/30 text-xs"
            >
              צפייה בתגמולים ←
            </Button>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-lg">
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-2" />
              <p className="text-lg font-bold">{stats.activeStudents}</p>
              <p className="text-xs opacity-90">תלמידים פעילים</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-lg">
            <CardContent className="p-4 text-center">
              <BookOpen className="h-6 w-6 mx-auto mb-2" />
              <p className="text-lg font-bold">{stats.totalLessons}</p>
              <p className="text-xs opacity-90">שיעורים הושלמו</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium">בחר תאריך:</span>
          </div>
          <WeeklyCalendar
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            lessons={lessons}
          />
        </div>

        {/* Daily Schedule */}
        <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <CardTitle className="text-lg flex items-center">
              <Clock className="h-5 w-5 mr-2" /> יומן יומי - {new Date().toLocaleDateString('he-IL')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {lessons.length > 0 ? (
              lessons.slice(0, 3).map((lesson, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-semibold text-sm">{lesson.institution_name}</p>
                  <p className="text-xs text-gray-600">
                    {new Date(lesson.scheduled_start).toLocaleTimeString('he-IL', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })} - {lesson.title}
                  </p>
                  <p className="text-xs text-gray-500">{lesson.instructorName}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">אין שיעורים מתוכננים להיום</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-2"
                  onClick={() => navigate('/courses')}
                >
                  הוסף שיעור
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Card */}
        <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-lg flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              ביצועי מדריכים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {[
              { name: 'דבר כהן', score: 96, rating: '4.8' },
              { name: 'שרה לוי', score: 92, rating: '4.5' },
              { name: 'מיכל אברהם', score: 88, rating: '4.3' },
            ].map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-gray-600 flex items-center">
                    <Star className="h-4 w-4 text-yellow-400 ml-1" /> {item.rating}/5
                  </span>
                </div>
                <Progress value={item.score} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Monthly Summary */}
        <Card className="bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300 shadow-lg">
          <CardContent className="text-center p-6">
            <div className="flex justify-center items-center gap-2 mb-2">
              <Award className="h-6 w-6 text-yellow-600" />
              <span className="text-xl font-bold text-yellow-800">₪{stats.monthlyEarnings.toLocaleString()}</span>
            </div>
            <p className="text-yellow-700 font-semibold text-sm">סיכום חודשי</p>
            <p className="text-xs text-yellow-600 mt-1">🏆 דירוג וביצועים מעולים</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MobileDashboard;