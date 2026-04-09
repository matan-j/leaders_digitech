import React, { useState, useEffect } from 'react';
import { validateInstitution, filterValidContacts } from '@/utils/institutionValidation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, X, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface Contact {
  name: string;
  phone: string;
  email: string;
  role: string;
}

interface Institution {
  id?: string;
  name: string;
  city: string;
  address?: string;
  notes?: string;
  contacts?: Contact[];
}

interface AddInstitutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingInstitution?: Institution | null;
  onSaved?: (institution: { id: string; name: string }) => void;
}

const emptyForm = (): Partial<Institution> => ({
  name: '', city: '', address: '', notes: '',
  contacts: [{ name: '', phone: '', email: '', role: '' }],
});

const AddInstitutionModal: React.FC<AddInstitutionModalProps> = ({
  open, onOpenChange, editingInstitution, onSaved,
}) => {
  const [form, setForm] = useState<Partial<Institution>>(emptyForm());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingInstitution) {
        setForm({
          ...editingInstitution,
          contacts: editingInstitution.contacts?.length
            ? editingInstitution.contacts
            : [{ name: '', phone: '', email: '', role: '' }],
        });
      } else {
        setForm(emptyForm());
      }
    }
  }, [open, editingInstitution]);

  const addContact = () => {
    if ((form.contacts?.length || 0) >= 5) {
      toast({ title: "הגעת למקסימום", description: "ניתן להוסיף עד 5 אנשי קשר בלבד", variant: "destructive" });
      return;
    }
    setForm(prev => ({ ...prev, contacts: [...(prev.contacts || []), { name: '', phone: '', email: '', role: '' }] }));
  };

  const removeContact = (index: number) => {
    if ((form.contacts?.length || 0) <= 1) {
      toast({ title: "לא ניתן להסיר", description: "חייב להיות לפחות איש קשר אחד", variant: "destructive" });
      return;
    }
    setForm(prev => ({ ...prev, contacts: (prev.contacts || []).filter((_, i) => i !== index) }));
  };

  const updateContact = (index: number, field: keyof Contact, value: string) => {
    setForm(prev => ({
      ...prev,
      contacts: (prev.contacts || []).map((c, i) => i === index ? { ...c, [field]: value } : c),
    }));
  };

  const handleSave = async () => {
    const validation = validateInstitution(form.name ?? '', form.city ?? '', form.contacts ?? []);
    if (!validation.valid) {
      toast({ title: "שגיאה", description: validation.error, variant: "destructive" });
      return;
    }
    const validContacts = filterValidContacts(form.contacts ?? []);
    setLoading(true);
    try {
      const dataToSave = {
        name: form.name,
        city: form.city,
        address: form.address || null,
        notes: form.notes || null,
        contacts: validContacts,
      };
      if (editingInstitution?.id) {
        const { error } = await supabase
          .from('educational_institutions')
          .update(dataToSave)
          .eq('id', editingInstitution.id);
        if (error) throw error;
        toast({ title: "הצלחה", description: "המוסד עודכן בהצלחה" });
        onSaved?.({ id: editingInstitution.id, name: form.name! });
      } else {
        const { data, error } = await supabase
          .from('educational_institutions')
          .insert([dataToSave])
          .select('id, name')
          .single();
        if (error) throw error;
        toast({ title: "הצלחה", description: "המוסד נוסף בהצלחה" });
        onSaved?.(data);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving institution:', error);
      toast({ title: "שגיאה", description: "אירעה שגיאה בשמירת המוסד", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editingInstitution ? 'עריכת מוסד חינוכי' : 'הוספת מוסד חינוכי'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="inst-name">שם המוסד *</Label>
              <Input id="inst-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="inst-city">עיר *</Label>
              <Input id="inst-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="inst-address">כתובת</Label>
            <Input id="inst-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">אנשי קשר</Label>
              <Button type="button" variant="outline" size="sm" onClick={addContact} disabled={(form.contacts?.length || 0) >= 5}>
                <Plus className="h-4 w-4 ml-1" />הוסף איש קשר
              </Button>
            </div>
            <div className="space-y-3">
              {(form.contacts || []).map((contact, index) => (
                <Card key={index} className="p-4 bg-gray-50">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium text-gray-700">איש קשר {index + 1}</Label>
                      {(form.contacts?.length || 0) > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(index)} className="text-red-500 hover:text-red-700 h-8">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`contact-name-${index}`} className="text-xs">שם מלא *</Label>
                        <Input id={`contact-name-${index}`} value={contact.name} onChange={(e) => updateContact(index, 'name', e.target.value)} placeholder="ישראל ישראלי" />
                      </div>
                      <div>
                        <Label htmlFor={`contact-role-${index}`} className="text-xs">תפקיד</Label>
                        <Input id={`contact-role-${index}`} value={contact.role} onChange={(e) => updateContact(index, 'role', e.target.value)} placeholder="מנהל / רכז / סגן" />
                      </div>
                      <div>
                        <Label htmlFor={`contact-phone-${index}`} className="text-xs">טלפון</Label>
                        <Input id={`contact-phone-${index}`} type="tel" value={contact.phone} onChange={(e) => updateContact(index, 'phone', e.target.value)} placeholder="050-1234567" />
                      </div>
                      <div>
                        <Label htmlFor={`contact-email-${index}`} className="text-xs">אימייל</Label>
                        <Input id={`contact-email-${index}`} type="email" value={contact.email} onChange={(e) => updateContact(index, 'email', e.target.value)} placeholder="example@school.co.il" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {(form.contacts?.length || 0) < 5 && (
              <div className="text-xs text-gray-500 text-center bg-blue-50 p-2 rounded">
                💡 ניתן להוסיף עוד {5 - (form.contacts?.length || 0)} אנשי קשר
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="inst-notes">הערות</Label>
            <Textarea id="inst-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'שמור'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddInstitutionModal;
