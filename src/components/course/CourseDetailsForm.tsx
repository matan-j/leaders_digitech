import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CourseDetailsFormProps {
  formData: {
    name: string;
    school_type?: string;
    presentation_link?: string;
    program_link?: string;
    color?: string;
  };
  onInputChange: (field: string, value: string) => void;
}

const COURSE_COLORS = [
  '#574a7a',
  '#cd7dff',
  '#007e50',
  '#00d0ff',
  '#575dd9',
  '#6730ff',
];

const CourseDetailsForm = ({ formData, onInputChange }: CourseDetailsFormProps) => {
  console.log("formData in CourseDetailsForm: ", formData);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">שם תוכנית הלימוד *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => onInputChange('name', e.target.value)}
          placeholder="הזן שם תוכנית לימוד"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="school_type">סוג בית ספר *</Label>
        <Select
          value={formData.school_type || ''}
          onValueChange={(value) => onInputChange('school_type', value)}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="בחר סוג בית ספר" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="elementary">יסודי</SelectItem>
            <SelectItem value="middle">חטיבה</SelectItem>
            <SelectItem value="high">תיכון</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="presentation_link">קישור למצגת</Label>
        <Input
          id="presentation_link"
          value={formData.presentation_link || ''}
          onChange={(e) => onInputChange('presentation_link', e.target.value)}
          placeholder="https://..."
          type="url"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="program_link">קישור לתכנית הפדגוגית</Label>
        <Input
          id="program_link"
          value={formData.program_link || ''}
          onChange={(e) => onInputChange('program_link', e.target.value)}
          placeholder="https://..."
          type="url"
        />
      </div>
      <div className="space-y-2">
        <Label>צבע קורס</Label>
        <div className="flex gap-2 flex-wrap">
          {COURSE_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onInputChange('color', c)}
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: formData.color === c ? '#fff' : c, outline: formData.color === c ? `2px solid ${c}` : 'none' }}
            >
              {formData.color === c && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CourseDetailsForm;