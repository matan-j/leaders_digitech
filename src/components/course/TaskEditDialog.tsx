import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Task } from './CourseLessonsSection';

interface TaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onSave: (task: Task) => void;
}

const TaskEditDialog = ({ open, onOpenChange, task, onSave }: TaskEditDialogProps) => {
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    estimated_duration: 30,
    is_mandatory: false,
  });

  useEffect(() => {
    if (task) {
      setEditData({
        title: task.title,
        description: task.description || '',
        estimated_duration: task.estimated_duration,
        is_mandatory: task.is_mandatory,
      });
    }
  }, [task]);

  const handleSave = () => {
    if (!task || !editData.title.trim()) return;

    const updatedTask: Task = {
      ...task,
      title: editData.title,
      description: editData.description,
      estimated_duration: editData.estimated_duration,
      is_mandatory: editData.is_mandatory,
    };

    onSave(updatedTask);
    onOpenChange(false);
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת משימה</DialogTitle>
          <DialogDescription>ערוך את פרטי המשימה</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="task-title">שם המשימה</Label>
            <Input
              id="task-title"
              value={editData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="הכנס שם משימה..."
            />
          </div>
          <div>
            <Label htmlFor="task-description">תיאור המשימה</Label>
            <Textarea
              id="task-description"
              value={editData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="תיאור המשימה (רשות)..."
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="task-duration">זמן מוערך (דקות)</Label>
            <Input
              id="task-duration"
              type="number"
              value={editData.estimated_duration}
              onChange={(e) => handleInputChange('estimated_duration', parseInt(e.target.value) || 30)}
              min="1"
            />
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <input
              type="checkbox"
              id="task-mandatory"
              checked={editData.is_mandatory}
              onChange={(e) => handleInputChange('is_mandatory', e.target.checked)}
              className="ml-2"
            />
            <Label htmlFor="task-mandatory">משימה חובה</Label>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={!editData.title.trim()}>
            שמור שינויים
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskEditDialog;