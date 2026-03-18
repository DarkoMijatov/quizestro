import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, MapPin, Navigation, Clock, Calendar, ExternalLink, Globe, Instagram, Facebook, Mail, Phone, Loader2, LocateFixed, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
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
}

const DAY_NAMES_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MapBoundsUpdater({ locations }: { locations: OrgLocation[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = locations.filter(l => l.latitude && l.longitude);
    if (valid.length > 0) {
      const bounds = L.latLngBounds(valid.map(l => [l.latitude!, l.longitude!] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [locations, map]);
  return null;
}

function getNextOccurrence(schedule: Schedule, t: (key: string) => string): string {
  if (schedule.schedule_type === 'one_time' && schedule.event_date) {
    return `${schedule.event_date} ${t('map.at')} ${schedule.start_time.slice(0, 5)}`;
  }
  if (schedule.day_of_week !== null) {
    return `${t('map.every')} ${t(`map.${DAY_NAMES_KEYS[schedule.day_of_week]}`)} ${t('map.at')} ${schedule.start_time.slice(0, 5)}`;
  }
  return '';
}

export function PublicQuizMap() {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [radius, setRadius] = useState<string>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<OrgLocation | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    // Use anon key - public access via RLS
    const { data: locs } = await supabase
      .from('org_locations')
      .select('*')
      .eq('is_active', true);

    if (!locs || locs.length === 0) {
      setLocations([]);
      setLoading(false);
      return;
    }

    // Get org names
    const orgIds = [...new Set(locs.map(l => l.organization_id))];
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds)
      .eq('public_map_enabled', true)
      .eq('is_deleted', false);

    const orgMap = new Map((orgs || []).map(o => [o.id, o.name]));

    // Get schedules
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

    // Text search
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

    // Day filter
    if (dayFilter !== 'all') {
      const day = parseInt(dayFilter);
      result = result.filter(l =>
        l.schedules?.some(s => s.day_of_week === day)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(l =>
        l.schedules?.some(s => s.schedule_type === typeFilter)
      );
    }

    // Radius filter
    if (radius !== 'all' && userPos) {
      const maxKm = parseInt(radius);
      result = result.filter(l => {
        if (!l.latitude || !l.longitude) return false;
        return haversineDistance(userPos.lat, userPos.lng, l.latitude, l.longitude) <= maxKm;
      });
    }

    // Add distance
    if (userPos) {
      result = result.map(l => ({
        ...l,
        _distance: l.latitude && l.longitude ? haversineDistance(userPos.lat, userPos.lng, l.latitude, l.longitude) : undefined,
      })).sort((a, b) => ((a as any)._distance ?? 9999) - ((b as any)._distance ?? 9999));
    }

    return result;
  }, [locations, search, radius, dayFilter, typeFilter, userPos]);

  const mappable = filtered.filter(l => l.latitude && l.longitude);

  return (
    <section id="quiz-map" className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold">{t('map.title')}</h2>
          <p className="mt-4 text-muted-foreground text-lg">{t('map.subtitle')}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
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
            <SelectContent>
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
            <SelectContent>
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
            <SelectContent>
              <SelectItem value="all">{t('map.allEvents')}</SelectItem>
              <SelectItem value="recurring">{t('map.recurring')}</SelectItem>
              <SelectItem value="one_time">{t('map.oneTime')}</SelectItem>
            </SelectContent>
          </Select>
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
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBoundsUpdater locations={mappable} />
                {mappable.map(loc => (
                  <Marker key={loc.id} position={[loc.latitude!, loc.longitude!]}>
                    <Popup>
                      <div className="min-w-[200px]">
                        <p className="font-bold text-sm">{loc.venue_name}</p>
                        <p className="text-xs text-gray-600">{loc.org_name}</p>
                        <p className="text-xs">{loc.city}, {loc.country}</p>
                        {loc.schedules?.[0] && (
                          <p className="text-xs mt-1 font-medium">
                            {getNextOccurrence(loc.schedules[0], t)}
                          </p>
                        )}
                        <button
                          className="mt-2 text-xs text-blue-600 font-medium hover:underline"
                          onClick={() => setSelectedLocation(loc)}
                        >
                          {t('map.viewDetails')}
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {userPos && (
                  <Marker
                    position={[userPos.lat, userPos.lng]}
                    icon={L.divIcon({
                      className: '',
                      html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
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
                <div
                  key={loc.id}
                  className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedLocation(loc)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{loc.venue_name}</p>
                      <p className="text-xs text-muted-foreground">{loc.org_name}</p>
                    </div>
                    {(loc as any)._distance !== undefined && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {(loc as any)._distance.toFixed(1)} {t('map.km')}
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
                            <Calendar className="h-3 w-3 text-primary" />
                          )}
                          <span>{getNextOccurrence(s, t)}</span>
                          {s.title && <Badge variant="secondary" className="text-[10px] px-1.5">{s.title}</Badge>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

      {/* Detail modal */}
      <Dialog open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedLocation && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedLocation.venue_name}</DialogTitle>
                <p className="text-sm text-muted-foreground">{selectedLocation.org_name}</p>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Address */}
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    {selectedLocation.address_line && <p className="text-sm">{selectedLocation.address_line}</p>}
                    <p className="text-sm">{selectedLocation.city}, {selectedLocation.country}</p>
                    {selectedLocation.postal_code && <p className="text-xs text-muted-foreground">{selectedLocation.postal_code}</p>}
                  </div>
                </div>

                {selectedLocation.description && (
                  <p className="text-sm text-muted-foreground">{selectedLocation.description}</p>
                )}

                {/* Schedules */}
                {selectedLocation.schedules && selectedLocation.schedules.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">{t('map.schedule')}</h4>
                    <div className="space-y-2">
                      {selectedLocation.schedules.map(s => (
                        <div key={s.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-center gap-2">
                            {s.schedule_type === 'recurring' ? (
                              <Badge variant="secondary" className="text-xs">{t('map.recurringSchedule')}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">{t('map.oneTimeEvent')}</Badge>
                            )}
                            {s.title && <span className="text-sm font-medium">{s.title}</span>}
                          </div>
                          <p className="text-sm mt-1">{getNextOccurrence(s, t)}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {s.entry_fee && (
                              <span className="text-xs text-muted-foreground">💰 {t('map.entryFee')}: {s.entry_fee}</span>
                            )}
                            {s.prize_info && (
                              <span className="text-xs text-muted-foreground">🏆 {t('map.prizes')}: {s.prize_info}</span>
                            )}
                            {s.team_size_info && (
                              <span className="text-xs text-muted-foreground">👥 {t('map.teamSize')}: {s.team_size_info}</span>
                            )}
                            {s.language && (
                              <span className="text-xs text-muted-foreground">🌐 {s.language}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact & Links */}
                <div className="flex flex-wrap gap-3">
                  {selectedLocation.contact_email && (
                    <a href={`mailto:${selectedLocation.contact_email}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Mail className="h-3 w-3" /> {selectedLocation.contact_email}
                    </a>
                  )}
                  {selectedLocation.contact_phone && (
                    <a href={`tel:${selectedLocation.contact_phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Phone className="h-3 w-3" /> {selectedLocation.contact_phone}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedLocation.website_url && (
                    <a href={selectedLocation.website_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Globe className="h-3 w-3" />{t('map.website')}</Button>
                    </a>
                  )}
                  {selectedLocation.reservation_url && (
                    <a href={selectedLocation.reservation_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs"><ExternalLink className="h-3 w-3" />{t('map.reservation')}</Button>
                    </a>
                  )}
                  {selectedLocation.instagram_url && (
                    <a href={selectedLocation.instagram_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Instagram className="h-3 w-3" />Instagram</Button>
                    </a>
                  )}
                  {selectedLocation.facebook_url && (
                    <a href={selectedLocation.facebook_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Facebook className="h-3 w-3" />Facebook</Button>
                    </a>
                  )}
                  {selectedLocation.latitude && selectedLocation.longitude && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.latitude},${selectedLocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Navigation className="h-3 w-3" />{t('map.openInMaps')}</Button>
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
