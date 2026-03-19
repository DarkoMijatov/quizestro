import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MapPin, Plus, Trash2, Clock, Calendar, Loader2, Globe, Eye, EyeOff, Navigation } from 'lucide-react';

interface Location {
  id: string;
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
  organization_id: string;
}

interface Schedule {
  id: string;
  organization_location_id: string;
  organization_id: string;
  schedule_type: string;
  day_of_week: number | null;
  event_date: string | null;
  start_time: string;
  end_time: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  title: string | null;
  category: string | null;
  language: string | null;
  entry_fee: string | null;
  prize_info: string | null;
  team_size_info: string | null;
  notes: string | null;
  recurrence_pattern: string;
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const emptyLocation: Omit<Location, 'id' | 'organization_id'> = {
  venue_name: '', address_line: '', city: '', postal_code: '', country: 'Serbia',
  latitude: null, longitude: null, description: '', contact_email: '', contact_phone: '',
  reservation_url: '', website_url: '', instagram_url: '', facebook_url: '', is_active: true,
};

export function LocationManager() {
  const { t } = useTranslation();
  const { currentOrg, currentRole, refetch } = useOrganizations();
  const { toast } = useToast();
  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const [mapEnabled, setMapEnabled] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editLoc, setEditLoc] = useState<Partial<Location> | null>(null);
  const [editSchedule, setEditSchedule] = useState<Partial<Schedule> | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    setMapEnabled((currentOrg as any).public_map_enabled ?? false);
    loadData();
  }, [currentOrg?.id]);

  const loadData = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [{ data: locs }, { data: scheds }] = await Promise.all([
      supabase.from('org_locations').select('*').eq('organization_id', currentOrg.id),
      supabase.from('location_schedules').select('*').eq('organization_id', currentOrg.id),
    ]);
    setLocations((locs || []) as Location[]);
    setSchedules((scheds || []) as Schedule[]);
    setLoading(false);
  };

  const toggleMapVisibility = async (enabled: boolean) => {
    if (!currentOrg) return;
    setMapEnabled(enabled);
    await supabase.from('organizations').update({ public_map_enabled: enabled }).eq('id', currentOrg.id);
    await refetch();
    toast({ title: '✓', description: t('settings.saved') });
  };

  const handleSaveLocation = async () => {
    if (!currentOrg || !editLoc?.venue_name?.trim() || !editLoc?.city?.trim()) return;
    setSaving(true);

    // Auto-geocode in background
    let latitude = editLoc.latitude || null;
    let longitude = editLoc.longitude || null;
    if (!latitude || !longitude) {
      try {
        const query = [editLoc.address_line, editLoc.city, editLoc.country].filter(Boolean).join(', ');
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await res.json();
        if (data?.[0]) {
          latitude = parseFloat(data[0].lat);
          longitude = parseFloat(data[0].lon);
        }
      } catch { /* ignore geocoding errors */ }
    }

    const payload = {
      venue_name: editLoc.venue_name.trim(),
      address_line: editLoc.address_line?.trim() || null,
      city: editLoc.city.trim(),
      postal_code: editLoc.postal_code?.trim() || null,
      country: editLoc.country?.trim() || 'Serbia',
      latitude,
      longitude,
      description: editLoc.description?.trim() || null,
      contact_email: editLoc.contact_email?.trim() || null,
      contact_phone: editLoc.contact_phone?.trim() || null,
      reservation_url: editLoc.reservation_url?.trim() || null,
      website_url: editLoc.website_url?.trim() || null,
      instagram_url: editLoc.instagram_url?.trim() || null,
      facebook_url: editLoc.facebook_url?.trim() || null,
      is_active: editLoc.is_active ?? true,
      organization_id: currentOrg.id,
    };

    if (editLoc.id) {
      await supabase.from('org_locations').update(payload).eq('id', editLoc.id);
    } else {
      await supabase.from('org_locations').insert(payload);
    }
    setSaving(false);
    setEditLoc(null);
    toast({ title: '✓', description: t('mapSettings.locationSaved') });
    loadData();
  };

  const handleDeleteLocation = async (id: string) => {
    await supabase.from('org_locations').delete().eq('id', id);
    toast({ title: '✓', description: t('mapSettings.locationDeleted') });
    loadData();
  };

  const handleSaveSchedule = async () => {
    if (!currentOrg || !editSchedule?.start_time) return;
    setSaving(true);
    const payload = {
      organization_location_id: editSchedule.organization_location_id!,
      organization_id: currentOrg.id,
      schedule_type: editSchedule.schedule_type || 'recurring',
      day_of_week: editSchedule.schedule_type === 'recurring' ? (editSchedule.day_of_week ?? 0) : null,
      event_date: editSchedule.schedule_type === 'one_time' ? editSchedule.event_date : null,
      start_time: editSchedule.start_time,
      end_time: editSchedule.end_time || null,
      valid_from: editSchedule.valid_from || null,
      valid_until: editSchedule.valid_until || null,
      is_active: editSchedule.is_active ?? true,
      title: editSchedule.title?.trim() || null,
      category: editSchedule.category?.trim() || null,
      language: editSchedule.language?.trim() || null,
      entry_fee: editSchedule.entry_fee?.trim() || null,
      prize_info: editSchedule.prize_info?.trim() || null,
      team_size_info: editSchedule.team_size_info?.trim() || null,
      notes: editSchedule.notes?.trim() || null,
      recurrence_pattern: editSchedule.recurrence_pattern || 'weekly',
    };

    if (editSchedule.id) {
      await supabase.from('location_schedules').update(payload).eq('id', editSchedule.id);
    } else {
      await supabase.from('location_schedules').insert(payload);
    }
    setSaving(false);
    setEditSchedule(null);
    toast({ title: '✓', description: t('mapSettings.scheduleSaved') });
    loadData();
  };

  const handleDeleteSchedule = async (id: string) => {
    await supabase.from('location_schedules').delete().eq('id', id);
    toast({ title: '✓', description: t('mapSettings.scheduleDeleted') });
    loadData();
  };

  const handleGeocode = async () => {
    if (!editLoc?.address_line && !editLoc?.city) return;
    setGeocoding(true);
    try {
      const query = [editLoc.address_line, editLoc.city, editLoc.country].filter(Boolean).join(', ');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      if (data?.[0]) {
        setEditLoc(prev => ({ ...prev, latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }));
      }
    } catch { /* ignore */ }
    setGeocoding(false);
  };

  if (!currentOrg) return null;

  return (
    <div className="space-y-6">
      {/* Visibility toggle */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-lg">{t('mapSettings.title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t('mapSettings.description')}</p>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            {mapEnabled ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            <span className="font-medium text-sm">{mapEnabled ? t('mapSettings.enabled') : t('mapSettings.disabled')}</span>
          </div>
          <Switch checked={mapEnabled} onCheckedChange={toggleMapVisibility} disabled={!canEdit} />
        </div>
        {locations.length > 0 && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{locations.filter(l => l.is_active).length} {t('mapSettings.activeLocations')}</span>
            <span>{schedules.filter(s => s.is_active).length} {t('mapSettings.upcomingEvents')}</span>
          </div>
        )}
      </div>

      {/* Locations */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">{t('mapSettings.locations')}</h2>
          </div>
          {canEdit && (
            <Button size="sm" className="gap-1" onClick={() => setEditLoc({ ...emptyLocation })}>
              <Plus className="h-4 w-4" /> {t('mapSettings.addLocation')}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('mapSettings.locationsDescription')}</p>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : locations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('mapSettings.noLocations')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map(loc => {
              const locSchedules = schedules.filter(s => s.organization_location_id === loc.id);
              return (
                <div key={loc.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{loc.venue_name}</p>
                        <Badge variant={loc.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {loc.is_active ? t('leagues.active') : t('leagues.inactive')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{loc.city}, {loc.country}</p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditLoc(loc)}>
                          {t('common.edit')}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('teams.deleteConfirm')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteLocation(loc.id)}>{t('common.delete')}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>

                  {/* Schedules for this location */}
                  {locSchedules.length > 0 && (
                    <div className="space-y-1">
                      {locSchedules.map(s => {
                        const patternLabel = s.schedule_type === 'recurring' && (s as any).recurrence_pattern && (s as any).recurrence_pattern !== 'weekly'
                          ? ` (${t(`mapSettings.${(s as any).recurrence_pattern}`)})`
                          : '';
                        return (
                        <div key={s.id} className="flex items-center justify-between text-xs rounded bg-muted/50 px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            {s.schedule_type === 'recurring' ? <Clock className="h-3 w-3 text-primary" /> : <Calendar className="h-3 w-3 text-primary" />}
                            <span>
                              {s.schedule_type === 'recurring'
                                ? `${t(`map.${DAY_KEYS[s.day_of_week || 0]}`)} ${t('map.at')} ${s.start_time?.slice(0, 5)}${patternLabel}`
                                : `${s.event_date} ${t('map.at')} ${s.start_time?.slice(0, 5)}`}
                            </span>
                            {s.title && <Badge variant="secondary" className="text-[10px]">{s.title}</Badge>}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <button className="text-primary hover:underline text-[10px]" onClick={() => setEditSchedule(s)}>
                                {t('common.edit')}
                              </button>
                              <button className="text-destructive hover:underline text-[10px]" onClick={() => handleDeleteSchedule(s.id)}>
                                {t('common.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                      })}
                    </div>
                  )}

                  {canEdit && (
                    <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setEditSchedule({
                        organization_location_id: loc.id, organization_id: currentOrg.id,
                        schedule_type: 'recurring', day_of_week: 4, start_time: '20:00', is_active: true,
                        recurrence_pattern: 'weekly',
                      })}>
                        <Clock className="h-3 w-3" /> {t('mapSettings.addRecurring')}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setEditSchedule({
                        organization_location_id: loc.id, organization_id: currentOrg.id,
                        schedule_type: 'one_time', start_time: '20:00', is_active: true,
                      })}>
                        <Calendar className="h-3 w-3" /> {t('mapSettings.addOneTime')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Location Dialog */}
      <Dialog open={!!editLoc} onOpenChange={() => setEditLoc(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLoc?.id ? t('mapSettings.editLocation') : t('mapSettings.addLocation')}</DialogTitle>
          </DialogHeader>
          {editLoc && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('mapSettings.venueName')} *</Label>
                <Input value={editLoc.venue_name || ''} onChange={e => setEditLoc(p => ({ ...p, venue_name: e.target.value }))} placeholder={t('mapSettings.venueNamePlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('mapSettings.address')}</Label>
                <Input value={editLoc.address_line || ''} onChange={e => setEditLoc(p => ({ ...p, address_line: e.target.value }))} placeholder={t('mapSettings.addressPlaceholder')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('mapSettings.city')} *</Label>
                  <Input value={editLoc.city || ''} onChange={e => setEditLoc(p => ({ ...p, city: e.target.value }))} placeholder={t('mapSettings.cityPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('mapSettings.country')}</Label>
                  <Input value={editLoc.country || ''} onChange={e => setEditLoc(p => ({ ...p, country: e.target.value }))} placeholder={t('mapSettings.countryPlaceholder')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('mapSettings.postalCode')}</Label>
                <Input value={editLoc.postal_code || ''} onChange={e => setEditLoc(p => ({ ...p, postal_code: e.target.value }))} />
              </div>

              <Separator />

              <Separator />

              <div className="space-y-2">
                <Label>{t('mapSettings.venueDescription')}</Label>
                <Textarea value={editLoc.description || ''} onChange={e => setEditLoc(p => ({ ...p, description: e.target.value }))} placeholder={t('mapSettings.venueDescPlaceholder')} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('mapSettings.contactEmail')}</Label>
                  <Input value={editLoc.contact_email || ''} onChange={e => setEditLoc(p => ({ ...p, contact_email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('mapSettings.contactPhone')}</Label>
                  <Input value={editLoc.contact_phone || ''} onChange={e => setEditLoc(p => ({ ...p, contact_phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>{t('mapSettings.websiteUrl')}</Label>
                  <Input value={editLoc.website_url || ''} onChange={e => setEditLoc(p => ({ ...p, website_url: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('mapSettings.instagramUrl')}</Label>
                  <Input value={editLoc.instagram_url || ''} onChange={e => setEditLoc(p => ({ ...p, instagram_url: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('mapSettings.facebookUrl')}</Label>
                  <Input value={editLoc.facebook_url || ''} onChange={e => setEditLoc(p => ({ ...p, facebook_url: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>{t('leagues.active')}</Label>
                <Switch checked={editLoc.is_active ?? true} onCheckedChange={v => setEditLoc(p => ({ ...p, is_active: v }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLoc(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveLocation} disabled={saving || !editLoc?.venue_name?.trim() || !editLoc?.city?.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={!!editSchedule} onOpenChange={() => setEditSchedule(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editSchedule?.schedule_type === 'recurring' ? t('mapSettings.addRecurring') : t('mapSettings.addOneTime')}
            </DialogTitle>
          </DialogHeader>
          {editSchedule && (
            <div className="space-y-4">
              {editSchedule.schedule_type === 'recurring' && (
                <>
                  <div className="space-y-2">
                    <Label>{t('map.dayOfWeek')}</Label>
                    <Select value={(editSchedule.day_of_week ?? 0).toString()} onValueChange={v => setEditSchedule(p => ({ ...p, day_of_week: parseInt(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_KEYS.map((key, i) => (
                          <SelectItem key={i} value={i.toString()}>{t(`map.${key}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('mapSettings.recurrencePattern')}</Label>
                    <Select value={editSchedule.recurrence_pattern || 'weekly'} onValueChange={v => setEditSchedule(p => ({ ...p, recurrence_pattern: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">{t('mapSettings.weekly')}</SelectItem>
                        <SelectItem value="biweekly">{t('mapSettings.biweekly')}</SelectItem>
                        <SelectItem value="monthly">{t('mapSettings.monthly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {editSchedule.schedule_type === 'one_time' && (
                <div className="space-y-2">
                  <Label>{t('mapSettings.eventDate')} *</Label>
                  <Input type="date" value={editSchedule.event_date || ''} onChange={e => setEditSchedule(p => ({ ...p, event_date: e.target.value }))} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('mapSettings.startTime')} *</Label>
                  <Input type="time" value={editSchedule.start_time || ''} onChange={e => setEditSchedule(p => ({ ...p, start_time: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('mapSettings.endTime')}</Label>
                  <Input type="time" value={editSchedule.end_time || ''} onChange={e => setEditSchedule(p => ({ ...p, end_time: e.target.value }))} />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('mapSettings.scheduleTitle')}</Label>
                <Input value={editSchedule.title || ''} onChange={e => setEditSchedule(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('mapSettings.scheduleCategory')}</Label>
                  <Input value={editSchedule.category || ''} onChange={e => setEditSchedule(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('mapSettings.scheduleLanguage')}</Label>
                  <Input value={editSchedule.language || ''} onChange={e => setEditSchedule(p => ({ ...p, language: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>{t('mapSettings.entryFee')}</Label>
                  <Input value={editSchedule.entry_fee || ''} onChange={e => setEditSchedule(p => ({ ...p, entry_fee: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('mapSettings.prizeInfo')}</Label>
                  <Input value={editSchedule.prize_info || ''} onChange={e => setEditSchedule(p => ({ ...p, prize_info: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('mapSettings.teamSizeInfo')}</Label>
                  <Input value={editSchedule.team_size_info || ''} onChange={e => setEditSchedule(p => ({ ...p, team_size_info: e.target.value }))} />
                </div>
              </div>

              {editSchedule.schedule_type === 'recurring' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t('mapSettings.validFrom')}</Label>
                    <Input type="date" value={editSchedule.valid_from || ''} onChange={e => setEditSchedule(p => ({ ...p, valid_from: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('mapSettings.validUntil')}</Label>
                    <Input type="date" value={editSchedule.valid_until || ''} onChange={e => setEditSchedule(p => ({ ...p, valid_until: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSchedule(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveSchedule} disabled={saving || !editSchedule?.start_time}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
