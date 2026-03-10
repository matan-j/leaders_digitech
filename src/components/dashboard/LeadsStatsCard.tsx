import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  Clock, 
  Plus, 
  TrendingUp, 
  Building, 
  CheckCircle,
  AlertCircle,
  Target,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface LeadsStats {
  closedWon: number;
  waiting: number;
  newLeads: number;
  total: number;
}

interface SalesLead {
  id: string;
  status: string | null;
  institution_name: string;
}

export default function LeadsStatsCard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<LeadsStats>({
    closedWon: 0,
    waiting: 0,
    newLeads: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeadsStats();
  }, []);

  const fetchLeadsStats = async () => {
    try {
      setLoading(true);
      const { data: salesLeads, error } = await supabase
        .from('sales_leads')
        .select('id, status, institution_name')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales leads:', error);
        return;
      }

      const leads = salesLeads || [];
      const total = leads.length;

      // כמה בתי ספר נסגרו בזכייה - סטטוס closed_won
      const closedWon = leads.filter(lead => lead.status === 'closed_won').length;

      // כמה ממתינים - בסטטוסים שהם לא closed_won ולא new
      const waiting = leads.filter(lead => 
        lead.status && 
        lead.status !== 'closed_won' && 
        lead.status !== 'new'
      ).length;

      // כמה בסטטוס new
      const newLeads = leads.filter(lead => lead.status === 'new' || !lead.status).length;

      setStats({
        closedWon,
        waiting,
        newLeads,
        total
      });

    } catch (error) {
      console.error('Error fetching leads stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="mr-2 text-gray-600">טוען נתוני לידים...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 hover:shadow-2xl transition-all duration-300">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          <Building className="h-6 w-6 text-purple-600 ml-2" />
          ריכוז לידים ובתי ספר
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">מעקב אחר ביצועי המכירות והתקדמות עם מוסדות חינוך</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* סיכום כללי */}
        <div className="grid grid-cols-1 gap-4">
          {/* נסגרו בזכייה */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border border-green-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-500 rounded-lg ml-3">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">נסגרו בזכייה</p>
                <p className="text-xs text-green-600">בתי ספר שהסכימו</p>
              </div>
            </div>
            <div className="text-left">
              <Badge variant="secondary" className="bg-green-500 text-white text-lg font-bold px-3 py-1">
                {stats.closedWon}
              </Badge>
            </div>
          </div>

          {/* ממתינים */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-lg border border-orange-200">
            <div className="flex items-center">
              <div className="p-2 bg-orange-500 rounded-lg ml-3">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-800">ממתינים</p>
                <p className="text-xs text-orange-600">בתהליך מעקב ופיתוח</p>
              </div>
            </div>
            <div className="text-left">
              <Badge variant="secondary" className="bg-orange-500 text-white text-lg font-bold px-3 py-1">
                {stats.waiting}
              </Badge>
            </div>
          </div>

          {/* חדשים */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500 rounded-lg ml-3">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800">לידים חדשים</p>
                <p className="text-xs text-blue-600">טרם החל טיפול</p>
              </div>
            </div>
            <div className="text-left">
              <Badge variant="secondary" className="bg-blue-500 text-white text-lg font-bold px-3 py-1">
                {stats.newLeads}
              </Badge>
            </div>
          </div>
        </div>

        {/* סיכום */}
        <div className="mt-6 p-4 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Target className="h-5 w-5 text-purple-600 ml-2" />
              <span className="text-sm font-medium text-purple-800">סה״כ לידים במערכת</span>
            </div>
            <Badge variant="secondary" className="bg-purple-600 text-white text-xl font-bold px-4 py-2">
              {stats.total}
            </Badge>
          </div>

          {stats.total > 0 && (
            <div className="mt-3 text-xs text-purple-600">
              <div className="flex justify-between">
                <span>אחוז הצלחה:</span>
                <span className="font-semibold">
                  {((stats.closedWon / stats.total) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span>בתהליך פעיל:</span>
                <span className="font-semibold">
                  {((stats.waiting / stats.total) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* הודעות מצב */}
        {stats.total === 0 && (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">אין לידים במערכת כרגע</p>
            <p className="text-xs text-gray-500 mt-1">הקצו לידים חדשים למדריכים דרך מסך התגמולים</p>
          </div>
        )}

        {stats.newLeads > 5 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-blue-600 ml-2" />
              <p className="text-xs text-blue-700 font-medium">
                יש {stats.newLeads} לידים חדשים הממתינים לטיפול
              </p>
            </div>
          </div>
        )}

        {stats.closedWon > 0 && stats.total > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 ml-2" />
              <p className="text-xs text-green-700 font-medium">
                מצוין! נסגרו {stats.closedWon} עסקאות בהצלחה
              </p>
            </div>
          </div>
        )}

        {/* כפתור לעבור לדף התגמולים */}
        <div className="mt-4 pt-4 border-t border-purple-200">
          <Button 
            onClick={() => navigate('/rewards')}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium shadow-lg transition-all duration-200"
          >
            <ExternalLink className="h-4 w-4 ml-2" />
            צפייה בפירוט מלא ומעקב לידים
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}