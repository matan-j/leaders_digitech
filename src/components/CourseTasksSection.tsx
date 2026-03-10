import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Task {
  id: string;
  title: string;
  description: string;
  estimated_duration: number;
  is_mandatory: boolean;
  lesson_number: number;
  order_index: number;
}

interface CourseTasksSectionProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

const CourseTasksSection = ({ tasks, onTasksChange }: CourseTasksSectionProps) => {
  const [isSaved, setIsSaved] = useState(false);

  const addTask = (e: React.MouseEvent) => {
    e.preventDefault(); // מניעת שליחת הטופס
    if (isSaved) return;
    const newTask: Task = {
      id: `temp-${Date.now()}`,
      title: '',
      description: '',
      estimated_duration: 0,
      is_mandatory: false,
      lesson_number: 1,
      order_index: tasks.length
    };
    onTasksChange([...tasks, newTask]);
  };

  const removeTask = (index: number, e: React.MouseEvent) => {
    e.preventDefault(); // מניעת שליחת הטופס
    if (isSaved) return;
    onTasksChange(tasks.filter((_, i) => i !== index));
  };

  const moveTask = (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.preventDefault(); // מניעת שליחת הטופס
    if (isSaved) return;
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === tasks.length - 1)) {
      return;
    }
    const newTasks = [...tasks];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newTasks[index], newTasks[swapIndex]] = [newTasks[swapIndex], newTasks[index]];
    newTasks.forEach((task, i) => {
      task.order_index = i;
    });
    onTasksChange(newTasks);
  };

  const saveTasks = (e: React.MouseEvent) => {
    e.preventDefault(); // מניעת שליחת הטופס
    if (tasks.length === 0) return;
    setIsSaved(true);
  };

  const editTasks = (e: React.MouseEvent) => {
    e.preventDefault(); // מניעת שליחת הטופס
    setIsSaved(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-base font-semibold">משימות השיעור</Label>
        {!isSaved && (
          <Button type="button" onClick={addTask} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            הוסף משימה
          </Button>
        )}
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>אין משימות עדיין. לחץ על "הוסף משימה" כדי להתחיל.</p>
          </div>
        )}
        {tasks.map((task, index) => (
          <Card key={task.id} className="border-2 hover:border-blue-300 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <span>משימה {index + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!isSaved && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => moveTask(index, 'up', e)}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => moveTask(index, 'down', e)}
                        disabled={index === tasks.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => removeTask(index, e)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isSaved ? (
                <div>
                  <p><strong>שם המשימה:</strong> {task.title}</p>
                  <p><strong>זמן מוערך (דקות):</strong> {task.estimated_duration}</p>
                  <p><strong>תיאור:</strong> {task.description}</p>
                  <p><strong>מספר שיעור:</strong> {task.lesson_number}</p>
                  <p><strong>משימה חובה:</strong> {task.is_mandatory ? 'כן' : 'לא'}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`task-title-${index}`}>שם המשימה</Label>
                      <Input
                        id={`task-title-${index}`}
                        value={task.title}
                        onChange={(e) => updateTask(index, 'title', e.target.value)}
                        placeholder="הזן שם משימה"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`task-duration-${index}`}>זמן מוערך (דקות)</Label>
                      <Input
                        id={`task-duration-${index}`}
                        type="number"
                        value={task.estimated_duration}
                        onChange={(e) => updateTask(index, 'estimated_duration', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`task-description-${index}`}>תיאור</Label>
                    <Textarea
                      id={`task-description-${index}`}
                      value={task.description}
                      onChange={(e) => updateTask(index, 'description', e.target.value)}
                      placeholder="תיאור קצר של המשימה"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`task-lesson-${index}`}>מספר שיעור</Label>
                      <Input
                        id={`task-lesson-${index}`}
                        type="number"
                        value={task.lesson_number}
                        onChange={(e) => updateTask(index, 'lesson_number', parseInt(e.target.value) || 1)}
                        placeholder="1"
                        min="1"
                      />
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse pt-6">
                      <Checkbox
                        id={`task-mandatory-${index}`}
                        checked={task.is_mandatory}
                        onCheckedChange={(checked) => updateTask(index, 'is_mandatory', checked)}
                      />
                      <Label htmlFor={`task-mandatory-${index}`}>משימה חובה</Label>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        {isSaved ? (
          <Button type="button" variant="outline" onClick={editTasks}>
            ערוך משימות
          </Button>
        ) : (
          <Button type="button" variant="default" onClick={saveTasks} disabled={tasks.length === 0}>
            שמור משימות
          </Button>
        )}
      </div>
    </div>
  );

  function updateTask(index: number, field: keyof Task, value: any) {
    if (isSaved) return;
    const updatedTasks = tasks.map((task, i) =>
      i === index ? { ...task, [field]: value } : task
    );
    onTasksChange(updatedTasks);
  }
};

export default CourseTasksSection;