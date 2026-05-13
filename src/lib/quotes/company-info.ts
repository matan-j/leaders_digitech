// Source of truth for company branding shown on quote PDFs.
// At runtime we load from crm_settings.company_info; the constants below are
// only the *default* values used until an admin saves the form for the first
// time (and on any cold fetch failure).

import { supabase } from '@/integrations/supabase/client';

export interface CompanyInfo {
  legalName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;       // ע.מ. / ח.פ.
  tagline: string;
  logoUrl: string;     // public URL — either a Supabase storage URL or a /public path
}

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  legalName: 'דיגיטק השכלה פרקטית בע״מ',
  address: 'שדרות נים 2, ראשון לציון',
  phone: '051-5706680',
  email: 'office@digi-tech.co.il',
  website: '',
  taxId: '516613742',
  tagline: '',
  logoUrl: '/logoReg.png',
};

const SETTINGS_KEY = 'company_info';

export const loadCompanyInfo = async (): Promise<CompanyInfo> => {
  const { data, error } = await supabase
    .from('crm_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();

  if (error || !data?.value) return { ...DEFAULT_COMPANY_INFO };

  try {
    const parsed = JSON.parse(data.value as unknown as string);
    return { ...DEFAULT_COMPANY_INFO, ...parsed };
  } catch {
    return { ...DEFAULT_COMPANY_INFO };
  }
};

export const saveCompanyInfo = async (info: CompanyInfo): Promise<void> => {
  const value = JSON.stringify(info);
  // upsert by key — crm_settings has UNIQUE on key
  const { error } = await supabase
    .from('crm_settings')
    .upsert({ key: SETTINGS_KEY, value }, { onConflict: 'key' });
  if (error) throw error;
};
