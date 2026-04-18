import { useState } from 'react';
import CRMDashboard from '@/components/crm/CRMDashboard';
import CRMInstitutionsList from '@/components/crm/CRMInstitutionsList';

export type CRMTab = 'dashboard' | 'list' | 'pipeline' | 'messages' | 'broadcast' | 'followup';

const C = {
  surface: '#FFFFFF',
  border: '#E4E7ED',
  accent: '#3B5BDB',
  textSub: '#6B7280',
};

const NAV_TABS: { id: CRMTab; label: string }[] = [
  { id: 'dashboard', label: 'דשבורד' },
  { id: 'list', label: 'מוסדות' },
  { id: 'pipeline', label: 'פייפליין' },
  { id: 'messages', label: 'עורך הודעות' },
  { id: 'broadcast', label: 'שליחה בקבוצות' },
  { id: 'followup', label: 'תור מעקב' },
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
        {activeTab === 'list' && <CRMInstitutionsList setTab={setActiveTab} />}
        {activeTab === 'pipeline' && (
          <div style={{ padding: '40px 24px', color: C.textSub, fontSize: 14 }}>
            פייפליין — בקרוב
          </div>
        )}
        {activeTab === 'messages' && (
          <div style={{ padding: '40px 24px', color: C.textSub, fontSize: 14 }}>
            עורך הודעות — בקרוב
          </div>
        )}
        {activeTab === 'broadcast' && (
          <div style={{ padding: '40px 24px', color: C.textSub, fontSize: 14 }}>
            שליחה בקבוצות — בקרוב
          </div>
        )}
        {activeTab === 'followup' && (
          <div style={{ padding: '40px 24px', color: C.textSub, fontSize: 14 }}>
            תור מעקב — בקרוב
          </div>
        )}
      </div>
    </div>
  );
};

export default CRM;
