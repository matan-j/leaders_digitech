import { REGIONS, type RegionKey } from '@/lib/instructors/regions';

export type RegionTabValue = 'all' | RegionKey;

interface Props {
  active: RegionTabValue;
  counts: Record<string, number>; // keyed by RegionKey or 'all'; missing keys treated as 0
  onChange: (next: RegionTabValue) => void;
}

const InstructorRegionTabs = ({ active, counts, onChange }: Props) => {
  const totalCount = counts.all ?? 0;

  const Tab = ({
    value,
    label,
    count,
    dotClass,
    activeClass,
    countBadgeClass,
  }: {
    value: RegionTabValue;
    label: string;
    count: number;
    dotClass: string;
    activeClass: string;
    countBadgeClass: string;
  }) => {
    const isActive = active === value;
    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        className={[
          'shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition border',
          isActive
            ? `${activeClass} shadow-sm`
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
        ].join(' ')}
      >
        <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
        <span>{label}</span>
        <span
          className={[
            'inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full text-[11px] font-semibold',
            isActive ? countBadgeClass : 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div
      dir="rtl"
      className="flex items-center gap-2 overflow-x-auto px-4 py-2 bg-white border-b border-gray-200"
    >
      <Tab
        value="all"
        label="הכל"
        count={totalCount}
        dotClass="bg-slate-800"
        activeClass="bg-slate-100 text-slate-900 border-slate-300"
        countBadgeClass="bg-slate-200 text-slate-700"
      />
      {REGIONS.map((r) => (
        <Tab
          key={r.key}
          value={r.key}
          label={r.label}
          count={counts[r.key] ?? 0}
          dotClass={r.dotClass}
          activeClass={r.tabActiveClass}
          countBadgeClass={r.countBadgeClass}
        />
      ))}
    </div>
  );
};

export default InstructorRegionTabs;
