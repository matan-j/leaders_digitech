import { Star, Phone, MapPin, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRegionColor, getRegionLabel } from '@/lib/instructors/regions';
import type { MatchResult } from '@/lib/instructors/matching';

export interface MatchCardInstructor {
  id: string;
  full_name: string;
  city: string | null;
  region: string | null;
  subjects: string[] | null;
  audiences: string[] | null;
  availability_days: number[] | null;
  hourly_rate: number | null;
  rating_score: number | null;
  current_load?: number | null;
  phone: string | null;
}

interface Props {
  instructor: MatchCardInstructor;
  match: MatchResult;
  onSelect?: (id: string) => void;
}

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const bucketClass = (bucket: MatchResult['bucket']) =>
  bucket === 'high'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : bucket === 'medium'
    ? 'bg-amber-100 text-amber-800 border-amber-200'
    : 'bg-gray-100 text-gray-700 border-gray-200';

const InstructorMatchCard = ({ instructor, match, onSelect }: Props) => {
  const regionColor = getRegionColor(instructor.region);
  const regionLabel = getRegionLabel(instructor.region);

  return (
    <div dir="rtl" className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{instructor.full_name}</h3>
          <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1">
            <MapPin className="w-3 h-3" />
            <span>{instructor.city ?? '—'}</span>
            {regionLabel && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${regionColor.badgeClass}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${regionColor.dotClass}`} />
                {regionLabel}
              </span>
            )}
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${bucketClass(match.bucket)}`}>
          {match.bucketLabel}
          <span className="opacity-70">· {match.score}</span>
        </span>
      </div>

      {/* Subjects + audiences */}
      {(instructor.subjects?.length || instructor.audiences?.length) ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {(instructor.subjects ?? []).slice(0, 3).map((s) => (
            <Badge key={`s-${s}`} variant="secondary" className="bg-blue-50 text-blue-700 text-[11px]">{s}</Badge>
          ))}
          {(instructor.audiences ?? []).slice(0, 2).map((a) => (
            <Badge key={`a-${a}`} variant="secondary" className="bg-emerald-50 text-emerald-700 text-[11px]">{a}</Badge>
          ))}
        </div>
      ) : null}

      {/* Availability */}
      {instructor.availability_days && instructor.availability_days.length > 0 && (
        <div className="flex items-center gap-1 mb-2">
          {DAY_LABELS.map((label, idx) => {
            const on = instructor.availability_days!.includes(idx);
            return (
              <span
                key={idx}
                className={[
                  'inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-semibold',
                  on ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-300',
                ].join(' ')}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-gray-700 mb-3">
        <div className="flex items-center gap-3">
          {instructor.hourly_rate !== null && (
            <span className="font-semibold">₪{instructor.hourly_rate} / שעה</span>
          )}
          {instructor.rating_score !== null && (
            <span className="inline-flex items-center gap-0.5 text-amber-600">
              <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-500" />
              {instructor.rating_score.toFixed(1)}
            </span>
          )}
          {instructor.current_load !== undefined && instructor.current_load !== null && (
            <span className="inline-flex items-center gap-1 text-gray-500">
              <Briefcase className="w-3.5 h-3.5" />
              עומס {instructor.current_load}
            </span>
          )}
        </div>
      </div>

      {/* Reasons */}
      {match.reasons.length > 0 && (
        <div className="text-[11px] text-gray-500 mb-3 line-clamp-2">
          {match.reasons.join(' · ')}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {instructor.phone && (
          <a
            href={`tel:${instructor.phone}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Phone className="w-3.5 h-3.5" />
            התקשר
          </a>
        )}
        <Button size="sm" className="flex-1" onClick={() => onSelect?.(instructor.id)}>
          בחר
        </Button>
      </div>
    </div>
  );
};

export default InstructorMatchCard;
