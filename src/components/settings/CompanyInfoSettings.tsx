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
  const displayFileInputRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDisplay, setUploadingDisplay] = useState(false);

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

  const uploadLogoToField = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'displayLogoUrl',
    inputRef: React.RefObject<HTMLInputElement>,
    setBusy: (b: boolean) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'הקובץ גדול מדי', description: 'מקסימום 2MB.', variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      // unique filename so cached PDFs / browser caches don't serve stale image
      const prefix = field === 'displayLogoUrl' ? 'display-logo' : 'logo';
      const filename = `${prefix}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file, { upsert: false, cacheControl: '3600' });

      if (upErr) {
        toast({ title: 'שגיאה בהעלאה', description: upErr.message, variant: 'destructive' });
        return;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filename);
      const newInfo = { ...info, [field]: pub.publicUrl };
      setInfo(newInfo);

      await saveCompanyInfo(newInfo);
      toast({ title: 'הלוגו עודכן' });
    } catch (e: any) {
      toast({ title: 'שגיאה', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) =>
    uploadLogoToField(e, 'logoUrl', fileInputRef, setUploading);

  const handleDisplayLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) =>
    uploadLogoToField(e, 'displayLogoUrl', displayFileInputRef, setUploadingDisplay);

  const handleResetLogo = async () => {
    if (!window.confirm('להחזיר ללוגו ברירת המחדל?')) return;
    const newInfo = { ...info, logoUrl: DEFAULT_COMPANY_INFO.logoUrl };
    setInfo(newInfo);
    await saveCompanyInfo(newInfo);
    toast({ title: 'הלוגו אופס לברירת המחדל' });
  };

  const handleResetDisplayLogo = async () => {
    if (!window.confirm('להחזיר את לוגו התצוגה לברירת המחדל?')) return;
    const newInfo = { ...info, displayLogoUrl: DEFAULT_COMPANY_INFO.displayLogoUrl };
    setInfo(newInfo);
    await saveCompanyInfo(newInfo);
    toast({ title: 'לוגו התצוגה אופס לברירת המחדל' });
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
      {/* In-system display logo — shown in the app header, not on documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">לוגו להצגה במערכת</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            לוגו זה יופיע בראש המערכת (בסרגל העליון). הוא נפרד מהלוגו של המסמכים — כך שאפשר להציג כאן וריאציה ייעודית לתצוגה דיגיטלית.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-6 items-center">
          <div className="border rounded-lg p-4 bg-brand-gradient w-48 h-32 flex items-center justify-center">
            {info.displayLogoUrl ? (
              <img
                src={info.displayLogoUrl}
                alt="לוגו תצוגה"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="text-white/80 text-sm">אין לוגו</span>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted-foreground">
              מומלץ PNG/SVG על רקע שקוף, ממדים אופטימליים סביב 256×96 פיקסל. הלוגו ימתח לפי הגובה ויישמר ב־aspect ratio. מקסימום 2MB.
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                ref={displayFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleDisplayLogoUpload}
              />
              <Button
                type="button"
                variant="brand"
                onClick={() => displayFileInputRef.current?.click()}
                disabled={uploadingDisplay}
              >
                {uploadingDisplay ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Upload className="ms-2 h-4 w-4" />}
                {uploadingDisplay ? 'מעלה...' : 'העלה לוגו תצוגה'}
              </Button>
              <Button type="button" variant="outline" onClick={handleResetDisplayLogo} disabled={uploadingDisplay}>
                איפוס לברירת מחדל
              </Button>
              {info.displayLogoUrl && (
                <a
                  href={info.displayLogoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 ms-1 self-center"
                >
                  פתיחה בכרטיסייה חדשה <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document logo — appears on quote PDFs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">לוגו למסמכים (הצעות מחיר / PDF)</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            לוגו זה משמש בראש כל הצעת מחיר שתופק כ־PDF. נפרד מלוגו התצוגה במערכת כדי שתוכל להחזיק וריאציות שונות.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-6 items-center">
          <div className="border rounded-lg p-4 bg-muted w-48 h-32 flex items-center justify-center">
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
              <span className="text-muted-foreground text-sm">אין לוגו</span>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted-foreground">
              מומלץ PNG/SVG על רקע שקוף או לבן. מקסימום 2MB.
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
                {uploading ? 'מעלה...' : 'העלה לוגו מסמך'}
              </Button>
              <Button type="button" variant="outline" onClick={handleResetLogo} disabled={uploading}>
                איפוס לברירת מחדל
              </Button>
              {info.logoUrl && (
                <a
                  href={info.logoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 ms-1 self-center"
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
