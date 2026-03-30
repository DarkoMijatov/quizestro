import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ForceDarkTheme } from "@/components/ForceDarkTheme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Clock,
  Calendar,
  Globe,
  ExternalLink,
  Instagram,
  Facebook,
  Mail,
  Phone,
  Navigation,
  Loader2,
  ArrowLeft,
  Users,
  Trophy,
  DollarSign,
} from "lucide-react";
import { computeNextDate } from "@/lib/schedule-utils";
import { format } from "date-fns";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DAY_NAMES_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

interface LocationData {
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
  organization_id: string;
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
}

export default function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [orgName, setOrgName] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: loc } = await supabase
        .from("org_locations")
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (!loc) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Check org is public
      const { data: org } = await supabase
        .from("organizations")
        .select("name, public_map_enabled, is_deleted")
        .eq("id", loc.organization_id)
        .single();

      if (!org || !org.public_map_enabled || org.is_deleted) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLocation(loc as LocationData);
      setOrgName(org.name);

      const { data: scheds } = await supabase
        .from("location_schedules")
        .select("*")
        .eq("organization_location_id", id)
        .eq("is_active", true);

      setSchedules((scheds || []) as Schedule[]);
      setLoading(false);
    };
    load();
  }, [id]);

  const getScheduleText = (s: Schedule) => {
    if (s.schedule_type === "one_time" && s.event_date) {
      return `${s.event_date} ${t("map.at")} ${s.start_time.slice(0, 5)}`;
    }
    if (s.day_of_week !== null) {
      const patternSuffix = s.recurrence_pattern && s.recurrence_pattern !== 'weekly'
        ? ` (${t(`mapSettings.${s.recurrence_pattern}`)})`
        : '';
      const nextDate = computeNextDate(s as any);
      const nextDateStr = nextDate ? ` — ${t('map.nextDate', 'Sledeći')}: ${format(nextDate, 'dd.MM.yyyy')}` : '';
      return `${t("map.every")} ${t(`map.${DAY_NAMES_KEYS[s.day_of_week]}`)} ${t("map.at")} ${s.start_time.slice(0, 5)}${patternSuffix}${nextDateStr}`;
    }
    return s.start_time.slice(0, 5);
  };

  const pageTitle = location ? `${location.venue_name} - ${orgName}` : t("map.locationDetails");

  // SEO: Update document title
  useEffect(() => {
    if (location) {
      document.title = `${location.venue_name} | ${orgName} - Quizestro`;
    }
    return () => {
      document.title = "Quizestro";
    };
  }, [location, orgName]);

  const goldIcon = L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;background:hsl(36,90%,50%);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  return (
    <ForceDarkTheme>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16">
          <Link
            to="/#quiz-map"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> {t("common.back")} {t("map.title")}
          </Link>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : notFound ? (
            <div className="text-center py-24">
              <MapPin className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h1 className="font-display text-2xl font-bold mb-2">{t("common.noResults")}</h1>
              <Link to="/#quiz-map">
                <Button variant="outline" className="mt-4">
                  {t("common.back")}
                </Button>
              </Link>
            </div>
          ) : (
            location && (
              <div className="grid lg:grid-cols-5 gap-8">
                {/* Main content */}
                <div className="lg:col-span-3 space-y-6">
                  <div>
                    <h1 className="font-display text-3xl md:text-4xl font-bold">{location.venue_name}</h1>
                    <p className="text-muted-foreground mt-1 text-lg">{orgName}</p>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                    <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      {location.address_line && <p className="font-medium">{location.address_line}</p>}
                      <p className="text-muted-foreground">
                        {location.city}, {location.country}
                      </p>
                      {location.postal_code && <p className="text-xs text-muted-foreground">{location.postal_code}</p>}
                    </div>
                  </div>

                  {location.description && (
                    <p className="text-muted-foreground leading-relaxed">{location.description}</p>
                  )}

                  {/* Schedules */}
                  {schedules.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="font-display text-xl font-semibold">{t("map.schedule")}</h2>
                      <div className="grid gap-3">
                        {schedules.map((s) => (
                          <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {s.schedule_type === "recurring" ? (
                                <Badge className="bg-primary/10 text-primary border-primary/30">
                                  {t("map.recurringSchedule")}
                                </Badge>
                              ) : (
                                <Badge variant="outline">{t("map.oneTimeEvent")}</Badge>
                              )}
                              {s.title && <span className="font-semibold">{s.title}</span>}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              {s.schedule_type === "recurring" ? (
                                <Clock className="h-4 w-4 text-primary" />
                              ) : (
                                <Calendar className="h-4 w-4 text-primary" />
                              )}
                              <span>{getScheduleText(s)}</span>
                              {s.end_time && <span className="text-muted-foreground">– {s.end_time.slice(0, 5)}</span>}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {s.entry_fee && (
                                <span className="flex items-center gap-1">
                                  {t("pricing.localCurrency")} {s.entry_fee}
                                </span>
                              )}
                              {s.prize_info && (
                                <span className="flex items-center gap-1">
                                  <Trophy className="h-3 w-3" /> {s.prize_info}
                                </span>
                              )}
                              {s.team_size_info && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" /> {s.team_size_info}
                                </span>
                              )}
                              {s.language && (
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" /> {s.language}
                                </span>
                              )}
                            </div>
                            {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact & Links */}
                  <div className="space-y-3">
                    {(location.contact_email || location.contact_phone) && (
                      <div className="flex flex-wrap gap-4">
                        {location.contact_email && (
                          <a
                            href={`mailto:${location.contact_email}`}
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                          >
                            <Mail className="h-4 w-4" /> {location.contact_email}
                          </a>
                        )}
                        {location.contact_phone && (
                          <a
                            href={`tel:${location.contact_phone}`}
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                          >
                            <Phone className="h-4 w-4" /> {location.contact_phone}
                          </a>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {location.website_url && (
                        <a href={location.website_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Globe className="h-3.5 w-3.5" />
                            {t("map.website")}
                          </Button>
                        </a>
                      )}
                      {location.reservation_url && (
                        <a href={location.reservation_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("map.reservation")}
                          </Button>
                        </a>
                      )}
                      {location.instagram_url && (
                        <a
                          href={`https://www.instagram.com/${location.instagram_url.replace("@", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Instagram className="h-3.5 w-3.5" />
                            Instagram
                          </Button>
                        </a>
                      )}
                      {location.facebook_url && (
                        <a href={location.facebook_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Facebook className="h-3.5 w-3.5" />
                            Facebook
                          </Button>
                        </a>
                      )}
                      {location.latitude && location.longitude && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Navigation className="h-3.5 w-3.5" />
                            {t("map.openInMaps")}
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Map sidebar */}
                <div className="lg:col-span-2">
                  {location.latitude && location.longitude ? (
                    <div
                      className="rounded-xl overflow-hidden border border-border sticky top-24"
                      style={{ height: 350 }}
                    >
                      <MapContainer
                        center={[location.latitude, location.longitude]}
                        zoom={15}
                        style={{ height: "100%", width: "100%" }}
                        scrollWheelZoom={false}
                        dragging={false}
                        zoomControl={false}
                      >
                        <TileLayer
                          attribution="&copy; OpenStreetMap"
                          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                        <Marker position={[location.latitude, location.longitude]} icon={goldIcon} />
                      </MapContainer>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card p-8 text-center">
                      <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">{t("common.noResults")}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
        <Footer />
      </div>
    </ForceDarkTheme>
  );
}
