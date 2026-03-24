import { useState, useMemo, useEffect, useCallback } from 'react';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, Loader2, Filter, Check, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  getValue?: (row: T) => string | number | boolean | null;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  searchable?: boolean;
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
  filters?: FilterConfig[];
  filterFn?: (row: T, filters: Record<string, string>) => boolean;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  headerActions?: React.ReactNode;
  title?: string;
  // Server-side pagination props
  serverSide?: boolean;
  totalCount?: number;
  onServerChange?: (params: ServerParams) => void;
}

export interface ServerParams {
  page: number;
  pageSize: number;
  search: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  filters: Record<string, string>;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  pageSize = 15,
  defaultSortKey,
  defaultSortDir = 'desc',
  searchPlaceholder,
  searchFn,
  filters,
  filterFn,
  emptyIcon,
  emptyMessage,
  emptyAction,
  onRowClick,
  headerActions,
  title,
  serverSide,
  totalCount,
  onServerChange,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(defaultSortKey || '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [page, setPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Debounced search for server-side
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    if (!serverSide) return;
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, serverSide]);

  // Notify server of changes
  const notifyServer = useCallback((overrides?: Partial<ServerParams>) => {
    if (!serverSide || !onServerChange) return;
    onServerChange({
      page: overrides?.page ?? page,
      pageSize,
      search: overrides?.search ?? debouncedSearch,
      sortKey: overrides?.sortKey ?? sortKey,
      sortDir: overrides?.sortDir ?? sortDir,
      filters: overrides?.filters ?? activeFilters,
    });
  }, [serverSide, onServerChange, page, pageSize, debouncedSearch, sortKey, sortDir, activeFilters]);

  // Trigger server fetch when params change (server-side mode)
  useEffect(() => {
    if (serverSide) notifyServer();
  }, [debouncedSearch, page, sortKey, sortDir, activeFilters, serverSide]);

  // Client-side filtering
  const filtered = useMemo(() => {
    if (serverSide) return data;
    let result = data;

    if (filters && filterFn && Object.keys(activeFilters).some(k => activeFilters[k] !== '' && activeFilters[k] !== 'all')) {
      result = result.filter((row) => filterFn(row, activeFilters));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      if (searchFn) {
        result = result.filter((row) => searchFn(row, q));
      } else {
        result = result.filter((row) =>
          columns.some((col) => {
            const val = col.getValue ? col.getValue(row) : (row as any)[col.key];
            return val != null && String(val).toLowerCase().includes(q);
          })
        );
      }
    }

    return result;
  }, [data, search, searchFn, columns, activeFilters, filters, filterFn, serverSide]);

  // Client-side sorting
  const sorted = useMemo(() => {
    if (serverSide) return filtered;
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
  }, [filtered, sortKey, sortDir, columns, serverSide]);

  const totalItems = serverSide ? (totalCount ?? data.length) : sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = serverSide ? data : sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      const newDir = sortDir === 'asc' ? 'desc' : 'asc';
      setSortDir(newDir);
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder || t('common.search')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        {filters && filters.map((filter) => 
          filter.searchable ? (
            <Popover key={filter.key}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-[180px] justify-between font-normal text-sm">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {activeFilters[filter.key] && activeFilters[filter.key] !== 'all'
                      ? filter.options.find(o => o.value === activeFilters[filter.key])?.label || filter.label
                      : filter.allLabel || filter.label}
                  </span>
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={`${filter.label}...`} />
                  <CommandList>
                    <CommandEmpty>{t('common.noResults')}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all__"
                        onSelect={() => handleFilterChange(filter.key, 'all')}
                      >
                        <Check className={`mr-2 h-4 w-4 ${(!activeFilters[filter.key] || activeFilters[filter.key] === 'all') ? 'opacity-100' : 'opacity-0'}`} />
                        {filter.allLabel || t('filters.all')}
                      </CommandItem>
                      {filter.options.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          value={opt.label}
                          onSelect={() => handleFilterChange(filter.key, opt.value)}
                        >
                          <Check className={`mr-2 h-4 w-4 ${activeFilters[filter.key] === opt.value ? 'opacity-100' : 'opacity-0'}`} />
                          {opt.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <Select
              key={filter.key}
              value={activeFilters[filter.key] || 'all'}
              onValueChange={(v) => handleFilterChange(filter.key, v)}
            >
              <SelectTrigger className="w-[160px]">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{filter.allLabel || t('filters.all')}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : paged.length === 0 && totalItems === 0 ? (
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
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)} / {totalItems}
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
