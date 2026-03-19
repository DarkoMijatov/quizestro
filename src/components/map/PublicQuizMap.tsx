import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Search, MapPin, Navigation, Clock, Calendar as CalendarIcon, Loader2, LocateFixed, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  if (schedule.schedule_type === 'one_time' && schedule.event_date) {
    return `${schedule.event_date} ${t('map.at')} ${schedule.start_time.slice(0, 5)}`;
  }
  if (schedule.day_of_week !== null) {
    const patternSuffix = schedule.recurrence_pattern && schedule.recurrence_pattern !== 'weekly'
      ? ` (${t(`mapSettings.${schedule.recurrence_pattern}`)})`
      : '';
    return `${t('map.every')} ${t(`map.${DAY_NAMES_KEYS[schedule.day_of_week]}`)} ${t('map.at')} ${schedule.start_time.slice(0, 5)}${patternSuffix}`;
  }
  return '';
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

      marker.bindPopup(`
        <div style="min-width:180px;font-family:'Inter',sans-serif">
          <p style="font-weight:700;font-size:13px;margin:0;color:hsl(40,20%,92%)">${loc.venue_name}</p>
          <p style="font-size:11px;margin:2px 0 0;color:hsl(220,10%,55%)">${loc.org_name || ''}</p>
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
  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [radius, setRadius] = useState<string>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    loadLocations();
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
      .select('id, name')
      .in('id', orgIds)
      .eq('public_map_enabled', true)
      .eq('is_deleted', false);

    const orgMap = new Map((orgs || []).map(o => [o.id, o.name]));

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
        org_name: orgMap.get(l.organization_id),
        schedules: scheduleMap.get(l.id) || [],
      }));

    setLocations(enriched);
    setLoading(false);
  };

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const filtered = useMemo(() => {
    let result = locations;

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

    // Date range filter - filter locations that have schedules matching the date range
    if (dateFrom || dateTo) {
      result = result.filter(l => {
        if (!l.schedules || l.schedules.length === 0) return false;
        return l.schedules.some(s => {
          if (s.schedule_type === 'one_time' && s.event_date) {
            const eventDate = new Date(s.event_date);
            if (dateFrom && eventDate < dateFrom) return false;
            if (dateTo && eventDate > dateTo) return false;
            return true;
          }
          if (s.schedule_type === 'recurring') {
            // Recurring events are always relevant unless date range is in the past
            if (dateTo && dateTo < new Date()) return false;
            return true;
          }
          return false;
        });
      });
    }

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
  }, [locations, search, radius, dayFilter, typeFilter, dateFrom, dateTo, userPos]);

  const mappable = filtered.filter(l => l.latitude && l.longitude);

  const handleSelectLocation = useCallback((loc: OrgLocation) => {
    // Navigate to location detail page
  }, []);

  return (
    <section id="quiz-map" className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold">{t('map.title')}</h2>
          <p className="mt-4 text-muted-foreground text-lg">{t('map.subtitle')}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 relative z-[1000]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('map.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleGeolocate} disabled={geoLoading}>
            {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {t('map.useMyLocation')}
          </Button>
          <Select value={radius} onValueChange={setRadius}>
            <SelectTrigger className="w-[120px]">
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
            <SelectTrigger className="w-[140px]">
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
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('map.eventType')} />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="all">{t('map.allEvents')}</SelectItem>
              <SelectItem value="recurring">{t('map.recurring')}</SelectItem>
              <SelectItem value="one_time">{t('map.oneTime')}</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4" />
                {dateFrom ? format(dateFrom, 'dd.MM.yyyy') : t('filters.dateFrom')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[9999]" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4" />
                {dateTo ? format(dateTo, 'dd.MM.yyyy') : t('filters.dateTo')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[9999]" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              <X className="h-4 w-4 mr-1" />{t('filters.clearDates')}
            </Button>
          )}
        </div>

        {/* Map + Results */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Map */}
          <div className="lg:col-span-3 rounded-xl overflow-hidden border border-border bg-card" style={{ height: 500 }}>
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

          {/* Results list */}
          <div className="lg:col-span-2 space-y-3 max-h-[500px] overflow-y-auto">
            <h3 className="font-display font-semibold text-lg">
              {t('map.upcomingQuizNights')} <Badge variant="secondary">{filtered.length}</Badge>
            </h3>
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t('map.noResults')}</p>
              </div>
            ) : (
              filtered.map(loc => (
                <Link key={loc.id} to={`/quiz-map/${loc.id}`}>
                  <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{loc.venue_name}</p>
                        <p className="text-xs text-muted-foreground">{loc.org_name}</p>
                      </div>
                      {loc._distance !== undefined && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {loc._distance.toFixed(1)} {t('map.km')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {loc.city}, {loc.country}
                    </div>
                    {loc.schedules && loc.schedules.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {loc.schedules.slice(0, 2).map(s => (
                          <div key={s.id} className="flex items-center gap-1.5 text-xs">
                            {s.schedule_type === 'recurring' ? (
                              <Clock className="h-3 w-3 text-primary" />
                            ) : (
                              <CalendarIcon className="h-3 w-3 text-primary" />
                            )}
                            <span>{getNextOccurrence(s, t)}</span>
                            {s.title && <Badge variant="secondary" className="text-[10px] px-1.5">{s.title}</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Organizer CTA */}
        <div className="mt-12 rounded-xl border border-primary/30 bg-primary/5 p-8 text-center">
          <h3 className="font-display text-xl font-bold">{t('map.organizerCta')}</h3>
          <p className="mt-2 text-muted-foreground">{t('map.organizerCtaDesc')}</p>
          <Link to="/register">
            <Button className="mt-4 gap-2">
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
