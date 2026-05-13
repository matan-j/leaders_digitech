import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, Save, ExternalLink } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {
  DEFAULT_COMPANY_INFO,
  loadCompanyInfo,
  saveCompanyInfo,
  type CompanyInfo,
} from '@/lib/quotes/company-info';

const BUCKET = 'branding';

const CompanyInfoSettings: React.FC = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const next = await loadCompanyInfo();
      setInfo(next);
      setLoading(false);
    })();
  }, []);

  const update = (key: keyof CompanyInfo, value: string) =>
    setInfo((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCompanyInfo(info);
      toast({ title: 'הפרטים נשמרו', description: 'יופיעו בהצעות מחיר חדשות וקיימות.' });
    } catch (e: any) {
      toast({ title: 'שגיאה בשמירה', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'הקובץ גדול מדי', description: 'מקסימום 2MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      // unique filename so cached PDFs don't serve stale image
      const filename = `logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file, { upsert: false, cacheControl: '3600' });

      if (upErr) {
        toast({ title: 'שגיאה בהעלאה', description: upErr.message, variant: 'destructive' });
        return;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
      const newInfo = { ...info, logoUrl: pub.publicUrl };
      setInfo(newInfo);

      // persist immediately so the PDF picks it up even without pressing Save
      await saveCompanyInfo(newInfo);
      toast({ title: 'הלוגו עודכן' });
    } catch (e: any) {
      toast({ title: 'שגיאה', description: e?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetLogo = async () => {
    if (!window.confirm('להחזיר ללוגו ברירת המחדל?')) return;
    const newInfo = { ...info, logoUrl: DEFAULT_COMPANY_INFO.logoUrl };
    setInfo(newInfo);
    await saveCompanyInfo(newInfo);
    toast({ title: 'הלוגו אופס לברירת המחדל' });
  };

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center text-gray-500">
        <Loader2 className="ms-2 h-4 w-4 animate-spin" /> טוען...
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">לוגו</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-6 items-center">
          <div className="border rounded-lg p-4 bg-gray-50 w-48 h-32 flex items-center justify-center">
            {info.logoUrl ? (
              <img
                src={info.logoUrl}
                alt="לוגו"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="text-gray-400 text-sm">אין לוגו</span>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <p className="text-sm text-gray-600">
              לוגו יופיע בראש כל הצעת מחיר שתופק כ־PDF. מומלץ PNG/SVG על רקע שקוף או לבן. מקסימום 2MB.
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Upload className="ms-2 h-4 w-4" />}
                {uploading ? 'מעלה...' : 'העלה לוגו'}
              </Button>
              <Button type="button" variant="outline" onClick={handleResetLogo} disabled={uploading}>
                איפוס לברירת מחדל
              </Button>
              {info.logoUrl && (
                <a
                  href={info.logoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 ms-1 self-center"
                >
                  פתיחה בכרטיסייה חדשה <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">פרטי חברה להופעה ב־PDF</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">שם החברה / עסק *</Label>
            <Input value={info.legalName} onChange={(e) => update('legalName', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">ח.פ. / ע.מ. *</Label>
            <Input value={info.taxId} dir="ltr" onChange={(e) => update('taxId', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">כתובת</Label>
            <Input value={info.address} onChange={(e) => update('address', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">טלפון</Label>
            <Input value={info.phone} dir="ltr" onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">דוא״ל</Label>
            <Input value={info.email} dir="ltr" onChange={(e) => update('email', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">אתר אינטרנט</Label>
            <Input value={info.website} dir="ltr" placeholder="https://..." onChange={(e) => update('website', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">טאג־ליין (אופציונלי)</Label>
            <Input value={info.tagline} onChange={(e) => update('tagline', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Save className="ms-2 h-4 w-4" />}
          שמור שינויים
        </Button>
      </div>
    </div>
  );
};

export default CompanyInfoSettings;
