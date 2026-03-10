import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Edit2, Check } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Trophy,
  Plus,
  TrendingUp,
  Target,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Phone,
  DollarSign,
  Flame,
  Crown,
  CalendarDays,
  Filter,
} from "lucide-react";
import SalesLeadAssignmentDialog from "@/components/SalesLeadAssignmentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import MobileNavigation from "@/components/layout/MobileNavigation";
// Import service functions
import { formatDateHebrew } from "@/services/formattersService";
import {
  calculateMonthlySummary,
  getStatusIcon as getStatusIconHelper,
  getStatusLabel,
  getStatusColor,
  getProgressFromStatus
} from "@/services/salesLeadsHelpers";
import { extractCityFromAddress } from "@/services/addressService";
import {
  fetchSalesLeads,
  updateSalesLeadStatus as updateSalesLeadStatusApi,
  updateSalesLeadValue as updateSalesLeadValueApi,
  fetchInstructors,
  fetchInstitutionsWithAddress
} from "@/services/apiService";

interface SalesLead {
  id: string;
  institution_name: string;
  instructor_id: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  status: string | null;
  potential_value: number | null;
  commission_percentage: number | null;
  notes: string | null;
  created_at: string | null;
  closed_at: string | null;
  instructor?: {
    id: string;
    full_name: string;
    phone: string | null;
  };
}

interface MonthlySummary {
  teaching_incentives: number;
  closing_bonuses: number;
  team_rewards: number;
  total: number;
}

const leadStatuses = [
  { value: "new", label: "חדש" },
  { value: "contacted", label: "נוצר קשר" },
  { value: "meeting_scheduled", label: "נקבעה פגישה" },
  { value: "proposal_sent", label: "נשלחה הצעה" },
  { value: "negotiation", label: "במשא ומתן" },
  { value: "follow_up", label: "מעקב" },
  { value: "closed_won", label: "נסגר - זכייה" },
];

export default function Rewards() {
  const  {user}= useAuth();
  const [salesLeads, setSalesLeads] = useState<SalesLead[]>([]);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

  const [isEditingPrice, setIsEditingPrice] = useState(false);
const [priceValues, setPriceValues] = useState<{ [key: string]: number }>({});
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>({
    teaching_incentives: 2600,
    closing_bonuses: 1350,
    team_rewards: 400,
    total: 4350
  });
  
  // Date filtering state (for all authenticated users)
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [filteredSalesLeads, setFilteredSalesLeads] = useState<SalesLead[]>([]);
  
  // Additional filter states
  const [selectedInstructor, setSelectedInstructor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedInstitution, setSelectedInstitution] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  
  // Data for filter options
  const [instructors, setInstructors] = useState<{id: string, full_name: string}[]>([]);
  const [institutions, setInstitutions] = useState<{name: string, city: string}[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  // Helper function to render icon components with styling
  const getStatusIcon = (status: string | null) => {
    const IconComponent = getStatusIconHelper(status);

    if (!status) return <IconComponent className="h-5 w-5 text-gray-600" />;

    const colorMap: Record<string, string> = {
      'new': 'text-blue-600',
      'contacted': 'text-yellow-600',
      'meeting_scheduled': 'text-blue-600',
      'proposal_sent': 'text-green-600',
      'negotiation': 'text-orange-600',
      'follow_up': 'text-orange-600',
      'closed_won': 'text-purple-600',
      'closed_lost': 'text-red-600'
    };

    const colorClass = colorMap[status] || 'text-gray-600';
    return <IconComponent className={`h-5 w-5 ${colorClass}`} />;
  };

  useEffect(() => {
    fetchSalesLeadsData();
  }, []);

  // Combined filtering effect (for all authenticated users)
  useEffect(() => {
    if (!salesLeads.length) return;
    
    let filtered = [...salesLeads];
    
    // Date filtering
    if (dateFrom) {
      filtered = filtered.filter(lead => 
        lead.created_at && new Date(lead.created_at) >= dateFrom
      );
    }
    
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(lead => 
        lead.created_at && new Date(lead.created_at) <= endOfDay
      );
    }
    
    // Instructor filtering
    if (selectedInstructor !== "all") {
      filtered = filtered.filter(lead => lead.instructor_id === selectedInstructor);
    }
    
    // Status filtering
    if (selectedStatus !== "all") {
      filtered = filtered.filter(lead => lead.status === selectedStatus);
    }
    
    // Institution filtering
    if (selectedInstitution !== "all") {
      filtered = filtered.filter(lead => lead.institution_name === selectedInstitution);
    }
    
    // City filtering
    if (selectedCity !== "all") {
      filtered = filtered.filter(lead => {
        const institutionData = institutions.find(inst => inst.name === lead.institution_name);
        return institutionData?.city === selectedCity;
      });
    }
    
    setFilteredSalesLeads(filtered);
  }, [dateFrom, dateTo, salesLeads, selectedInstructor, selectedStatus, selectedInstitution, selectedCity, institutions]);

  // Calculate monthly summary whenever filtered leads change
  useEffect(() => {
    const calculatedSummary = calculateMonthlySummary(filteredSalesLeads);
    setMonthlySummary(calculatedSummary);
  }, [filteredSalesLeads]);

  const clearDateFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const clearAllFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedInstructor("all");
    setSelectedStatus("all");
    setSelectedInstitution("all");
    setSelectedCity("all");
  };

  const fetchSalesLeadsData = useCallback(async () => {
    try {
      setLoading(true);
      // Use apiService function to fetch sales leads
      const data = await fetchSalesLeads();
      console.log("SALES", data);
      setSalesLeads(data || []);
      setFilteredSalesLeads(data || []);

      // Fetch additional data for filters
      await fetchFilterData(data || []);

    } catch (error) {
      console.error('Error fetching sales leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFilterData = async (salesData: SalesLead[]) => {
    try {
      // Fetch instructors using apiService function
      const instructorsData = await fetchInstructors();
      setInstructors(instructorsData || []);

      // Fetch institutions with address data using apiService function
      const institutionsData = await fetchInstitutionsWithAddress();

      // Extract cities from addresses and combine with institution names
      const institutionsWithCities = (institutionsData || []).map((inst: any) => {
        const city = extractCityFromAddress(inst.address || '');
        return { name: inst.name, city };
      });

      // Also include institutions from sales leads that might not be in educational_institutions table
      const salesInstitutions = salesData.map(lead => {
        return { name: lead.institution_name, city: 'לא צוין' };
      });

      // Combine and deduplicate
      const allInstitutions = [...institutionsWithCities, ...salesInstitutions];
      const uniqueInstitutions = allInstitutions.filter((inst, index, self) =>
        index === self.findIndex(i => i.name === inst.name)
      );

      setInstitutions(uniqueInstitutions);

      // Extract unique cities
      const uniqueCities = [...new Set(uniqueInstitutions.map(inst => inst.city).filter(city => city && city !== 'לא צוין'))];
      setCities(uniqueCities.sort());

    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  const updateLeadValue = async (leadId: string, newValue: number) => {
    try {
      // Use apiService function to update lead value
      await updateSalesLeadValueApi(leadId, newValue);

      setSalesLeads(prev =>
        prev.map(lead =>
          lead.id === leadId ? { ...lead, potential_value: newValue } : lead
        )
      );

    } catch (error) {
      console.error('Error updating lead value:', error);
    }
  };

const pendingClosures = filteredSalesLeads.filter(

  (lead) =>  { return lead.status !== 'closed_won' }
);

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      // Use apiService function to update lead status
      await updateSalesLeadStatusApi(leadId, newStatus);

      // Update local state
      setSalesLeads(prev => prev.map(lead =>
        lead.id === leadId
          ? {
              ...lead,
              status: newStatus,
              ...(newStatus.startsWith('closed_') ? { closed_at: new Date().toISOString() } : {})
            }
          : lead
      ));

    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 overflow-x-hidden mb-12">
      <div className="md:hidden">
        <MobileNavigation />
      </div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="h-8 w-8 text-yellow-600 ml-3" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              תגמולים ומכירות
            </h1>
          </div>
          <p className="text-xl text-gray-700 my-2 text-center">
            שלום {user.user_metadata.full_name}! אתה בדרך לסגור את החודש הגדול שלך 
            <Flame className="h-6 w-6 text-orange-500 inline mx-2" />
          </p>
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-4 inline-block">
            <p className="text-lg font-semibold text-purple-800 flex items-center justify-center">
              <Crown className="h-5 w-5 ml-2 text-yellow-600" />
    אתה {pendingClosures.length} סגירות בלבד ממדריך החודש!
            </p>
          </div>
        </div>

        {/* Pipeline Section */}
        <div className="mb-8">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Target className="h-6 w-6 ml-2 text-blue-600" />
              פייפליין – התקדמות מול מוסדות
            </h2>
          {user.user_metadata.role!=="instructor"?(  <Button 
              className="flex items-center space-x-2 space-x-reverse bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg"
              onClick={() => setIsAssignmentDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span>הקצה ליד למדריך</span>
            </Button>)
            :
            (<Button 
              className="flex items-center space-x-2 space-x-reverse bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg"
              onClick={() => setIsAssignmentDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span> הוסף ליד </span>
            </Button>)}
          </div>

          {/* Comprehensive Filters */}
          <Card className="border-primary/20 shadow-md mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-primary">
                <Filter className="h-5 w-5 ml-2" />
                סינון וחיפוש
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Date Filters Row */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">סינון לפי תאריך יצירה</h4>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="date-from">מתאריך</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarDays className="ml-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: he }) : 'בחר תאריך התחלה'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                          locale={he}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="flex-1">
                    <Label htmlFor="date-to">עד תאריך</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarDays className="ml-2 h-4 w-4" />
                          {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: he }) : 'בחר תאריך סיום'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                          locale={he}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Additional Filters Row */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">סינון נוסף</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Instructor Filter */}
                  <div>
                    <Label htmlFor="instructor-filter">מדריך</Label>
                    <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                      <SelectTrigger>
                        <SelectValue placeholder="כל המדריכים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל המדריכים</SelectItem>
                        {instructors.map((instructor) => (
                          <SelectItem key={instructor.id} value={instructor.id}>
                            {instructor.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <Label htmlFor="status-filter">סטטוס</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="כל הסטטוסים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל הסטטוסים</SelectItem>
                        {leadStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Institution Filter */}
                  <div>
                    <Label htmlFor="institution-filter">מוסד חינוכי</Label>
                    <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                      <SelectTrigger>
                        <SelectValue placeholder="כל המוסדות" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל המוסדות</SelectItem>
                        {institutions.map((institution, index) => (
                          <SelectItem key={`${institution.name}-${index}`} value={institution.name}>
                            {institution.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* City Filter */}
                  <div>
                    <Label htmlFor="city-filter">עיר</Label>
                    <Select value={selectedCity} onValueChange={setSelectedCity}>
                      <SelectTrigger>
                        <SelectValue placeholder="כל הערים" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל הערים</SelectItem>
                        {cities.map((city, index) => (
                          <SelectItem key={`${city}-${index}`} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Clear Filters and Results Summary */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={clearAllFilters}
                  className="px-6"
                >
                  נקה את כל הסינונים
                </Button>
                
                {(dateFrom || dateTo || selectedInstructor !== "all" || selectedStatus !== "all" || selectedInstitution !== "all" || selectedCity !== "all") && (
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <p className="text-sm text-primary font-medium">
                      מציג {filteredSalesLeads.length} לידים מתוך {salesLeads.length}
                      {dateFrom && ` | מתאריך ${format(dateFrom, 'dd/MM/yyyy', { locale: he })}`}
                      {dateTo && ` | עד תאריך ${format(dateTo, 'dd/MM/yyyy', { locale: he })}`}
                      {selectedInstructor !== "all" && ` | מדריך: ${instructors.find(i => i.id === selectedInstructor)?.full_name}`}
                      {selectedStatus !== "all" && ` | סטטוס: ${leadStatuses.find(s => s.value === selectedStatus)?.label}`}
                      {selectedInstitution !== "all" && ` | מוסד: ${selectedInstitution}`}
                      {selectedCity !== "all" && ` | עיר: ${selectedCity}`}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="mr-2 text-gray-600">טוען לידים...</span>
            </div>
          ) : filteredSalesLeads.length === 0 ? (
            <Card className="text-center py-16 shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardContent>
                <Target className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {salesLeads.length === 0 ? 'אין לידים במערכת' : 'אין לידים בטווח התאריכים שנבחר'}
                </h3>
                <p className="text-gray-600 mb-6 text-lg">
                  {salesLeads.length === 0 ? 'התחל ליצור לישדים עבור המדריכים' : 'נסה לשנות את טווח התאריכים או לנקות את הסינון'}
                </p>
                <Button 
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg"
                  onClick={() => setIsAssignmentDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  צור ליד חדש
                </Button>
              </CardContent>
            </Card>
          ) : (
      <div className="space-y-4">
  {filteredSalesLeads.map((lead) => {
    const isEditing = editingPriceId === lead.id;
    const value = priceValues[lead.id] ?? lead.potential_value ?? 0;

    return (
      <Card key={lead.id} className="shadow-lg border-0 bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center">
              {getStatusIcon(lead.status)}
              <CardTitle className="text-xl mr-3 break-words">{lead.institution_name}</CardTitle>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <Select 
                value={lead.status || "new"} 
                onValueChange={(value) => updateLeadStatus(lead.id, value)}
              >
                <SelectTrigger className={`${getStatusColor(lead.status)} border-0 font-medium`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leadStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* מדריך */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">מדריך:</p>
              <p className="text-gray-900 flex items-center">
                <Crown className="h-4 w-4 ml-1 text-purple-500" />
                {lead.instructor?.full_name || 'לא הוקצה'}
              </p>
              {lead.instructor?.phone && (
                <p className="text-sm text-gray-500">{lead.instructor.phone}</p>
              )}
            </div>

            {/* איש קשר */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">איש קשר:</p>
              <p className="text-gray-900">{lead.contact_person || 'לא צוין'}</p>
              {lead.contact_phone && (
                <p className="text-sm text-gray-500 flex items-center">
                  <Phone className="h-3 w-3 ml-1" />
                  {lead.contact_phone}
                </p>
              )}
            </div>

            {/* ערך פוטנציאלי */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">ערך פוטנציאלי:</p>
              <div className="flex items-center text-lg font-bold text-green-600">
                <button
                  className="text-black px-1 py-0.5 hover:bg-gray-200 rounded flex items-center"
                  onClick={() => {
                    if (isEditing) {
                      updateLeadValue(lead.id, value);
                      setEditingPriceId(null);
                    } else {
                      setEditingPriceId(lead.id);
                      setPriceValues(prev => ({ ...prev, [lead.id]: lead.potential_value ?? 0 }));
                    }
                  }}
                >
{user?.user_metadata.role === "admin" && (
  isEditing ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />
)}             
 </button>

                {isEditing ? (
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setPriceValues(prev => ({ ...prev, [lead.id]: Number(e.target.value) }))}
                    className="text-lg font-bold text-green-600 border border-gray-300 rounded px-1 py-0.5 mr-2 w-24"
                  />
                ) : (
                  <span className="mr-2">{lead.potential_value?.toLocaleString() || '0'}₪</span>
                )}
              </div>

              {lead.commission_percentage && (
                <p className="text-sm text-gray-500">עמלה: {lead.commission_percentage}%</p>
              )}
            </div>

            {/* התקדמות */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">התקדמות:</p>
              <div className="flex items-center space-x-3 space-x-reverse">
                <Progress 
                  value={getProgressFromStatus(lead.status)} 
                  className="flex-1 h-3"
                />
                <span className="text-sm font-bold text-gray-700 min-w-[35px]">
                  {getProgressFromStatus(lead.status)}%
                </span>
              </div>
            </div>
          </div>

          {/* תאריכים */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">תאריך יצירה:</p>
              <p className="text-sm text-gray-600">{formatDateHebrew(lead.created_at)}</p>
            </div>

            {lead.closed_at && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">תאריך סגירה:</p>
                <p className="text-sm text-gray-600">{formatDateHebrew(lead.closed_at)}</p>
              </div>
            )}
          </div>

          {/* הערות */}
          {lead.notes && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-1">הערות:</p>
              <p className="text-blue-800">{lead.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  })}
</div>
          )}
        </div>

        {/* Monthly Summary */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <DollarSign className="h-7 w-7 ml-2" />
              סיכום תגמולים – יוני 2025
              {(dateFrom || dateTo) && (
                <span className="text-sm font-normal mr-2 bg-white/20 px-2 py-1 rounded">
                  (מסונן)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6">
              {/* <div className="text-center">
                <p className="text-purple-100 text-sm mb-1">תמריצי הוראה</p>
                <p className="text-2xl font-bold">₪{monthlySummary.teaching_incentives.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-purple-100 text-sm mb-1">בונוסים סגירת מוסדות</p>
                <p className="text-2xl font-bold">₪{monthlySummary.closing_bonuses.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-purple-100 text-sm mb-1">תגמולים קבוצתיים</p>
                <p className="text-2xl font-bold">₪{monthlySummary.team_rewards.toLocaleString()}</p>
              </div> */}
              <div className="text-center bg-white/20 rounded-lg p-4">
                <p className="text-purple-100 text-sm mb-1">
                  {(dateFrom || dateTo) ? 'סה״כ צפוי (מסונן)' : 'סה״כ צפוי'}
                </p>
                <p className="text-3xl font-bold flex items-center justify-center">
                  ₪{monthlySummary.total.toLocaleString()}
                  <Flame className="h-6 w-6 ml-2 text-orange-300" />
                </p>
                {(dateFrom || dateTo) && (
                  <p className="text-purple-100 text-xs mt-1">
                    מבוסס על {filteredSalesLeads.length} לידים מתוך {salesLeads.length}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Lead Assignment Dialog */}
        <SalesLeadAssignmentDialog
          open={isAssignmentDialogOpen}
          onOpenChange={setIsAssignmentDialogOpen}
          onLeadCreated={() => {
            fetchSalesLeadsData(); // Refresh the leads list
          }}
        />
      </main>
    </div>
  );
};