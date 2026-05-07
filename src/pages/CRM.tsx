import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import CRMDashboard from '@/components/crm/CRMDashboard';
import CRMInstitutionsList from '@/components/crm/CRMInstitutionsList';
import CRMPipeline from '@/components/crm/CRMPipeline';
import CRMMessagesEditor from '@/components/crm/CRMMessagesEditor';
import CRMBroadcast from '@/components/crm/CRMBroadcast';
import { supabase } from '@/integrations/supabase/client';

export type CRMTab = 'dashboard' | 'leads' | 'customers' | 'pipeline' | 'messages' | 'broadcast';

const TAB_FROM_LABEL: Record<string, CRMTab> = {
  'דשבורד': 'dashboard',
  'לידים': 'leads',
  'לקוחות': 'customers',
  'פייפליין': 'pipeline',
  'עורך הודעות': 'messages',
  'שליחה בקבוצות': 'broadcast',
};

const C = {
  surface: '#FFFFFF',
  border: '#E4E7ED',
  accent: '#3B5BDB',
  textSub: '#6B7280',
};

const NAV_TABS: { id: CRMTab; label: string }[] = [
  { id: 'dashboard', label: 'דשבורד' },
  { id: 'leads',     label: 'לידים' },
  { id: 'customers', label: 'לקוחות' },
  { id: 'pipeline',  label: 'פייפליין' },
  { id: 'messages',  label: 'עורך הודעות' },
  { id: 'broadcast', label: 'שליחה בקבוצות' },
];

const CRM_TAB_KEYS = NAV_TABS.map((tab) => tab.id);
const CRM_DEBUG_VERSION = 'crm-ui-debug-2026-05-07-01';

const parseCRMTab = (tabParam: string | null): CRMTab => {
  if (CRM_TAB_KEYS.includes(tabParam as CRMTab)) return tabParam as CRMTab;
  return TAB_FROM_LABEL[tabParam ?? ''] ?? 'dashboard';
};

const CRM = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = parseCRMTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState<CRMTab>(initialTab);
  const [openCsvImport, setOpenCsvImport] = useState(false);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const currentTab = parseCRMTab(searchParams.get('tab'));
  const showDebug = searchParams.get('debug') === 'crm';

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  const handleTabChange = (tab: CRMTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  useEffect(() => {
    if (!showDebug || !user?.id) return;

    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfileRole(data?.role ?? null));
  }, [showDebug, user?.id]);

  return (
    <div dir="rtl" className="min-h-screen" style={{ background: '#F8F9FB' }}>
      {/* Sub-nav */}
      <div
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
        }}
      >
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? C.accent : C.textSub,
              borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : '2px solid transparent',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginBottom: -1,
              whiteSpace: 'nowrap' as const,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'dashboard' && <CRMDashboard setTab={handleTabChange} onOpenCsvImport={() => { setOpenCsvImport(true); handleTabChange('leads'); }} />}
        {activeTab === 'leads'     && <CRMInstitutionsList setTab={handleTabChange} mode="leads" openCsvImport={openCsvImport} />}
        {activeTab === 'customers' && <CRMInstitutionsList setTab={handleTabChange} mode="customers" />}
        {activeTab === 'pipeline'  && <CRMPipeline />}
        {activeTab === 'messages'  && <CRMMessagesEditor />}
        {activeTab === 'broadcast' && <CRMBroadcast />}
      </div>

      {showDebug && (
        <div
          dir="ltr"
          style={{
            position: 'fixed',
            left: 12,
            bottom: 12,
            zIndex: 9999,
            maxWidth: 420,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #93C5FD',
            background: '#EFF6FF',
            color: '#1E3A8A',
            fontSize: 11,
            lineHeight: 1.45,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <div><b>CRM debug</b> {CRM_DEBUG_VERSION}</div>
          <div>component: src/pages/CRM.tsx / CRMInstitutionsList</div>
          <div>route: /crm?tab={activeTab}</div>
          <div>user: {user?.email ?? 'unknown'} ({user?.id ?? 'no-id'})</div>
          <div>metadata role: {String(user?.user_metadata?.role ?? 'null')}</div>
          <div>profile role: {String(profileRole ?? 'loading/null')}</div>
        </div>
      )}
    </div>
  );
};

export default CRM;
