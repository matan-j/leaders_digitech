import React from 'react';
import { Button } from './button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  isLoading = false,
}) => {
  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  const canGoPrevious = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border rounded-lg shadow-sm">
      {/* Info Section */}
      <div className="text-sm text-gray-700">
        מציג <span className="font-medium">{startItem}</span> עד{' '}
        <span className="font-medium">{endItem}</span> מתוך{' '}
        <span className="font-medium">{totalItems}</span> פריטים
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(0)}
          disabled={!canGoPrevious || isLoading}
          title="עמוד ראשון"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious || isLoading}
          title="עמוד קודם"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="text-sm text-gray-700 px-4">
          עמוד <span className="font-medium">{currentPage + 1}</span> מתוך{' '}
          <span className="font-medium">{totalPages}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext || isLoading}
          title="עמוד הבא"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={!canGoNext || isLoading}
          title="עמוד אחרון"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
