import { useState } from 'react';
import CRMDashboard from '@/components/crm/CRMDashboard';
import CRMInstitutionsList from '@/components/crm/CRMInstitutionsList';
import CRMPipeline from '@/components/crm/CRMPipeline';
import CRMMessagesEditor from '@/components/crm/CRMMessagesEditor';
import CRMBroadcast from '@/components/crm/CRMBroadcast';

export type CRMTab = 'dashboard' | 'leads' | 'customers' | 'pipeline' | 'messages' | 'broadcast';

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

const CRM = () => {
  const [activeTab, setActiveTab] = useState<CRMTab>('dashboard');

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
            onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'dashboard' && <CRMDashboard setTab={setActiveTab} />}
        {activeTab === 'leads'     && <CRMInstitutionsList setTab={setActiveTab} mode="leads" />}
        {activeTab === 'customers' && <CRMInstitutionsList setTab={setActiveTab} mode="customers" />}
        {activeTab === 'pipeline'  && <CRMPipeline />}
        {activeTab === 'messages'  && <CRMMessagesEditor />}
        {activeTab === 'broadcast' && <CRMBroadcast />}
      </div>
    </div>
  );
};

export default CRM;
