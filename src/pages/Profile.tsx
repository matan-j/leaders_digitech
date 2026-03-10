import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Save, X } from "lucide-react";
import MobileNavigation from "@/components/layout/MobileNavigation";

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  birthdate: string | null;
  hourly_rate: number | null;
  current_work_hours: number | null;
  benefits: string | null;
  img: string | null;
}

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    img: "",
    email: "",
    phone: "",
    birthdate: "",
  });
  const [reports, setReports] = useState<any[]>([]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `uploads/${fileName}`; // תיקייה ב־Storage

    const { data, error } = await supabase.storage
      .from("eduapp") // החלף בשם הבאקט שלך
      .upload(filePath, file);

    if (error) {
      console.error("Upload failed:", error.message);
      return;
    }

    // הפוך את הנתיב ל-URL פומבי
    const { data: urlData } = supabase.storage
      .from("eduapp")
      .getPublicUrl(filePath);

    console.log("URL", urlData.publicUrl);
    setEditForm((prev) => ({
      ...prev,
      img: urlData.publicUrl,
    }));
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        toast({
          title: "שגיאה",
          description: "לא ניתן לטעון את הפרופיל",
          variant: "destructive",
        });
        return;
      }
      console.log("datatata ", data);
      setProfile(data);
      setEditForm({
        full_name: data?.full_name || "",  
        img: data.img || "",
        email: data.email || "",
        phone: data.phone || "",
        birthdate: data.birthdate || "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => setEditing(true);

  const handleCancel = () => {
    setEditing(false);
    setEditForm({
      full_name: profile?.full_name || "", // ← הוסף שורה זו
      img: profile?.img || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      birthdate: profile?.birthdate || "",
    });
  };

 
const handleSave = async () => {
  if (!user || !profile) return;

  setSaving(true);
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name || null, // Use editForm, not profile
        img: editForm.img || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        birthdate: editForm.birthdate || null,
      })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את הפרופיל",
        variant: "destructive",
      });
      return;
    }

    // Update local state with all the fields that were updated in DB
    setProfile({
      ...profile,
      full_name: editForm.full_name || null, // Add this
      img: editForm.img || null,
      email: editForm.email || null,
      phone: editForm.phone || null,
      birthdate: editForm.birthdate || null, // Add this
    });

    setEditing(false);
    toast({
      title: "הפרופיל עודכן בהצלחה",
      description: "השינויים נשמרו במערכת",
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    toast({
      title: "שגיאה",
      description: "אירעה שגיאה בעדכון הפרופיל",
      variant: "destructive",
    });
  } finally {
    setSaving(false);
  }
};
  console.log("profiles", profile);
  useEffect(() => {
    if (authLoading || !user) return;

    const fetchReports = async () => {
      const { data, error } = await supabase
        .from("lesson_reports")
        .select("id,instructor_id")
        .eq("instructor_id", user.id); // user.id מתוך useAuth

      if (error) {
        console.error("Error fetching lesson reports:", error.message);
      } else {
        setReports(data || []);
      }

      setLoading(false);
    };

    fetchReports();
  }, [user, authLoading]);

  console.log("REPOR   ", reports);
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p>לא נמצא פרופיל</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <MobileNavigation />
      </div>
      <div className="container mx-auto px-4 py-8 max-w-2xl md:mb-0 mb-12">
        <Card className="shadow-md border border-muted">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl font-bold">פרופיל אישי</CardTitle>

            {!editing && (
              <Button onClick={handleEdit} variant="outline" size="sm">
                <Edit className="h-4 w-4 ml-2" />
                עריכה
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1  gap-6">
             
                          {editForm.img && (
                <div className="relative w-40 h-40 group">
                  <img
                    src={editForm.img}
                    alt="picture"
                    className="w-40 h-40 rounded-full object-cover"
                  />
              {editing && (
                <>
                  <button
                    onClick={() => document.getElementById("fileInput")?.click()}
                    className="absolute inset-0 bg-black bg-opacity-50 text-white text-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    החלף תמונה
                  </button>
                  <input
                    id="fileInput"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </>
              )}
            </div>
          )}

              <div>
                {!editForm.img && (
                  <Label className="pb-3 block">העלה תמונה</Label>
                )}{" "}
                {editing
                  ? !editForm.img && (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                    )
                  : !editForm.img && (
                      <input
                        disabled
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                    )}
              </div>
              <div>
                <Label htmlFor="name">שם מלא</Label>
                <Input
                  id="name"
                  value={!editing?profile.full_name:editForm.full_name}
                  disabled={!editing}
                  className={!editing?"bg-muted cursor-not-allowed":""}
                     onChange={(e) =>
                      setEditForm({ ...editForm, full_name: e.target.value })
                    }
                />
              </div>
              
              <div>
                <Label htmlFor="email">אימייל</Label>
                {editing ? (
                  <Input
                    id="email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                  />
                ) : (
                  <Input
                    id="email"
                    value={profile.email || "לא הוזן"}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="phone">טלפון</Label>
                {editing ? (
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                  />
                ) : (
                  <Input
                    id="phone"
                    value={profile.phone || "לא הוזן"}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="birthdate">תאריך לידה</Label>
                {editing ? (
                  <Input
                    id="birthdate"
                    type="date"
                    value={editForm.birthdate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, birthdate: e.target.value })
                    }
                  />
                ) : (
                <Input
                  id="birthdate"
                  value={
                    profile.birthdate
                      ? new Date(profile.birthdate).toLocaleDateString("he-IL")
                      : "לא הוזן"
                  }
                  disabled
                  className="bg-muted cursor-not-allowed"
                />)}
              </div>

        

              <div>
                <Label htmlFor="work_hours">שעות עבודה נוכחיות</Label>
                <Input
                  id="work_hours"
                  value={reports?.length || 0}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="benefits">תגמולים</Label>
                <Input
                  id="benefits"
                  value={profile.benefits || "לא הוזן"}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>
            </div>
            {editing && (
              <div className="flex justify-end gap-2 flex-row-reverse mt-6">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  disabled={saving}
                >
                  <X className="h-4 w-4 ml-2" />
                  ביטול
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Save className="h-4 w-4 ml-2" />
                  )}
                  שמירה
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Profile;
