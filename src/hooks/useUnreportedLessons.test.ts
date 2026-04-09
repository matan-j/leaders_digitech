import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUnreportedLessons } from './useUnreportedLessons';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

function mockQuery(data: { id: string; lesson_reports: { id: string }[] }[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data }),
  };
  vi.mocked(supabase.from).mockReturnValue(chain as any);
  return chain;
}

describe('useUnreportedLessons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 0 when data is empty', async () => {
    mockQuery([]);
    const { result } = renderHook(() => useUnreportedLessons('user-1', true));
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('counts only lessons with no lesson_reports', async () => {
    mockQuery([
      { id: 's1', lesson_reports: [] },
      { id: 's2', lesson_reports: [{ id: 'r1' }] },
      { id: 's3', lesson_reports: [] },
    ]);
    const { result } = renderHook(() => useUnreportedLessons('user-1', true));
    await waitFor(() => expect(result.current).toBe(2));
  });

  it('ignores lessons that already have reports', async () => {
    mockQuery([
      { id: 's1', lesson_reports: [{ id: 'r1' }] },
      { id: 's2', lesson_reports: [{ id: 'r2' }] },
    ]);
    const { result } = renderHook(() => useUnreportedLessons('user-1', true));
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('passes correct 30-day date bounds to the query', async () => {
    const before = new Date();
    const chain = mockQuery([]);
    renderHook(() => useUnreportedLessons('user-1', true));
    await waitFor(() => expect(chain.lt).toHaveBeenCalled());

    const ltArg = chain.lt.mock.calls[0][1] as string;
    const gtArg = chain.gt.mock.calls[0][1] as string;
    const ltDate = new Date(ltArg);
    const gtDate = new Date(gtArg);
    const after = new Date();

    // lt bound ≈ now
    expect(ltDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ltDate.getTime()).toBeLessThanOrEqual(after.getTime() + 100);

    // gt bound ≈ now - 30 days
    const diffDays = (ltDate.getTime() - gtDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('filters by instructor — passes userId to eq', async () => {
    const chain = mockQuery([]);
    renderHook(() => useUnreportedLessons('user-42', true));
    await waitFor(() => expect(chain.eq).toHaveBeenCalled());
    expect(chain.eq).toHaveBeenCalledWith('course_instances.instructor_id', 'user-42');
  });

  it('returns 0 and does not query when isInstructor is false', async () => {
    mockQuery([]);
    const { result } = renderHook(() => useUnreportedLessons('user-1', false));
    await new Promise(r => setTimeout(r, 50));
    expect(result.current).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns 0 and does not query when userId is undefined', async () => {
    mockQuery([]);
    const { result } = renderHook(() => useUnreportedLessons(undefined, true));
    await new Promise(r => setTimeout(r, 50));
    expect(result.current).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
