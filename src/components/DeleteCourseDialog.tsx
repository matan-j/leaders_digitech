import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, EyeOff, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssignmentDetail {
  id: string;
  educational_institutions: { name: string } | null;
  profiles: { full_name: string } | null;
}

interface DeleteCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseName: string;
  assignments: AssignmentDetail[];
  onConfirmDelete: () => void;
}

const DeleteCourseDialog: React.FC<DeleteCourseDialogProps> = ({
  open,
  onOpenChange,
  courseName,
  assignments,
  onConfirmDelete,
}) => {
  const hasAssignments = assignments.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {hasAssignments ? (
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            ) : (
              <EyeOff className="h-6 w-6 text-orange-500" />
            )}
            {hasAssignments
              ? `מחיקת תוכנית לימוד עם הקצאות: ${courseName}`
              : `מחיקת תוכנית לימוד: ${courseName}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasAssignments ? (
              <>
                <p className="mb-4">
                  שים לב! תוכנית הלימוד "{courseName}" משויכת להקצאות הבאות:
                </p>
                <div className="max-h-40 overflow-y-auto rounded-md border bg-gray-50 p-3">
                  <ul className="list-disc pl-5 space-y-2">
                    {assignments.map((assignment) => (
                      <li key={assignment.id}>
                        <span className="font-semibold">
                          {assignment.educational_institutions?.name || "מוסד לא ידוע"}
                        </span>
                        <span>
                          {" "}
                          (מדריך: {assignment.profiles?.full_name || "לא שויך"})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 text-orange-600 font-medium">
                  מחיקת תוכנית הלימוד תמחק גם את כל ההקצאות המשויכות אליה.
                </p>
                <p className="mt-2">
                  האם אתה בטוח שברצונך למחוק את תוכנית הלימוד וכל ההקצאות שלה?
                </p>
              </>
            ) : (
              "האם אתה בטוח שברצונך להסתיר תוכנית לימוד זו? התוכנית לא תוצג יותר ברשימות."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={onConfirmDelete}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Trash className="h-4 w-4 mr-2" />
            {hasAssignments ? "מחק תוכנית והקצאות" : "אישור ומחיקה"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteCourseDialog;