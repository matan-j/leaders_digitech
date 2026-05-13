import React, { useEffect } from 'react';
import { Control, useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { Product } from '@/types/products';
import { calcLine } from '@/lib/quotes/quote-calc';
import { buildDescription } from '@/lib/quotes/description-builder';
import { formatILS } from '@/lib/quotes/money';
import type { QuoteFormValues, QuoteLineFormValue } from './quote-form-types';

interface QuoteLinesEditorProps {
  products: Product[];
}

const emptyLine = (): QuoteLineFormValue => ({
  id: null,
  product_id: null,
  product_name_snapshot: '',
  grade_label: '',
  class_label: '',
  description_text: '',
  description_dirty: false,
  meetings_count: 1,
  hours_per_meeting: 1,
  groups_count: 1,
  total_hours: 1,
  hourly_rate_incl_vat: 0,
  line_total_incl_vat: 0,
  internal_notes: '',
});

const QuoteLinesEditor: React.FC<QuoteLinesEditorProps> = ({ products }) => {
  const { control, watch, setValue, getValues } = useFormContext<QuoteFormValues>();
  const { fields, append, remove, insert } = useFieldArray({
    control: control as Control<QuoteFormValues>,
    name: 'lines',
  });

  // Auto-recalc total_hours, line_total, and description on every line change
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (!name?.startsWith('lines.')) return;
      // name is like "lines.2.meetings_count"
      const parts = name.split('.');
      const idx = Number(parts[1]);
      if (Number.isNaN(idx)) return;

      const line = (value.lines ?? [])[idx];
      if (!line) return;

      const math = calcLine({
        meetings_count: Number(line.meetings_count) || 0,
        hours_per_meeting: Number(line.hours_per_meeting) || 0,
        groups_count: Number(line.groups_count) || 0,
        hourly_rate_incl_vat: Number(line.hourly_rate_incl_vat) || 0,
      });

      if (math.total_hours !== line.total_hours) {
        setValue(`lines.${idx}.total_hours`, math.total_hours, { shouldDirty: true });
      }
      if (math.line_total_incl_vat !== line.line_total_incl_vat) {
        setValue(`lines.${idx}.line_total_incl_vat`, math.line_total_incl_vat, { shouldDirty: true });
      }

      // Auto-build description unless user touched it manually
      if (!line.description_dirty) {
        const built = buildDescription({
          grade_label: line.grade_label,
          class_label: line.class_label,
          meetings_count: Number(line.meetings_count) || 0,
          groups_count: Number(line.groups_count) || 0,
        });
        if (built !== line.description_text) {
          setValue(`lines.${idx}.description_text`, built, { shouldDirty: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue]);

  const handleProductChange = (idx: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setValue(`lines.${idx}.product_id`, product.id, { shouldDirty: true });
    setValue(`lines.${idx}.product_name_snapshot`, product.name, { shouldDirty: true });

    const currentRate = Number(getValues(`lines.${idx}.hourly_rate_incl_vat`)) || 0;
    if (currentRate === 0) {
      setValue(`lines.${idx}.hourly_rate_incl_vat`, Number(product.price_incl_vat), { shouldDirty: true });
    }
  };

  const handleDuplicate = (idx: number) => {
    const current = getValues(`lines.${idx}`);
    insert(idx + 1, { ...current, id: null });
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-2 py-2 text-right w-10"></th>
              <th className="px-2 py-2 text-right min-w-[180px]">מוצר</th>
              <th className="px-2 py-2 text-right">שכבה</th>
              <th className="px-2 py-2 text-right">מפגשים</th>
              <th className="px-2 py-2 text-right">שעות/מפגש</th>
              <th className="px-2 py-2 text-right">קבוצות</th>
              <th className="px-2 py-2 text-right">סה"כ שעות</th>
              <th className="px-2 py-2 text-right">מחיר/שעה</th>
              <th className="px-2 py-2 text-right">סה"כ שורה</th>
              <th className="px-2 py-2 text-right min-w-[200px]">תיאור ללקוח</th>
              <th className="px-2 py-2 text-right w-20"></th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                  אין שורות. לחץ "הוסף שורה" כדי להתחיל.
                </td>
              </tr>
            )}
            {fields.map((field, idx) => {
              const line = watch(`lines.${idx}`);
              return (
                <tr key={field.id} className="border-t hover:bg-gray-50/40">
                  <td className="px-2 py-1 text-gray-300 text-center">
                    <GripVertical className="h-4 w-4 inline-block" />
                  </td>
                  <td className="px-2 py-1">
                    <Select
                      value={line?.product_id ?? ''}
                      onValueChange={(v) => handleProductChange(idx, v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="בחר מוצר" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      className="h-8 text-xs"
                      value={line?.grade_label ?? ''}
                      onChange={(e) => setValue(`lines.${idx}.grade_label`, e.target.value, { shouldDirty: true })}
                      placeholder="ה'"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min={1}
                      dir="ltr"
                      className="h-8 text-xs w-20"
                      value={line?.meetings_count ?? 1}
                      onChange={(e) => setValue(`lines.${idx}.meetings_count`, parseInt(e.target.value) || 0, { shouldDirty: true })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      step="0.25"
                      min={0}
                      dir="ltr"
                      className="h-8 text-xs w-20"
                      value={line?.hours_per_meeting ?? 1}
                      onChange={(e) => setValue(`lines.${idx}.hours_per_meeting`, parseFloat(e.target.value) || 0, { shouldDirty: true })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min={1}
                      dir="ltr"
                      className="h-8 text-xs w-16"
                      value={line?.groups_count ?? 1}
                      onChange={(e) => setValue(`lines.${idx}.groups_count`, parseInt(e.target.value) || 0, { shouldDirty: true })}
                    />
                  </td>
                  <td className="px-2 py-1 text-center font-medium text-gray-700" dir="ltr">
                    {line?.total_hours ?? 0}
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      dir="ltr"
                      className="h-8 text-xs w-24"
                      value={line?.hourly_rate_incl_vat ?? 0}
                      onChange={(e) => setValue(`lines.${idx}.hourly_rate_incl_vat`, parseFloat(e.target.value) || 0, { shouldDirty: true })}
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-semibold text-gray-900" dir="ltr">
                    {formatILS(line?.line_total_incl_vat ?? 0)}
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      className="h-8 text-xs"
                      value={line?.description_text ?? ''}
                      onChange={(e) => {
                        setValue(`lines.${idx}.description_text`, e.target.value, { shouldDirty: true });
                        setValue(`lines.${idx}.description_dirty`, true, { shouldDirty: true });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" type="button" onClick={() => handleDuplicate(idx)} title="שכפול">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => remove(idx)} title="מחיקה">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}>
        <Plus className="ms-2 h-4 w-4" /> הוסף שורה
      </Button>
    </div>
  );
};

export default QuoteLinesEditor;
