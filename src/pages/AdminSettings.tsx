// AdminSettings.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings, 
  Users, 
  Building2, 
  Calendar, 
  Clock,
  Trash,
  Edit,
  Plus,
  AlertCircle,
  Save,
  X,
  Loader2,
  CalendarX,
  UserX,
  Shield,
  UserCog
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "@/components/ui/use-toast";
import MobileNavigation from "@/components/layout/MobileNavigation";

// Types
interface BlockedDate {
  id: string;
  date?: string; // For single dates (legacy)
  start_date?: string; // For ranges
  end_date?: string; // For ranges
  reason?: string;
  created_at?: string;
}

interface SystemDefaults {
  id?: string;
  default_lesson_duration: number;
  default_task_duration: number;

}


interface Contact {
  name: string;
  phone: string;
  email: string;
  role: string;
}

interface Institution {
  id: string;
  name: string;
  city: string;
  address?: string;
  notes?: string;
  created_at?: string;
  contacts?: Contact[]; // 👈 החדש במקום contact_person, contact_phone, contact_email
}



interface Instructor {
  id: string;
  full_name: string;
  phone?: string;
  role?: string;
  hourly_rate?: number;
  created_at?: string;
  updated_at?: string;
  email?: string;
  birthdate?: string; // Use string for date input compatibility
  current_work_hours?: number;
  benefits?: string;
  img?: string;
}
interface SystemUser {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'pedagogical_manager';
  created_at?: string;
  updated_at?: string;
}

interface Assignment {
  id: string;
  course_name: string;
  institution_name: string;
  start_date: string;
  end_date: string;
}

const AdminSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('defaults');
  const [loading, setLoading] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [showEditInstructorModal, setShowEditInstructorModal] = useState(false);
  const [instructorForm, setInstructorForm] = useState<Partial<Instructor>>({});
  // States for defaults
  const [defaults, setDefaults] = useState<SystemDefaults>({
    default_lesson_duration: 45,
    default_task_duration: 15,
   
  });
  const [newBlockedDate, setNewBlockedDate] = useState({ 
  type: 'single', // 'single' or 'range'
  date: '', 
  start_date: '',
  end_date: '',
  reason: '' 
});
  // States for institutions
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [showInstitutionModal, setShowInstitutionModal] = useState(false);
const [institutionForm, setInstitutionForm] = useState<Partial<Institution>>({
  name: '',
  city: '',
  address: '',
  notes: '',
  contacts: [{ name: '', phone: '', email: '', role: '' }]
});

  // States for instructors  
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [instructorAssignments, setInstructorAssignments] = useState<Assignment[]>([]);
  const [reassignToInstructor, setReassignToInstructor] = useState('');
  
  // States for blocked dates
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [showBlockedDateModal, setShowBlockedDateModal] = useState(false);


  // States for system users
const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
const [showSystemUserModal, setShowSystemUserModal] = useState(false);
const [editingSystemUser, setEditingSystemUser] = useState<SystemUser | null>(null);
const [systemUserForm, setSystemUserForm] = useState<Partial<SystemUser>>({
  full_name: '',
  email: '',
  phone: '',
  role: 'pedagogical_manager'
});
const [systemUserPassword, setSystemUserPassword] = useState('');
const [showDeleteSystemUserConfirm, setShowDeleteSystemUserConfirm] = useState(false);
const [selectedSystemUser, setSelectedSystemUser] = useState<SystemUser | null>(null);


  // Check user permissions
  const userRole = user?.user_metadata?.role;
  const hasAccess = ['admin', 'pedagogical_manager'].includes(userRole);
  const isAdmin = userRole === 'admin';


 // Function to open the edit modal
  const openEditInstructorModal = (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    setInstructorForm(instructor); // Load current instructor data into the form
    setShowEditInstructorModal(true);
  };

  // Function to handle form input changes
  const handleInstructorFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setInstructorForm(prev => ({
      ...prev,
      [id]: type === 'number' ? (value === '' ? null : parseFloat(value)) : value,
    }));
  };
  



const handleUpdateInstructor = async () => {
  if (!selectedInstructor) return;
  
  setLoading(true);
  try {
    const emailChanged = instructorForm.email !== selectedInstructor.email;
    const nameChanged = instructorForm.full_name !== selectedInstructor.full_name;

    // Update auth data if needed
    if (emailChanged || nameChanged) {
      const newMetadata = {
        ...selectedInstructor,
        full_name: instructorForm.full_name,
        name: instructorForm.full_name
      };

      const { error: authError } = await supabase.rpc('update_user_auth_data', {
        target_user_id: selectedInstructor.id,
        new_email: emailChanged ? instructorForm.email : null,
        new_metadata: nameChanged ? newMetadata : null
      });

      if (authError) {
        throw new Error(`שגיאה בעדכון נתוני האימות: ${authError.message}`);
      }
    }

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        ...instructorForm, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', selectedInstructor.id);

    if (profileError) throw profileError;

    toast({ title: "✅ פרופיל המדריך עודכן בהצלחה" });
    setShowEditInstructorModal(false);
    fetchInstructors();

  } catch (error: any) {
    toast({
      title: "❌ שגיאה בעדכון הפרופיל",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};
  // Fetch system defaults
  const fetchDefaults = async () => {
    try {
      const { data, error } = await supabase
        .from('system_defaults')
        .select('*')
        .single();
      
      if (error && error.code === 'PGRST116') {
        // No defaults exist, create them
        const { data: newDefaults } = await supabase
          .from('system_defaults')
          .insert([{
            default_lesson_duration: 45,
            default_task_duration: 15,
            default_break_duration: 10
          }])
          .select()
          .single();
        
        if (newDefaults) setDefaults(newDefaults);
      } else if (data) {
        setDefaults(data);
      }
    } catch (error) {
      console.error('Error fetching defaults:', error);
    }
  };

  // Update defaults
  const updateDefaults = async () => {
    setSavingDefaults(true);
    try {
      const { error } = await supabase
        .from('system_defaults')
        .update({
          ...defaults,
          updated_at: new Date().toISOString(),
        })
        .eq('id', defaults.id); // Assuming an ID exists
      
      if (!error) {
        toast({
          title: "✅ ההגדרות עודכנו בהצלחה",
          description: "ברירות המחדל החדשות ישמשו בהקצאות חדשות"
        });
      }
    } catch (error) {
      toast({
        title: "❌ שגיאה בעדכון ההגדרות",
        variant: "destructive"
      });
    } finally {
      setSavingDefaults(false);
    }
  };

  // Fetch institutions
  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('educational_institutions')
        .select('*')
        .order('name');
      
      if (data) setInstitutions(data);
    } catch (error) {
      console.error('Error fetching institutions:', error);
    } finally {
      setLoading(false);
    }
  };

const addContact = () => {
  const currentContacts = institutionForm.contacts || [];
  if (currentContacts.length >= 5) {
    toast({
      title: "הגעת למקסימום",
      description: "ניתן להוסיף עד 5 אנשי קשר בלבד",
      variant: "destructive",
    });
    return;
  }
  setInstitutionForm(prev => ({
    ...prev,
    contacts: [...(prev.contacts || []), { name: '', phone: '', email: '', role: '' }]
  }));
};

const removeContact = (index: number) => {
  const currentContacts = institutionForm.contacts || [];
  if (currentContacts.length <= 1) {
    toast({
      title: "לא ניתן להסיר",
      description: "חייב להיות לפחות איש קשר אחד",
      variant: "destructive",
    });
    return;
  }
    setInstitutionForm(prev => ({
    ...prev,
    contacts: (prev.contacts || []).filter((_, i) => i !== index)
  }));
};

const updateContact = (index: number, field: keyof Contact, value: string) => {
  setInstitutionForm(prev => ({
    ...prev,
    contacts: (prev.contacts || []).map((contact, i) => 
      i === index ? { ...contact, [field]: value } : contact
    )
  }));
};


  
const saveInstitution = async () => {
  if (!institutionForm.name?.trim() || !institutionForm.city?.trim()) {
    toast({
      title: "שגיאה",
      description: "נדרש למלא שם מוסד ועיר",
      variant: "destructive",
    });
    return;
  }

  // וידוא שיש לפחות איש קשר אחד עם שם
  const validContacts = (institutionForm.contacts || []).filter(c => c.name.trim());
  if (validContacts.length === 0) {
    toast({
      title: "שגיאה",
      description: "נדרש לפחות איש קשר אחד עם שם",
      variant: "destructive",
    });
    return;
  }

  setLoading(true);
  try {
    const dataToSave = {
      name: institutionForm.name,
      city: institutionForm.city,
      address: institutionForm.address || null,
      notes: institutionForm.notes || null,
      contacts: validContacts // שומר רק אנשי קשר תקינים
    };

    if (editingInstitution) {
      const { error } = await supabase
        .from('educational_institutions')
        .update(dataToSave)
        .eq('id', institutionForm.id!);

      if (error) throw error;
      toast({ title: "הצלחה", description: "המוסד עודכן בהצלחה" });
    } else {
      const { error } = await supabase
        .from('educational_institutions')
        .insert([dataToSave]);

      if (error) throw error;
      toast({ title: "הצלחה", description: "המוסד נוסף בהצלחה" });
    }

    closeInstitutionModal();
    fetchInstitutions();
  } catch (error) {
    console.error('Error saving institution:', error);
    toast({
      title: "שגיאה",
      description: "אירעה שגיאה בשמירת המוסד",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};
  // Delete institution
  const deleteInstitution = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מוסד זה?')) return;
    
    setLoading(true);
    try {
      // Check if institution has assignments
      const { data: assignments } = await supabase
        .from('course_instances')
        .select('id')
        .eq('institution_id', id)
        .limit(1);
      
      if (assignments && assignments.length > 0) {
        toast({
          title: "⚠️ לא ניתן למחוק",
          description: "למוסד זה יש הקצאות פעילות",
          variant: "destructive"
        });
        return;
      }
      
      const { error } = await supabase
        .from('educational_institutions')
        .delete()
        .eq('id', id);
      
      if (!error) {
        fetchInstitutions();
        toast({ title: "✅ המוסד נמחק בהצלחה" });
      }
    } catch (error) {
      toast({
        title: "❌ שגיאה במחיקת המוסד",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };



const openInstitutionModal = (institution?: Institution) => {
  if (institution) {
    setEditingInstitution(institution);
    setInstitutionForm({
      ...institution,
      contacts: institution.contacts && institution.contacts.length > 0 
        ? institution.contacts 
        : [{ name: '', phone: '', email: '', role: '' }]
    });
  } else {
    setEditingInstitution(null);
    setInstitutionForm({
      id: '',
      name: '',
      city: '',
      address: '',
      notes: '',
      contacts: [{ name: '', phone: '', email: '', role: '' }]
    });
  }
  setShowInstitutionModal(true);
};

  // Close institution modal
const closeInstitutionModal = () => {
  setShowInstitutionModal(false);
  setEditingInstitution(null);
  setInstitutionForm({
    name: '',
    city: '',
    address: '',
    notes: '',
    contacts: [{ name: '', phone: '', email: '', role: '' }]
  });
};

  // Fetch instructors
  const fetchInstructors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'instructor')
        .order('full_name');
      
      if (data) setInstructors(data);
    } catch (error) {
      console.error('Error fetching instructors:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check instructor assignments
  const checkInstructorAssignments = async (instructorId: string) => {
    try {
      const { data, error } = await supabase
        .from('course_instances')
        .select(`
          id,
          courses (name),
          educational_institutions (name),
          start_date,
          end_date
        `)
        .eq('instructor_id', instructorId);
      
      if (data) {
        const assignments = data.map(item => ({
          id: item.id,
          course_name: (item.courses as any)?.name || 'ללא שם',
          institution_name: (item.educational_institutions as any)?.name || 'ללא שם',
          start_date: item.start_date,
          end_date: item.end_date
        }));
        
        setInstructorAssignments(assignments);
        return assignments.length > 0;
      }
      return false;
    } catch (error) {
      console.error('Error checking assignments:', error);
      return false;
    }
  };

 
    const handleDeleteInstructor = async () => {
    if (!selectedInstructor) {
        toast({ title: "שגיאה: לא נבחר מדריך למחיקה", variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
        // שלב 1: עדכון הקצאות קיימות (מתבצע בצד הלקוח לפני המחיקה)
        if (reassignToInstructor) {
            await supabase
                .from('course_instances')
                .update({ instructor_id: reassignToInstructor })
                .eq('instructor_id', selectedInstructor.id);
        } else if (instructorAssignments.length > 0) {
             await supabase
                .from('course_instances')
                .update({ instructor_id: null })
                .eq('instructor_id', selectedInstructor.id);
        }

        // שלב 2: קריאה לפונקציה שלך בשם הנכון - 'delete-user'
        const { error } = await supabase.functions.invoke('delete-user', {
            body: {
                userId: selectedInstructor.id,
                instructorName: selectedInstructor.full_name,
                assignments: instructorAssignments,
                userType: 'instructor' // ⬅️ הוסף!
            },
        });

        if (error) {
            throw new Error(`שגיאה מפונקציית השרת: ${error.message}`);
        }

        toast({ title: "✅ המדריך הוסר והתראה נשלחה" });
        
        // שלב 3: ניקוי ורענון הממשק
        fetchInstructors();
        setShowDeleteConfirm(false);
        setSelectedInstructor(null);
        setInstructorAssignments([]);
        setReassignToInstructor('');

    } catch (error: any) {
        toast({
            title: "❌ שגיאה בתהליך המחיקה",
            description: error.message || "אירעה שגיאה לא צפויה.",
            variant: "destructive",
        });
    } finally {
        setLoading(false);
    }
};

const fetchBlockedDates = async () => {
  try {
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('*');
    
    if (data) {
      // סדר בצד הלקוח - תאריכי range לפני תאריכים בודדים
      const sortedData = data.sort((a, b) => {
        const dateA = a.start_date || a.date;
        const dateB = b.start_date || b.date;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      
      setBlockedDates(sortedData);
    }
  } catch (error) {
    console.error('Error fetching blocked dates:', error);
  }
};

const addBlockedDate = async () => {
  const { type, date, start_date, end_date, reason } = newBlockedDate;
  
  console.log("newBlockedDate:", newBlockedDate); // הוסף את זה
  
  if (type === 'single' && !date) {
    toast({ title: "אנא בחר תאריך", variant: "destructive" });
    return;
  }
  
  if (type === 'range' && (!start_date || !end_date)) {
    toast({ title: "אנא בחר תאריך התחלה וסיום", variant: "destructive" });
    return;
  }
  
  if (type === 'range' && new Date(start_date) > new Date(end_date)) {
    toast({ title: "תאריך ההתחלה חייב להיות לפני תאריך הסיום", variant: "destructive" });
    return;
  }
  
  setLoading(true);
  try {
    const insertData = type === 'single' 
      ? { date, reason, created_by: user?.id }
      : { start_date, end_date, reason, created_by: user?.id };
      
    console.log("insertData:", insertData); // הוסף את זה
      
    const { data, error } = await supabase  // הוסף data כדי לראות מה חוזר
      .from('blocked_dates')
      .insert(insertData)
      .select(); // הוסף select כדי לקבל את הנתונים שנוספו
    
    console.log("supabase response:", { data, error }); // הוסף את זה
    
    if (error) {
      console.error("Supabase error:", error); // הוסף את זה
      throw error;
    }
    
    if (!error) {
      await fetchBlockedDates(); // הוסף await כדי לוודא שהפונקציה מסתיימת
      setNewBlockedDate({ type: 'single', date: '', start_date: '', end_date: '', reason: '' });
      setShowBlockedDateModal(false);
      toast({ 
        title: "✅ תאריך/ים נוסף/ו לרשימה החסומה",
        description: type === 'range' 
          ? `טווח תאריכים: ${formatDate(start_date)} עד ${formatDate(end_date)}`
          : `תאריך יחיד: ${formatDate(date)}`
      });
    }
  } catch (error: any) {
    console.error("Catch error:", error); // הוסף את זה
    toast({
      title: "❌ שגיאה בהוספת תאריך חסום",
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};



  // Delete blocked date
  const deleteBlockedDate = async (id: string) => {
    if (!confirm('האם להסיר תאריך זה מהרשימה החסומה?')) return;
    
    try {
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('id', id);
      
      if (!error) {
        fetchBlockedDates();
        toast({ title: "✅ התאריך הוסר מהרשימה החסומה" });
      }
    } catch (error) {
      toast({
        title: "❌ שגיאה בהסרת התאריך",
        variant: "destructive"
      });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit', year: 'numeric'});
  };

  const formatBlockedDate = (blockedDate: BlockedDate) => {
  if (blockedDate.date) {
    // Single date (legacy format)
    return formatDate(blockedDate.date);
  } else if (blockedDate.start_date && blockedDate.end_date) {
    // Date range
    const startFormatted = formatDate(blockedDate.start_date);
    const endFormatted = formatDate(blockedDate.end_date);
    
    if (blockedDate.start_date === blockedDate.end_date) {
      return startFormatted; // Same day range
    }
    return `${startFormatted} - ${endFormatted}`;
  }
  return 'N/A';
};

useEffect(() => {
  if (hasAccess) {
    fetchDefaults();
    fetchInstitutions();
    fetchInstructors();
    fetchBlockedDates();
    if (isAdmin) {
      fetchSystemUsers(); // ⬅️ הוסף את זה!
    }
  }
}, [hasAccess, isAdmin]);



// Fetch system users
const fetchSystemUsers = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'pedagogical_manager'])
      .order('full_name');
    
    if (data) setSystemUsers(data);
  } catch (error) {
    console.error('Error fetching system users:', error);
  } finally {
    setLoading(false);
  }
};

// Open system user modal
const openSystemUserModal = (systemUser?: SystemUser) => {
  if (systemUser) {
    setEditingSystemUser(systemUser);
    setSystemUserForm({
      full_name: systemUser.full_name,
      email: systemUser.email,
      phone: systemUser.phone,
      role: systemUser.role
    });
  } else {
    setEditingSystemUser(null);
    setSystemUserForm({
      full_name: '',
      email: '',
      phone: '',
      role: 'pedagogical_manager'
    });
    setSystemUserPassword('');
  }
  setShowSystemUserModal(true);
};

// Save system user
const saveSystemUser = async () => {
  if (!systemUserForm.full_name || !systemUserForm.email) {
    toast({ 
      title: "שדות חובה חסרים", 
      description: "אנא מלא שם מלא ואימייל.", 
      variant: "destructive" 
    });
    return;
  }

  if (!editingSystemUser && !systemUserPassword) {
    toast({ 
      title: "סיסמה חסרה", 
      description: "נא להזין סיסמה למשתמש חדש.", 
      variant: "destructive" 
    });
    return;
  }

  if (!editingSystemUser && systemUserPassword.length < 6) {
    toast({ 
      title: "סיסמה חלשה", 
      description: "הסיסמה חייבת להכיל לפחות 6 תווים.", 
      variant: "destructive" 
    });
    return;
  }

  setLoading(true);
  try {
    if (editingSystemUser) {
      // Update existing system user
      const emailChanged = systemUserForm.email !== editingSystemUser.email;
      const nameChanged = systemUserForm.full_name !== editingSystemUser.full_name;
      const roleChanged = systemUserForm.role !== editingSystemUser.role;

      // Update auth.users if email or metadata changed
      if (emailChanged || nameChanged || roleChanged) {
        const newMetadata = {
          full_name: systemUserForm.full_name,
          name: systemUserForm.full_name,
          role: systemUserForm.role,
          phone: systemUserForm.phone || ''
        };

        const { data, error: authError } = await supabase.rpc('update_user_auth_data', {
          target_user_id: editingSystemUser.id,
          new_email: emailChanged ? systemUserForm.email : null,
          new_metadata: (nameChanged || roleChanged) ? newMetadata : null
        });

        if (authError) {
          throw new Error(`שגיאה בעדכון נתוני האימות: ${authError.message}`);
        }
      }

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          full_name: systemUserForm.full_name,
          email: systemUserForm.email,
          phone: systemUserForm.phone,
          role: systemUserForm.role,
          updated_at: new Date().toISOString() 
        })
        .eq('id', editingSystemUser.id);

      if (profileError) throw profileError;

      toast({ title: "✅ משתמש המערכת עודכן בהצלחה" });
      
    } else {
      // Create new system user via Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: systemUserForm.email!,
        password: systemUserPassword,
        options: {
          data: {
            full_name: systemUserForm.full_name,
            name: systemUserForm.full_name,
            role: systemUserForm.role,
            phone: systemUserForm.phone || ''
          }
        }
      });

      if (signUpError) throw signUpError;

      toast({ 
        title: "✅ משתמש מערכת נוצר בהצלחה",
        description: "נשלח מייל אימות לכתובת המייל שהוזנה" 
      });
    }
    
    fetchSystemUsers();
    setShowSystemUserModal(false);
    setEditingSystemUser(null);
    setSystemUserForm({ full_name: '', email: '', phone: '', role: 'pedagogical_manager' });
    setSystemUserPassword('');
    
  } catch (error: any) {
    toast({
      title: "❌ שגיאה בשמירת משתמש המערכת",
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};


const handleDeleteSystemUser = async () => {
  if (!selectedSystemUser) return;

  setLoading(true);
  try {
    const { error } = await supabase.functions.invoke('delete-user', {
      body: {
        userId: selectedSystemUser.id,
        instructorName: selectedSystemUser.full_name,
        assignments: [],
        userType: 'system_user', // ⬅️ הוסף את זה!
        userRole: selectedSystemUser.role // ⬅️ וגם את זה (admin/pedagogical_manager)
      },
    });

    if (error) throw new Error(`שגיאה: ${error.message}`);

    toast({ title: "✅ משתמש המערכת הוסר בהצלחה" });
    fetchSystemUsers();
    setShowDeleteSystemUserConfirm(false);
    setSelectedSystemUser(null);

  } catch (error: any) {
    toast({
      title: "❌ שגיאה בהסרת משתמש המערכת",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};



const getRoleBadge = (role: string) => {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
        <Shield className="h-3 w-3" />
        מנהל מערכת
      </span>
    );
  } else if (role === 'pedagogical_manager') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
        <UserCog className="h-3 w-3" />
        מנהל פדגוגי
      </span>
    );
  }
  return null;
};












  // Check permissions
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <Card className="text-center py-16">
          <CardContent>
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">אין הרשאה</h3>
            <p className="text-gray-600">רק מנהלים ומנהלים פדגוגיים יכולים לגשת להגדרות מערכת</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="md:hidden">
        <MobileNavigation />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            הגדרות מערכת
          </h1>
          <p className="text-gray-600">ניהול הגדרות כלליות, מוסדות, מדריכים ותאריכים חסומים</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={isAdmin?"grid w-full grid-cols-2 md:grid-cols-5 mb-6":"grid w-full grid-cols-2 md:grid-cols-4 mb-6"}>
            <TabsTrigger value="defaults" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>ברירות מחדל</span>
            </TabsTrigger>
            <TabsTrigger value="institutions" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>מוסדות</span>
            </TabsTrigger>
            <TabsTrigger value="instructors" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>מדריכים</span>
            </TabsTrigger>
            <TabsTrigger value="blocked-dates" className="flex items-center gap-2">
              <CalendarX className="h-4 w-4" />
              <span>תאריכים חסומים</span>
            </TabsTrigger>
                      {isAdmin && (
            <TabsTrigger value="system-users" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>משתמשי מערכת</span>
            </TabsTrigger>
          )}
          </TabsList>

          {/* ברירות מחדל */}
          <TabsContent value="defaults">
            <Card>
              <CardHeader>
                <CardTitle>הגדרות ברירת מחדל למערכת</CardTitle>
                <CardDescription>
                  הגדרות אלו ישמשו כברירת מחדל בעת יצירת קורסים והקצאות חדשות
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="lesson-duration">משך שיעור סטנדרטי (דקות)</Label>
                    <Input
                      id="lesson-duration"
                      type="number"
                      min="15"
                      max="180"
                      value={defaults.default_lesson_duration}
                      onChange={(e) => setDefaults({
                        ...defaults,
                        default_lesson_duration: parseInt(e.target.value) || 45
                      })}
                    />
                    <p className="text-xs text-gray-500">זמן ברירת מחדל לשיעור</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="task-duration">משך משימה סטנדרטי (דקות)</Label>
                    <Input
                      id="task-duration"
                      type="number"
                      min="5"
                      max="60"
                      value={defaults.default_task_duration}
                      onChange={(e) => setDefaults({
                        ...defaults,
                        default_task_duration: parseInt(e.target.value) || 15
                      })}
                    />
                    <p className="text-xs text-gray-500">זמן ברירת מחדל למשימה</p>
                  </div>
                  
           
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    onClick={updateDefaults} 
                    disabled={savingDefaults}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {savingDefaults ? (
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 ml-2" />
                    )}
                    שמור שינויים
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* מוסדות חינוך */}
          <TabsContent value="institutions">
            <Card>
              <CardHeader>
                <div className="flex justify-between flex-row-reverse  items-center">
                  <div>
                    <CardTitle>ניהול מוסדות חינוך</CardTitle>
                    <CardDescription>רשימת כל המוסדות במערכת</CardDescription>
                  </div>
                  <Button onClick={() => openInstitutionModal()} className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 ml-2" />
                    הוסף מוסד
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : institutions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>אין מוסדות חינוך במערכת</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto ">
                    <Table className='rtl'>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">שם המוסד</TableHead>
                          <TableHead className="text-right" >עיר</TableHead>
                          <TableHead className="text-right">אנשי קשר </TableHead>
                          <TableHead className="text-right">טלפון</TableHead>
                          <TableHead  className="text-center">פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody >
                        {institutions.map((institution) => (
                          <TableRow key={institution.id}>
                            <TableCell className="font-medium">{institution.name}</TableCell>
                            <TableCell>{institution.city}</TableCell>
                            <TableCell>
                              {institution.contacts && institution.contacts.length > 0 ? (
                                <div className="space-y-1">
                                  {institution.contacts.map((contact, idx) => (
                                    <div key={idx} className="text-xs">
                                      <div className="font-medium">{contact.name}</div>
                                      {contact.role && (
                                        <div className="text-gray-500 text-[10px]">({contact.role})</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>

                            {/* טלפונים */}
                            <TableCell>
                              {institution.contacts && institution.contacts.length > 0 ? (
                                <div className="space-y-1">
                                  {institution.contacts.map((contact, idx) => (
                                    <div key={idx} className="text-xs">
                                      {contact.phone || '-'}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>

                            <TableCell>
                              <div className="flex justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openInstitutionModal(institution)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteInstitution(institution.id)}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* מדריכים */}           

<TabsContent value="instructors">
  <Card>
    <CardHeader>
      <CardTitle>ניהול מדריכים</CardTitle>
      <CardDescription>
        רשימת המדריכים במערכת. ניתן לערוך את פרטיהם או להסירם.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : instructors.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>אין מדריכים במערכת</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className='rtl'>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם המדריך</TableHead>
                <TableHead className="text-right px-[5rem]">אימייל</TableHead>
                <TableHead className="text-right px-[2rem]">טלפון</TableHead>
                <TableHead className="text-right ">תאריך הצטרפות</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructors.map((instructor) => (
                <TableRow key={instructor.id}>
                  <TableCell className="font-medium">{instructor.full_name}</TableCell>
                  <TableCell>{instructor.email || '-'}</TableCell>
                  <TableCell>{instructor.phone || '-'}</TableCell>
                  <TableCell className='pr-[2rem]'>{formatDate(instructor.created_at || '')}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      {/* --- NEW EDIT BUTTON --- */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditInstructorModal(instructor)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          setLoading(true);
                          await checkInstructorAssignments(instructor.id);
                          setSelectedInstructor(instructor);
                          setShowDeleteConfirm(true);
                          setLoading(false);
                        }}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>

{/* משתמשי מערכת - רק לאדמין */}
{isAdmin && (
  <TabsContent value="system-users">
    <Card>
      <CardHeader>
        <div className="flex justify-between flex-row-reverse items-center">
          <div>
            <CardTitle>ניהול משתמשי מערכת</CardTitle>
            <CardDescription>אדמינים ומנהלים פדגוגיים - ניתן ליצור רק על ידי מנהל מערכת</CardDescription>
          </div>
          <Button onClick={() => openSystemUserModal()} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 ml-2" />
            הוסף משתמש מערכת
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : systemUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>אין משתמשי מערכת</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className='rtl'>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם מלא</TableHead>
                  <TableHead className="text-right">אימייל</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="text-right">תפקיד</TableHead>
                  <TableHead className="text-right">תאריך הצטרפות</TableHead>
                  <TableHead className="text-center">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemUsers.map((systemUser) => (
                  <TableRow key={systemUser.id}>
                    <TableCell className="font-medium">{systemUser.full_name}</TableCell>
                    <TableCell>{systemUser.email || '-'}</TableCell>
                    <TableCell>{systemUser.phone || '-'}</TableCell>
                    <TableCell>{getRoleBadge(systemUser.role)}</TableCell>
                    <TableCell>{formatDate(systemUser.created_at || '')}</TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openSystemUserModal(systemUser)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedSystemUser(systemUser);
                            setShowDeleteSystemUserConfirm(true);
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  </TabsContent>
)}





          {/* תאריכים חסומים */}
          <TabsContent value="blocked-dates">
            <Card>
              <CardHeader>
                <div className="flex flex-row-reverse justify-between items-center">
                  <div>
                    <CardTitle>תאריכים חסומים במערכת</CardTitle>
                    <CardDescription>תאריכים שבהם לא ניתן לתזמן שיעורים (חגים, חופשות וכו')</CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowBlockedDateModal(true)}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <CalendarX className="h-4 w-4 ml-2" />
                    הוסף תאריך חסום
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {blockedDates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>אין תאריכים חסומים במערכת</p>
                  </div>
                ) 
         
: (
  <div className="grid gap-3">
    {blockedDates.map((blockedDate) => (
      <div 
        key={blockedDate.id}
        className="flex items-center flex-row-reverse justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
      >
        <div className="flex items-center gap-2">
         
          <div  className="flex items-center flex-row-reverse  "  >
            <span className="font-medium">-  {formatBlockedDate(blockedDate)}</span>
            {blockedDate.reason && (
              <span className="text-sm text-gray-600 mr-1">{blockedDate.reason}</span>
            )}
            {/* Show if it's a range */}
            {blockedDate.start_date && blockedDate.end_date && blockedDate.start_date !== blockedDate.end_date && (
              <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded mr-2">
                טווח תאריכים
              </span>
            )}
          </div>
           <CalendarX className="h-5 w-5 text-orange-600" />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => deleteBlockedDate(blockedDate.id)}
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    ))}
  </div>
)}
               
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* --- MODALS --- */}

        {/* Institution Modal */}
        <Dialog open={showInstitutionModal} onOpenChange={setShowInstitutionModal}>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
    <DialogHeader>
      <DialogTitle>
        {editingInstitution ? 'עריכת מוסד חינוכי' : 'הוספת מוסד חינוכי'}
      </DialogTitle>
    </DialogHeader>
    
    <div className="space-y-6 py-4">
      {/* פרטי מוסד בסיסיים */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">שם המוסד *</Label>
          <Input
            id="name"
            value={institutionForm.name}
            onChange={(e) => setInstitutionForm({ ...institutionForm, name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="city">עיר *</Label>
          <Input
            id="city"
            value={institutionForm.city}
            onChange={(e) => setInstitutionForm({ ...institutionForm, city: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="address">כתובת</Label>
        <Input
          id="address"
          value={institutionForm.address}
          onChange={(e) => setInstitutionForm({ ...institutionForm, address: e.target.value })}
        />
      </div>

      {/* אנשי קשר */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">אנשי קשר</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addContact}
            disabled={(institutionForm.contacts?.length || 0) >= 5}
          >
            <Plus className="h-4 w-4 ml-1" />
            הוסף איש קשר
          </Button>
        </div>

        <div className="space-y-3">
          {(institutionForm.contacts || []).map((contact, index) => (
            <Card key={index} className="p-4 bg-gray-50">
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium text-gray-700">
                    איש קשר {index + 1}
                  </Label>
                  {(institutionForm.contacts?.length || 0) > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeContact(index)}
                      className="text-red-500 hover:text-red-700 h-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`contact-name-${index}`} className="text-xs">
                      שם מלא *
                    </Label>
                    <Input
                      id={`contact-name-${index}`}
                      value={contact.name}
                      onChange={(e) => updateContact(index, 'name', e.target.value)}
                      placeholder="ישראל ישראלי"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`contact-role-${index}`} className="text-xs">
                      תפקיד
                    </Label>
                    <Input
                      id={`contact-role-${index}`}
                      value={contact.role}
                      onChange={(e) => updateContact(index, 'role', e.target.value)}
                      placeholder="מנהל / רכז / סגן"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`contact-phone-${index}`} className="text-xs">
                      טלפון
                    </Label>
                    <Input
                      id={`contact-phone-${index}`}
                      type="tel"
                      value={contact.phone}
                      onChange={(e) => updateContact(index, 'phone', e.target.value)}
                      placeholder="050-1234567"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`contact-email-${index}`} className="text-xs">
                      אימייל
                    </Label>
                    <Input
                      id={`contact-email-${index}`}
                      type="email"
                      value={contact.email}
                      onChange={(e) => updateContact(index, 'email', e.target.value)}
                      placeholder="example@school.co.il"
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {(institutionForm.contacts?.length || 0) < 5 && (
          <div className="text-xs text-gray-500 text-center bg-blue-50 p-2 rounded">
            💡 ניתן להוסיף עוד {5 - (institutionForm.contacts?.length || 0)} אנשי קשר
          </div>
        )}
      </div>

      {/* הערות */}
      <div>
        <Label htmlFor="notes">הערות</Label>
        <Textarea
          id="notes"
          value={institutionForm.notes}
          onChange={(e) => setInstitutionForm({ ...institutionForm, notes: e.target.value })}
          rows={3}
        />
      </div>
    </div>

    <DialogFooter>
      <Button variant="ghost" onClick={closeInstitutionModal}>ביטול</Button>
      <Button onClick={saveInstitution} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : 'שמור'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
        
        
       
        {/* Delete Instructor Confirmation Modal */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>האם אתה בטוח?</DialogTitle>
                    <DialogDescription>
                        אתה עומד למחוק את המדריך <strong>{selectedInstructor?.full_name}</strong>. פעולה זו היא סופית.
                    </DialogDescription>
                </DialogHeader>
                {instructorAssignments.length > 0 && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <p className="font-bold">שימו לב: למדריך זה משויכות {instructorAssignments.length} הקצאות פעילות.</p>
                            <p>יש לבחור מדריך חלופי להקצאות אלו, או שהן יישארו ללא מדריך משויך.</p>
                            <div className="my-4 space-y-2">
                                <Label>שייך מחדש למדריך:</Label>
                                <Select onValueChange={setReassignToInstructor} value={reassignToInstructor}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="בחר מדריך חלופי..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {instructors
                                            .filter(inst => inst.id !== selectedInstructor?.id)
                                            .map(inst => (
                                                <SelectItem key={inst.id} value={inst.id}>
                                                    {inst.full_name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>ביטול</Button>
                    <Button variant="destructive" onClick={handleDeleteInstructor} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : 'אני מבין, מחק את המדריך'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      
       



        {/* Updated Add Blocked Date Modal */}
<Dialog open={showBlockedDateModal} onOpenChange={setShowBlockedDateModal}>
  <DialogContent dir="rtl">
    <DialogHeader>
      <DialogTitle>הוספת תאריך/ים חסום/ים</DialogTitle>
      <DialogDescription>
        בחר תאריך בודד או טווח תאריכים שבהם לא ניתן יהיה לתזמן שיעורים.
      </DialogDescription>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      {/* Type selector */}
      <div className="space-y-3">
        <Label>סוג החסימה</Label>
        <div className="flex gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="single"
              name="dateType"
              value="single"
              checked={newBlockedDate.type === 'single'}
              onChange={(e) => setNewBlockedDate({
                ...newBlockedDate, 
                type: e.target.value as 'single' | 'range',
                date: '', start_date: '', end_date: '' // Reset dates when changing type
              })}
            />
            <Label htmlFor="single">תאריך בודד</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="range"
              name="dateType"
              value="range"
              checked={newBlockedDate.type === 'range'}
              onChange={(e) => setNewBlockedDate({
                ...newBlockedDate, 
                type: e.target.value as 'single' | 'range',
                date: '', start_date: '', end_date: '' // Reset dates when changing type
              })}
            />
            <Label htmlFor="range">טווח תאריכים</Label>
          </div>
        </div>
      </div>

      {/* Date inputs based on selected type */}
      {newBlockedDate.type === 'single' ? (
        <div>
          <Label htmlFor="blocked-date">תאריך</Label>
          <Input 
            id="blocked-date"
            type="date"
            value={newBlockedDate.date}
            onChange={(e) => setNewBlockedDate({...newBlockedDate, date: e.target.value})}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start-date">תאריך התחלה</Label>
            <Input 
              id="start-date"
              type="date"
              value={newBlockedDate.start_date}
              onChange={(e) => setNewBlockedDate({...newBlockedDate, start_date: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="end-date">תאריך סיום</Label>
            <Input 
              id="end-date"
              type="date"
              value={newBlockedDate.end_date}
              min={newBlockedDate.start_date} // Prevent end date before start date
              onChange={(e) => setNewBlockedDate({...newBlockedDate, end_date: e.target.value})}
            />
          </div>
        </div>
      )}

      {/* Reason field */}
      <div>
        <Label htmlFor="reason">סיבה (חג, חופשה וכו')</Label>
        <Input 
          id="reason"
          type="text"
          value={newBlockedDate.reason}
          placeholder={newBlockedDate.type === 'single' 
            ? "לדוגמה: יום כיפור" 
            : "לדוגמה: חופש פסח"
          }
          onChange={(e) => setNewBlockedDate({...newBlockedDate, reason: e.target.value})}
        />
      </div>
    </div>
    <DialogFooter>
      <Button 
        variant="ghost" 
        onClick={() => {
          setShowBlockedDateModal(false);
          setNewBlockedDate({ type: 'single', date: '', start_date: '', end_date: '', reason: '' });
        }}
      >
        ביטול
      </Button>
      <Button onClick={addBlockedDate} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : 
          `הוסף ${newBlockedDate.type === 'single' ? 'תאריך' : 'טווח תאריכים'}`
        }
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* Updated display of blocked dates in the main content */}

{/* --- Instructor Edit Modal --- */}
<Dialog open={showEditInstructorModal} onOpenChange={setShowEditInstructorModal}>
  <DialogContent className="max-w-3xl" dir="rtl">
    <DialogHeader>
      <DialogTitle>עריכת פרופיל מדריך: {selectedInstructor?.full_name}</DialogTitle>
      <DialogDescription>
        עדכן את פרטי הפרופיל של המדריך. שינויים יישמרו מיידית.
      </DialogDescription>
    </DialogHeader>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
      {/* Column 1 */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="full_name">שם מלא</Label>
          <Input id="full_name" value={instructorForm.full_name || ''} onChange={handleInstructorFormChange} />
        </div>
        <div>
          <Label htmlFor="email">אימייל </Label>
          <Input id="email" value={instructorForm.email || ''} onChange={handleInstructorFormChange}  />
        </div>
        <div>
          <Label htmlFor="phone">טלפון</Label>
          <Input id="phone" value={instructorForm.phone || ''} onChange={handleInstructorFormChange} />
        </div>
        <div>
          <Label htmlFor="birthdate">תאריך לידה</Label>
          <Input id="birthdate" type="date" value={instructorForm.birthdate ? instructorForm.birthdate.split('T')[0] : ''} onChange={handleInstructorFormChange} />
        </div>
         <div>
          <Label htmlFor="img">קישור לתמונה</Label>
          <Input id="img" value={instructorForm.img || ''} onChange={handleInstructorFormChange} />
        </div>
      </div>
      {/* Column 2 */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="hourly_rate">תעריף שעתי</Label>
          <Input id="hourly_rate" type="number" placeholder="לדוגמה: 150.50" value={instructorForm.hourly_rate || ''} onChange={handleInstructorFormChange} />
        </div>
        <div>
          <Label htmlFor="current_work_hours">שעות עבודה נוכחיות</Label>
          <Input id="current_work_hours" type="number" value={instructorForm.current_work_hours || ''} onChange={handleInstructorFormChange} />
        </div>
        <div>
          <Label htmlFor="benefits">הטבות</Label>
          <Textarea id="benefits" placeholder="פרט הטבות..." value={instructorForm.benefits || ''} onChange={handleInstructorFormChange} />
        </div>
      </div>
    </div>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setShowEditInstructorModal(false)}>ביטול</Button>
      <Button onClick={handleUpdateInstructor} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : 'שמור שינויים'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
{/* System User Modal */}
<Dialog open={showSystemUserModal} onOpenChange={setShowSystemUserModal}>
  <DialogContent dir="rtl">
    <DialogHeader>
      <DialogTitle>
        {editingSystemUser ? 'עריכת משתמש מערכת' : 'הוספת משתמש מערכת'}
      </DialogTitle>
      <DialogDescription>
        {editingSystemUser 
          ? 'עדכן את פרטי משתמש המערכת' 
          : 'צור משתמש מערכת חדש (Admin או מנהל פדגוגי)'}
      </DialogDescription>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      <div>
        <Label htmlFor="system-full-name">שם מלא *</Label>
        <Input
          id="system-full-name"
          value={systemUserForm.full_name}
          onChange={(e) => setSystemUserForm({ ...systemUserForm, full_name: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="system-email">אימייל *</Label>
        <Input
          id="system-email"
          type="email"
          value={systemUserForm.email}
          onChange={(e) => setSystemUserForm({ ...systemUserForm, email: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="system-phone">טלפון</Label>
        <Input
          id="system-phone"
          value={systemUserForm.phone}
          onChange={(e) => setSystemUserForm({ ...systemUserForm, phone: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="system-role">תפקיד *</Label>
        <Select 
          value={systemUserForm.role} 
          onValueChange={(value) => setSystemUserForm({ ...systemUserForm, role: value as 'admin' | 'pedagogical_manager' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="בחר תפקיד" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pedagogical_manager">מנהל פדגוגי</SelectItem>
            <SelectItem value="admin">מנהל מערכת</SelectItem>
          </SelectContent>
        </Select>
                  <p className="text-xs  font-bold text-gray-500 mt-1">בעת עדכון תפקיד המשתמש חייב להתחבר מחדש למערכת כדי שהרשאותיו יתעדכנו</p>

      </div>
      {!editingSystemUser && (
        <div>
          <Label htmlFor="system-password">סיסמה </Label>
          <Input
            id="system-password"
            type="password"
            placeholder="לפחות 6 תווים"
            value={systemUserPassword}
            onChange={(e) => setSystemUserPassword(e.target.value)}
          />
          
        </div>
      )}
    </div>
    <DialogFooter>
      <Button 
        variant="ghost" 
        onClick={() => {
          setShowSystemUserModal(false);
          setEditingSystemUser(null);
          setSystemUserForm({ full_name: '', email: '', phone: '', role: 'pedagogical_manager' });
          setSystemUserPassword('');
        }}
      >
        ביטול
      </Button>
      <Button onClick={saveSystemUser} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : 'שמור'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* Delete System User Confirmation */}
<Dialog open={showDeleteSystemUserConfirm} onOpenChange={setShowDeleteSystemUserConfirm}>
  <DialogContent dir="rtl">
    <DialogHeader>
      <DialogTitle>האם אתה בטוח?</DialogTitle>
      <DialogDescription>
        אתה עומד למחוק את משתמש המערכת <strong>{selectedSystemUser?.full_name}</strong>. 
        פעולה זו היא סופית ולא ניתנת לביטול.
      </DialogDescription>
    </DialogHeader>
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <strong>אזהרה:</strong> מחיקת משתמש מערכת תמחק את כל ההרשאות וההיסטוריה שלו במערכת.
      </AlertDescription>
    </Alert>
    <DialogFooter>
      <Button 
        variant="outline" 
        onClick={() => {
          setShowDeleteSystemUserConfirm(false);
          setSelectedSystemUser(null);
        }}
      >
        ביטול
      </Button>
      <Button 
        variant="destructive" 
        onClick={handleDeleteSystemUser} 
        disabled={loading}
      >
        {loading ? <Loader2 className="animate-spin" /> : 'אני מבין, מחק את המשתמש'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      </div>
    </div>
  );
};

export default AdminSettings;