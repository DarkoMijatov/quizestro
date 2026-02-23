import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious, PaginationEllipsis,
} from '@/components/ui/pagination';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  getValue?: (row: T) => string | number | boolean | null;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pageSize?: number;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  searchPlaceholder?: string;
  searchFn?: (row: T, query: string) => boolean;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  headerActions?: React.ReactNode;
  title?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  pageSize = 10,
  defaultSortKey,
  defaultSortDir = 'desc',
  searchPlaceholder,
  searchFn,
  emptyIcon,
  emptyMessage,
  emptyAction,
  onRowClick,
  headerActions,
  title,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(defaultSortKey || '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    if (searchFn) return data.filter((row) => searchFn(row, q));
    return data.filter((row) =>
      columns.some((col) => {
        const val = col.getValue ? col.getValue(row) : (row as any)[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchFn, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      const aVal = col?.getValue ? col.getValue(a) : (a as any)[sortKey];
      const bVal = col?.getValue ? col.getValue(b) : (b as any)[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const renderPaginationItems = () => {
    const items: React.ReactNode[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink isActive={i === safePage} onClick={() => setPage(i)}>{i}</PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink isActive={1 === safePage} onClick={() => setPage(1)}>1</PaginationLink>
        </PaginationItem>
      );
      if (safePage > 3) items.push(<PaginationItem key="e1"><PaginationEllipsis /></PaginationItem>);
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink isActive={i === safePage} onClick={() => setPage(i)}>{i}</PaginationLink>
          </PaginationItem>
        );
      }
      if (safePage < totalPages - 2) items.push(<PaginationItem key="e2"><PaginationEllipsis /></PaginationItem>);
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink isActive={totalPages === safePage} onClick={() => setPage(totalPages)}>{totalPages}</PaginationLink>
        </PaginationItem>
      );
    }
    return items;
  };

  return (
    <div className="space-y-4">
      {(title || headerActions) && (
        <div className="flex items-center justify-between">
          {title && <h1 className="font-display text-2xl font-bold">{title}</h1>}
          {headerActions}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder || t('common.search')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          {emptyIcon}
          <p className="text-muted-foreground mt-4">{emptyMessage || t('common.noResults')}</p>
          {!search && emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      <div className="flex items-center">
                        {col.label}
                        {col.sortable && <SortIcon colKey={col.key} />}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row, i) => (
                  <TableRow
                    key={i}
                    className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {col.render ? col.render(row) : String((row as any)[col.key] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} / {sorted.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                      className={safePage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {renderPaginationItems()}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                      className={safePage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
}
