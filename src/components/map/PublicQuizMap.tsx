import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { computeNextDate } from '@/lib/schedule-utils';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Search, MapPin, Clock, Calendar as CalendarIcon, Loader2, LocateFixed, ArrowRight, X, SlidersHorizontal, List, Map as MapIcon } from 'lucide-react';
import { formatNextOccurrence } from '@/lib/schedule-utils';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const goldMarkerIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:hsl(36,90%,50%);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

interface OrgLocation {
  id: string;
  organization_id: string;
  venue_name: string;
  address_line: string | null;
  city: string;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  reservation_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  is_active: boolean;
  org_name?: string;
  org_logo_url?: string | null;
  schedules?: Schedule[];
  _distance?: number;
}

interface Schedule {
  id: string;
  schedule_type: string;
  day_of_week: number | null;
  event_date: string | null;
  start_time: string;
  end_time: string | null;
  title: string | null;
  category: string | null;
  language: string | null;
  entry_fee: string | null;
  prize_info: string | null;
  team_size_info: string | null;
  notes: string | null;
  is_active: boolean;
  recurrence_pattern: string;
  valid_from: string | null;
  valid_until: string | null;
}

const DAY_NAMES_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNextOccurrence(schedule: Schedule, t: (key: string) => string): string {
  return formatNextOccurrence(schedule, t, DAY_NAMES_KEYS);
}

// Marker cluster layer component
function MarkerClusterGroup({ locations, onSelectLocation }: { locations: OrgLocation[]; onSelectLocation: (loc: OrgLocation) => void }) {
  const map = useMap();
  const { t } = useTranslation();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (c: any) => {
        const count = c.getChildCount();
        return L.divIcon({
          html: `<div style="width:40px;height:40px;background:hsl(36,90%,50%);border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:hsl(220,25%,10%);font-weight:700;font-size:14px;font-family:'Space Grotesk',sans-serif">${count}</div>`,
          className: '',
          iconSize: L.point(40, 40),
          iconAnchor: L.point(20, 20),
        });
      },
    });

    locations.forEach(loc => {
      if (!loc.latitude || !loc.longitude) return;
      const marker = L.marker([loc.latitude, loc.longitude], { icon: goldMarkerIcon });
      
      const scheduleHtml = loc.schedules?.[0]
        ? `<p style="font-size:11px;margin-top:4px;font-weight:500;color:hsl(36,90%,50%)">${getNextOccurrence(loc.schedules[0], t)}</p>`
        : '';
      const logoHtml = loc.org_logo_url
        ? `<img src="${loc.org_logo_url}" alt="" style="width:28px;height:28px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.15)" />`
        : `<div style="width:28px;height:28px;border-radius:8px;background:hsl(220,18%,18%);display:flex;align-items:center;justify-content:center;color:hsl(36,90%,50%);font-size:12px;font-weight:700">${(loc.org_name || '?').slice(0, 1).toUpperCase()}</div>`;

      marker.bindPopup(`
        <div style="min-width:180px;font-family:'Inter',sans-serif">
          <div style="display:flex;gap:10px;align-items:flex-start">
            ${logoHtml}
            <div>
              <p style="font-weight:700;font-size:13px;margin:0;color:hsl(40,20%,92%)">${loc.venue_name}</p>
              <p style="font-size:11px;margin:2px 0 0;color:hsl(220,10%,55%)">${loc.org_name || ''}</p>
            </div>
          </div>
          <p style="font-size:11px;margin:2px 0;color:hsl(220,10%,55%)">${loc.city}, ${loc.country}</p>
          ${scheduleHtml}
        </div>
      `, { className: 'quiz-map-popup' });
      
      marker.on('click', () => onSelectLocation(loc));
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    clusterRef.current = cluster;

    // Fit bounds
    const valid = locations.filter(l => l.latitude && l.longitude);
    if (valid.length > 0) {
      const bounds = L.latLngBounds(valid.map(l => [l.latitude!, l.longitude!] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }
    };
  }, [locations, map, t, onSelectLocation]);

  return null;
}

export function PublicQuizMap() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [radius, setRadius] = useState<string>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date());
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d;
  });
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string>('auto');
  const [showFilters, setShowFilters] = useState(false);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  useEffect(() => {
    loadLocations();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserPos({ lat: latitude, lng: longitude });
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            if (data?.address?.city || data?.address?.town) {
              setDetectedCity(data.address.city || data.address.town);
            }
          } catch { /* ignore */ }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    const { data: locs } = await supabase
      .from('org_locations')
      .select('*')
      .eq('is_active', true);

    if (!locs || locs.length === 0) {
      setLocations([]);
      setLoading(false);
      return;
    }

    const orgIds = [...new Set(locs.map(l => l.organization_id))];
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, logo_url')
      .in('id', orgIds)
      .eq('public_map_enabled', true)
      .eq('is_deleted', false);

    const orgMap = new Map((orgs || []).map(o => [o.id, o]));

    const locIds = locs.map(l => l.id);
    const { data: schedules } = await supabase
      .from('location_schedules')
      .select('*')
      .in('organization_location_id', locIds)
      .eq('is_active', true);

    const scheduleMap = new Map<string, Schedule[]>();
    (schedules || []).forEach(s => {
      const existing = scheduleMap.get(s.organization_location_id) || [];
      existing.push(s as Schedule);
      scheduleMap.set(s.organization_location_id, existing);
    });

    const enriched: OrgLocation[] = locs
      .filter(l => orgMap.has(l.organization_id))
      .map(l => ({
        ...l,
        org_name: orgMap.get(l.organization_id)?.name,
        org_logo_url: orgMap.get(l.organization_id)?.logo_url || null,
        schedules: scheduleMap.get(l.id) || [],
      }));

    setLocations(enriched);
    setLoading(false);
  };

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const data = await res.json();
          if (data?.address?.city || data?.address?.town) {
            setDetectedCity(data.address.city || data.address.town);
          }
        } catch { /* ignore */ }
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    locations.forEach(l => l.schedules?.forEach(s => { if (s.category) cats.add(s.category); }));
    return Array.from(cats).sort();
  }, [locations]);

  const allCities = useMemo(() => {
    const cities = new Set<string>();
    locations.forEach(l => cities.add(l.city));
    return Array.from(cities).sort();
  }, [locations]);

  const hasActiveFilters = search.trim() || dayFilter !== 'all' || typeFilter !== 'all' || categoryFilter !== 'all' || radius !== 'all' || cityFilter !== 'auto';

  const filtered = useMemo(() => {
    let result = locations;

    if (cityFilter === 'auto' && detectedCity) {
      result = result.filter(l => l.city.toLowerCase() === detectedCity.toLowerCase());
    } else if (cityFilter !== 'all' && cityFilter !== 'auto') {
      result = result.filter(l => l.city === cityFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.venue_name.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.country.toLowerCase().includes(q) ||
        l.org_name?.toLowerCase().includes(q) ||
        l.address_line?.toLowerCase().includes(q)
      );
    }

    if (dayFilter !== 'all') {
      const day = parseInt(dayFilter);
      result = result.filter(l => l.schedules?.some(s => s.day_of_week === day));
    }

    if (typeFilter !== 'all') {
      result = result.filter(l => l.schedules?.some(s => s.schedule_type === typeFilter));
    }

    if (categoryFilter !== 'all') {
      result = result.filter(l => l.schedules?.some(s => s.category === categoryFilter));
    }

    const rangeFrom = dateFrom || new Date();
    const rangeTo = dateTo;
    result = result.map(l => {
      if (!l.schedules || l.schedules.length === 0) return { ...l, schedules: [] };
      const validSchedules = l.schedules.filter(s => {
        if (s.schedule_type === 'one_time' && s.event_date) {
          const eventDate = new Date(s.event_date);
          if (eventDate < rangeFrom) return false;
          if (rangeTo && eventDate > rangeTo) return false;
          return true;
        }
        if (s.schedule_type === 'recurring') {
          if (s.valid_until && new Date(s.valid_until) < rangeFrom) return false;
          if (rangeTo && s.valid_from && new Date(s.valid_from) > rangeTo) return false;
          return true;
        }
        return false;
      });
      return { ...l, schedules: validSchedules };
    }).filter(l => l.schedules!.length > 0);

    if (radius !== 'all' && userPos) {
      const maxKm = parseInt(radius);
      result = result.filter(l => {
        if (!l.latitude || !l.longitude) return false;
        return haversineDistance(userPos.lat, userPos.lng, l.latitude, l.longitude) <= maxKm;
      });
    }

    if (userPos) {
      result = result.map(l => ({
        ...l,
        _distance: l.latitude && l.longitude ? haversineDistance(userPos.lat, userPos.lng, l.latitude, l.longitude) : undefined,
      })).sort((a, b) => (a._distance ?? 9999) - (b._distance ?? 9999));
    }

    return result;
  }, [locations, search, radius, dayFilter, typeFilter, categoryFilter, dateFrom, dateTo, userPos, cityFilter, detectedCity]);

  const mappable = filtered.filter(l => l.latitude && l.longitude);

  const handleSelectLocation = useCallback((loc: OrgLocation) => {
    if (isMobile) setMobileView('list');
  }, [isMobile]);

  const resetFilters = () => {
    setSearch('');
    setDayFilter('all');
    setTypeFilter('all');
    setCategoryFilter('all');
    setRadius('all');
    setCityFilter('auto');
    setDateFrom(new Date());
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDateTo(d);
  };

  const renderFilters = () => (
    <div className={cn(
      "gap-2 relative z-[1000]",
      isMobile ? "flex flex-col" : "flex flex-wrap"
    )}>
      {/* Search + City + Geo - always visible */}
      <div className="flex gap-2 flex-1 min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('map.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
        </div>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm shrink-0">
            <SelectValue placeholder={t('mapSettings.city')} />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            <SelectItem value="all">{t('map.allCities')}</SelectItem>
            {detectedCity && <SelectItem value="auto">{detectedCity}</SelectItem>}
            {allCities.filter(c => c !== detectedCity).map(city => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Secondary filters row */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 h-9 text-sm" onClick={handleGeolocate} disabled={geoLoading}>
          {geoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{t('map.useMyLocation')}</span>
        </Button>
        <Select value={radius} onValueChange={setRadius}>
          <SelectTrigger className="w-[100px] h-9 text-sm">
            <SelectValue placeholder={t('map.radius')} />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            <SelectItem value="all">{t('map.radius')}</SelectItem>
            <SelectItem value="5">5 {t('map.km')}</SelectItem>
            <SelectItem value="10">10 {t('map.km')}</SelectItem>
            <SelectItem value="25">25 {t('map.km')}</SelectItem>
            <SelectItem value="50">50 {t('map.km')}</SelectItem>
            <SelectItem value="100">100 {t('map.km')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dayFilter} onValueChange={setDayFilter}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder={t('map.dayOfWeek')} />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            <SelectItem value="all">{t('map.allDays')}</SelectItem>
            {DAY_NAMES_KEYS.map((key, i) => (
              <SelectItem key={i} value={i.toString()}>{t(`map.${key}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder={t('map.eventType')} />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            <SelectItem value="all">{t('map.allEvents')}</SelectItem>
            <SelectItem value="recurring">{t('map.recurring')}</SelectItem>
            <SelectItem value="one_time">{t('map.oneTime')}</SelectItem>
          </SelectContent>
        </Select>
        {allCategories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue placeholder={t('map.category')} />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="all">{t('map.allCategories')}</SelectItem>
              {allCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 h-9 text-sm", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, 'dd.MM') : t('filters.dateFrom')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[9999]" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 h-9 text-sm", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, 'dd.MM') : t('filters.dateTo')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[9999]" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-sm gap-1" onClick={resetFilters}>
            <X className="h-3.5 w-3.5" />{t('filters.clearDates')}
          </Button>
        )}
      </div>
    </div>
  );

  const renderLocationCard = (loc: OrgLocation) => (
    <Link key={loc.id} to={`/quiz-map/${loc.id}`}>
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4 hover:border-primary/30 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {loc.org_logo_url ? (
              <img src={loc.org_logo_url} alt="" className="h-9 w-9 rounded-lg object-cover border border-border shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {(loc.org_name || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{loc.venue_name}</p>
              <p className="text-xs text-muted-foreground truncate">{loc.org_name}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {loc._distance !== undefined && (
              <Badge variant="outline" className="text-[10px] px-1.5">
                {loc._distance.toFixed(1)} {t('map.km')}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{loc.address_line ? `${loc.address_line}, ${loc.city}` : `${loc.city}, ${loc.country}`}</span>
        </div>
        {loc.schedules && loc.schedules.length > 0 && (
          <div className="mt-2 space-y-1">
            {loc.schedules.slice(0, 2).map(s => (
              <div key={s.id} className="flex items-center gap-1.5 text-xs">
                {s.schedule_type === 'recurring' ? (
                  <Clock className="h-3 w-3 text-primary shrink-0" />
                ) : (
                  <CalendarIcon className="h-3 w-3 text-primary shrink-0" />
                )}
                <span className="truncate">{getNextOccurrence(s, t)}</span>
                {s.title && <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">{s.title}</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );

  return (
    <section id="quiz-map" className="py-6 sm:py-12 lg:py-16">
      <div className="container mx-auto px-3 sm:px-4">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold">{t('map.title')}</h2>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base lg:text-lg">{t('map.subtitle')}</p>
        </div>

        {/* Mobile: filter toggle + view toggle */}
        {isMobile && (
          <div className="flex gap-2 mb-3">
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5 flex-1"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t('map.filters', 'Filteri')}
              {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">!</Badge>}
            </Button>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <Button
                variant={mobileView === 'map' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setMobileView('map')}
              >
                <MapIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={mobileView === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none px-3"
                onClick={() => setMobileView('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Filters - collapsible on mobile */}
        {(isMobile ? showFilters : true) && (
          <div className="mb-4 sm:mb-6">
            {renderFilters()}
          </div>
        )}

        {/* Desktop: Map + List side by side */}
        {!isMobile && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 rounded-xl overflow-hidden border border-border bg-card" style={{ height: 520 }}>
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <MapContainer
                  center={userPos ? [userPos.lat, userPos.lng] : [44.8, 20.46]}
                  zoom={userPos ? 12 : 6}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  <MarkerClusterGroup locations={mappable} onSelectLocation={handleSelectLocation} />
                  {userPos && (
                    <Marker
                      position={[userPos.lat, userPos.lng]}
                      icon={L.divIcon({
                        className: '',
                        html: '<div style="width:16px;height:16px;background:hsl(210,100%,56%);border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8],
                      })}
                    />
                  )}
                </MapContainer>
              )}
            </div>

            <div className="lg:col-span-2 space-y-3 max-h-[520px] overflow-y-auto">
              <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                {t('map.upcomingQuizNights')} <Badge variant="secondary">{filtered.length}</Badge>
              </h3>
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">{t('map.noResults')}</p>
                </div>
              ) : (
                filtered.map(loc => renderLocationCard(loc))
              )}
            </div>
          </div>
        )}

        {/* Mobile: toggle between map and list */}
        {isMobile && (
          <>
            {mobileView === 'map' && (
              <div className="rounded-xl overflow-hidden border border-border bg-card" style={{ height: 'calc(100vh - 220px)', minHeight: 300 }}>
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <MapContainer
                    center={userPos ? [userPos.lat, userPos.lng] : [44.8, 20.46]}
                    zoom={userPos ? 12 : 6}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    <MarkerClusterGroup locations={mappable} onSelectLocation={handleSelectLocation} />
                    {userPos && (
                      <Marker
                        position={[userPos.lat, userPos.lng]}
                        icon={L.divIcon({
                          className: '',
                          html: '<div style="width:16px;height:16px;background:hsl(210,100%,56%);border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
                          iconSize: [16, 16],
                          iconAnchor: [8, 8],
                        })}
                      />
                    )}
                  </MapContainer>
                )}
              </div>
            )}

            {mobileView === 'list' && (
              <div className="space-y-2">
                <h3 className="font-display font-semibold text-base flex items-center gap-2">
                  {t('map.upcomingQuizNights')} <Badge variant="secondary">{filtered.length}</Badge>
                </h3>
                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">{t('map.noResults')}</p>
                  </div>
                ) : (
                  filtered.map(loc => renderLocationCard(loc))
                )}
              </div>
            )}

            {/* Floating result count on map view */}
            {mobileView === 'map' && filtered.length > 0 && (
              <Button
                variant="default"
                size="sm"
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] gap-1.5 shadow-lg rounded-full px-4"
                onClick={() => setMobileView('list')}
              >
                <List className="h-3.5 w-3.5" />
                {t('map.showList', 'Prikaži listu')} ({filtered.length})
              </Button>
            )}
          </>
        )}

        {/* Organizer CTA */}
        <div className="mt-8 sm:mt-12 rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8 text-center">
          <h3 className="font-display text-lg sm:text-xl font-bold">{t('map.organizerCta')}</h3>
          <p className="mt-2 text-muted-foreground text-sm">{t('map.organizerCtaDesc')}</p>
          <Link to="/register">
            <Button className="mt-4 gap-2" size="sm">
              {t('map.registerOrganization')} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Custom styles for dark map popups */}
      <style>{`
        .quiz-map-popup .leaflet-popup-content-wrapper {
          background: hsl(220, 22%, 11%);
          border: 1px solid hsl(220, 18%, 18%);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,.4);
        }
        .quiz-map-popup .leaflet-popup-tip {
          background: hsl(220, 22%, 11%);
          border: 1px solid hsl(220, 18%, 18%);
        }
        .quiz-map-popup .leaflet-popup-close-button {
          color: hsl(220, 10%, 55%);
        }
        .quiz-map-popup .leaflet-popup-close-button:hover {
          color: hsl(36, 90%, 50%);
        }
        .leaflet-container {
          background: hsl(220, 25%, 7%);
        }
      `}</style>
    </section>
  );
}
