import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Restaurant = {
  id: string;
  name: string;
  city: string;
  category: string;
};

type Template = {
  id: string;
  name: string;
  objective: string;
  title: string;
  body: string;
  cta: string;
  gradient: string;
};

type PublicationStatus = "Brouillon" | "Programmé" | "Publié";

type Publication = {
  id: string;
  restaurantId: string;
  title: string;
  body: string;
  scheduledAt: string;
  channels: string[];
  audiences: string[];
  templateId: string;
  objective: string;
  status: PublicationStatus;
  createdAt: string;
};

type View = "Dashboard" | "Publications" | "Calendrier" | "Campagnes" | "Statistiques";

const restaurants: Restaurant[] = [
  { id: "bistro-nova", name: "Bistro Nova", city: "Paris", category: "Bistronomie" },
  { id: "terra-rosa", name: "Terra Rosa", city: "Lyon", category: "Italien moderne" },
  { id: "saigon-82", name: "Saigon 82", city: "Marseille", category: "Street food" },
];

const templates: Template[] = [
  {
    id: "promo-lunch",
    name: "Lunch express",
    objective: "Promo midi",
    title: "Menu du midi disponible dès 11h30",
    body: "Un menu rapide, généreux et pensé pour les pauses courtes. Ajoutez une boisson et un dessert pour pousser le panier moyen.",
    cta: "Commander maintenant",
    gradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.92) 0%, rgba(163, 230, 53, 0.72) 52%, rgba(254, 240, 138, 0.88) 100%)",
  },
  {
    id: "new-dish",
    name: "Nouveau plat",
    objective: "Nouveauté",
    title: "Le plat signature de la semaine arrive aujourd'hui",
    body: "Mettez en avant votre nouveauté avec une photo forte, une accroche claire et une publication planifiée sur plusieurs canaux.",
    cta: "Découvrir",
    gradient: "linear-gradient(135deg, rgba(9, 9, 11, 0.98) 0%, rgba(63, 63, 70, 0.92) 54%, rgba(120, 113, 108, 0.9) 100%)",
  },
  {
    id: "event-night",
    name: "Soirée événement",
    objective: "Event local",
    title: "Une soirée à réserver avant le complet",
    body: "Activez votre audience fidèle avec une date, un contexte et une disponibilité limitée pour créer de la réservation immédiate.",
    cta: "Réserver une table",
    gradient: "linear-gradient(135deg, rgba(217, 70, 239, 0.92) 0%, rgba(139, 92, 246, 0.86) 48%, rgba(34, 211, 238, 0.78) 100%)",
  },
];

const channels = ["App mobile", "Site web", "Push local"];
const audiences = ["Clients fidèles", "Nouveaux voisins", "Déjeuner", "Dîner", "Livraison"];
const navItems: View[] = ["Dashboard", "Publications", "Calendrier", "Campagnes", "Statistiques"];

const activitySeed = [
  { title: "Menu été programmé", detail: "Bistro Nova • demain, 11h30", state: "Programmé" },
  { title: "Visuel semaine validé", detail: "Terra Rosa • canal App mobile", state: "Validé" },
  { title: "Message de relance", detail: "Saigon 82 • audience fidèles", state: "Brouillon" },
];

const STORAGE_KEY = "post-studio-publications";

const statusStyles: Record<PublicationStatus, string> = {
  Publié: "rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-700",
  Programmé: "rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white",
  Brouillon: "rounded-full bg-amber-500/12 px-3 py-1 text-xs font-medium text-amber-700",
};

function loadPublications(): Publication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Publication[]) : [];
  } catch {
    return [];
  }
}

function savePublications(list: Publication[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // stockage indisponible : on ignore silencieusement
  }
}

function formatDayLabel(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  );
}

function PillButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-black/10 transition"
          : "rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
      }
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: PublicationStatus }) {
  return <span className={statusStyles[status]}>{status}</span>;
}

export default function App() {
  const [view, setView] = useState<View>("Dashboard");
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurants[0].id);
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0].id);
  const [postTitle, setPostTitle] = useState(templates[0].title);
  const [postBody, setPostBody] = useState(templates[0].body);
  const [scheduledAt, setScheduledAt] = useState("2026-08-12T11:30");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([channels[0], channels[1]]);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([audiences[0], audiences[2]]);
  const [status, setStatus] = useState<PublicationStatus>("Brouillon");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [publications, setPublications] = useState<Publication[]>(() => loadPublications());
  const [activityLog, setActivityLog] = useState(activitySeed);
  const [filterStatus, setFilterStatus] = useState<PublicationStatus | "Tous">("Tous");
  const [toast, setToast] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);

  const restaurant = useMemo(
    () => restaurants.find((item) => item.id === selectedRestaurant) ?? restaurants[0],
    [selectedRestaurant],
  );

  const template = useMemo(
    () => templates.find((item) => item.id === selectedTemplate) ?? templates[0],
    [selectedTemplate],
  );

  useEffect(() => {
    savePublications(publications);
  }, [publications]);

  useEffect(() => {
    return () => {
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [mediaUrl]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const previewDate = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(scheduledAt));

  const markDirty = () => setStatus("Brouillon");

  const toggleValue = (value: string, list: string[], setter: (next: string[]) => void) => {
    markDirty();
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const selectTemplate = (id: string) => {
    const next = templates.find((item) => item.id === id);
    if (next) {
      setSelectedTemplate(id);
      setPostTitle(next.title);
      setPostBody(next.body);
    }
    markDirty();
  };

  const handleMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }

    setMediaUrl(URL.createObjectURL(file));
    event.target.value = "";
  };

  const focusComposer = () => {
    setView("Dashboard");
    requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const buildPublication = (nextStatus: PublicationStatus): Publication => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    restaurantId: restaurant.id,
    title: postTitle.trim(),
    body: postBody.trim(),
    scheduledAt,
    channels: selectedChannels,
    audiences: selectedAudiences,
    templateId: template.id,
    objective: template.objective,
    status: nextStatus,
    createdAt: new Date().toISOString(),
  });

  const handleSaveDraft = () => {
    if (!postTitle.trim() || !postBody.trim()) {
      setToast("Renseignez un titre et un message avant d'enregistrer");
      return;
    }
    const publication = buildPublication("Brouillon");
    setPublications((current) => [publication, ...current]);
    setStatus("Brouillon");
    setToast("Brouillon enregistré");
  };

  const handlePublish = () => {
    if (!postTitle.trim() || !postBody.trim()) {
      setToast("Renseignez un titre et un message avant de publier");
      return;
    }
    const target = scheduledAt ? scheduledAt : new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
    setScheduledAt(target);
    const nextStatus: PublicationStatus = new Date(target).getTime() <= Date.now() ? "Publié" : "Programmé";
    const publication = buildPublication(nextStatus);
    setPublications((current) => [publication, ...current]);
    setStatus(nextStatus);
    setActivityLog((current) => [
      {
        title: publication.title,
        detail: `${restaurant.name} • ${new Date(publication.scheduledAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`,
        state: nextStatus,
      },
      ...current.slice(0, 2),
    ]);
    setToast(nextStatus === "Publié" ? "Publication mise en ligne" : "Publication programmée");
  };

  const deletePublication = (id: string) => {
    setPublications((current) => current.filter((item) => item.id !== id));
    setToast("Publication supprimée");
  };

  const resumePublication = (publication: Publication) => {
    setSelectedRestaurant(publication.restaurantId);
    setSelectedTemplate(publication.templateId);
    setPostTitle(publication.title);
    setPostBody(publication.body);
    setScheduledAt(publication.scheduledAt);
    setSelectedChannels(publication.channels);
    setSelectedAudiences(publication.audiences);
    setStatus("Brouillon");
    setView("Dashboard");
    requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const filteredPublications = useMemo(
    () =>
      filterStatus === "Tous"
        ? publications
        : publications.filter((item) => item.status === filterStatus),
    [publications, filterStatus],
  );

  const upcoming = useMemo(
    () =>
      publications
        .filter((item) => item.status !== "Brouillon")
        .slice()
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [publications],
  );

  const calendarGroups = useMemo(() => {
    const groups = new Map<string, Publication[]>();
    for (const publication of upcoming) {
      const day = formatDayLabel(publication.scheduledAt);
      const list = groups.get(day) ?? [];
      list.push(publication);
      groups.set(day, list);
    }
    return [...groups.entries()];
  }, [upcoming]);

  const channelStats = useMemo(() => {
    const max = Math.max(1, ...channels.map((channel) => publications.filter((p) => p.channels.includes(channel)).length));
    return channels.map((channel) => {
      const count = publications.filter((p) => p.channels.includes(channel)).length;
      return { channel, count, ratio: Math.round((count / max) * 100) };
    });
  }, [publications]);

  const restaurantStats = useMemo(
    () =>
      restaurants.map((item, index) => {
        const count = publications.filter((p) => p.restaurantId === item.id).length;
        return {
          ...item,
          count,
          reach: `${(12.4 + index * 3.2 + count * 1.1).toFixed(1)}k`,
          orders: 240 + index * 70 + count * 8,
          bookings: 45 + index * 12 + count * 3,
        };
      }),
    [publications],
  );

  const accentGradient = template.gradient;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f7f6f1_0%,_#eceae2_100%)] text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-80 shrink-0 flex-col border-r border-black/10 bg-zinc-950 text-white lg:flex">
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-zinc-950 shadow-lg shadow-black/30">
                <Icon path="M6 18V6h6a4 4 0 1 1 0 8H6m6 4 6-12" className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/55">Restaurant system</p>
                <h1 className="text-lg font-semibold">Post Studio</h1>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/65">
              Un système de publication partagé pour chaque restaurant, avec le même cadre visuel que les apps de mobilité premium.
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">Restaurants actifs</p>
            <div className="mt-3 space-y-2">
              {restaurants.map((item) => {
                const active = item.id === selectedRestaurant;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedRestaurant(item.id);
                      markDirty();
                    }}
                    className={
                      active
                        ? "flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left text-zinc-950 transition"
                        : "flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left text-white/80 transition hover:bg-white/10"
                    }
                  >
                    <div>
                      <p className={active ? "font-medium text-zinc-950" : "font-medium text-white"}>{item.name}</p>
                      <p className={active ? "text-xs text-zinc-500" : "text-xs text-white/55"}>
                        {item.city} - {item.category}
                      </p>
                    </div>
                    <span className={active ? "h-2.5 w-2.5 rounded-full bg-emerald-500" : "h-2.5 w-2.5 rounded-full bg-white/25"} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">Navigation</p>
            <nav className="mt-3 space-y-1">
              {navItems.map((item, index) => {
                const active = view === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setView(item)}
                    className={
                      active
                        ? "flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left text-zinc-950"
                        : "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-white/75 transition hover:bg-white/6 hover:text-white"
                    }
                  >
                    <span>{item}</span>
                    <span className={active ? "text-xs font-semibold text-emerald-600" : "text-xs text-white/35"}>
                      {item === "Dashboard" ? "Live" : item === "Publications" ? String(publications.length) : "0" + (index + 1)}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-white/10 p-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Diffusion partagée</p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Tous les restaurants publient depuis le même système, avec un contrôle centralisé et des campagnes locales adaptées.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mb-4 rounded-3xl border border-black/10 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Restaurant system</p>
                <p className="font-semibold text-zinc-950">Post Studio</p>
              </div>
              <div className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white">{restaurant.name}</div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  className={
                    view === item
                      ? "shrink-0 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-medium text-white"
                      : "shrink-0 rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600"
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {view === "Dashboard" && (
                <>
                  <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    className="relative overflow-hidden rounded-[34px] border border-black/10 bg-zinc-950 text-white shadow-[0_24px_80px_rgba(0,0,0,0.14)]"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.08),_transparent_26%)]" />
                    <div className="relative grid gap-8 p-6 sm:p-8 xl:grid-cols-[1.2fr_0.8fr] xl:p-10">
                      <div className="space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/70">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          Accès commun pour tous les restaurants
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-medium uppercase tracking-[0.25em] text-white/45">Uber-style post system</p>
                          <h2 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                            Publiez, planifiez et pilotez vos offres locales dans une interface nette et rapide.
                          </h2>
                          <p className="max-w-xl text-base leading-7 text-white/68">
                            Un dashboard pensé comme un produit premium: une même base pour chaque établissement, des campagnes personnalisées, et un aperçu instantané avant mise en ligne.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={focusComposer}
                            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:scale-[1.01]"
                          >
                            Nouvelle publication
                          </button>
                          <button
                            type="button"
                            onClick={() => setView("Calendrier")}
                            className="rounded-full border border-white/14 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                          >
                            Voir le calendrier
                          </button>
                        </div>
                      </div>

                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/8 p-4"
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_transparent_50%)]" />
                        <div className="relative space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Diffusion active</p>
                              <p className="mt-1 text-lg font-semibold">{restaurant.name}</p>
                            </div>
                            <StatusBadge status={status} />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: "Portée", value: "18.4k" },
                              { label: "Commandes", value: "312" },
                              { label: "Réservations", value: "58" },
                            ].map((metric) => (
                              <div key={metric.label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">{metric.label}</p>
                                <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 rounded-2xl bg-white/10" />
                              <div>
                                <p className="font-medium">Publication planifiée</p>
                                <p className="text-sm text-white/56">{previewDate}</p>
                              </div>
                            </div>
                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full w-[72%] rounded-full bg-emerald-400" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.section>

                  <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <motion.section
                      ref={composerRef}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.05 }}
                      className="scroll-mt-6 rounded-[30px] border border-black/10 bg-white/92 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.05)] backdrop-blur"
                    >
                      <div className="flex items-start justify-between gap-4 border-b border-black/8 pb-5">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Composer</p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Créer la publication</h3>
                          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                            Choisissez une intention, écrivez le message, ciblez l'audience et validez le rendu avant diffusion.
                          </p>
                        </div>
                        <div className="rounded-full border border-black/10 bg-zinc-950 px-3 py-2 text-xs font-medium text-white">
                          {restaurant.city}
                        </div>
                      </div>

                      <div className="mt-5 space-y-6">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Modèle de campagne</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {templates.map((item) => (
                              <PillButton key={item.id} active={item.id === selectedTemplate} onClick={() => selectTemplate(item.id)}>
                                {item.name}
                              </PillButton>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-4">
                          <label className="grid gap-2">
                            <span className="text-sm font-medium text-zinc-800">Titre de la publication</span>
                            <input
                              value={postTitle}
                              onChange={(event) => {
                                setPostTitle(event.target.value);
                                markDirty();
                              }}
                              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
                              placeholder="Écrivez un titre qui attire l'attention"
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-sm font-medium text-zinc-800">Message</span>
                            <textarea
                              value={postBody}
                              onChange={(event) => {
                                setPostBody(event.target.value);
                                markDirty();
                              }}
                              rows={5}
                              className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
                              placeholder="Décrivez votre offre, votre événement ou votre nouveauté"
                            />
                          </label>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Visuel</p>
                          <div className="mt-3 grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                            <label className="flex cursor-pointer items-center justify-center rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center transition hover:border-zinc-400 hover:bg-zinc-100">
                              <div className="space-y-2">
                                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                  <Icon path="M12 5v14m-7-7h14" className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="font-medium text-zinc-950">Importer un visuel</p>
                                  <p className="text-xs text-zinc-500">PNG, JPG, JPEG</p>
                                </div>
                              </div>
                              <input type="file" accept="image/*" className="hidden" onChange={handleMediaChange} />
                            </label>

                            <div className="overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-950">
                              <div className="relative h-40" style={{ backgroundImage: accentGradient }}>
                                {mediaUrl ? (
                                  <img src={mediaUrl} alt="Visuel de la publication" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.28),_transparent_35%)]" />
                                )}
                              </div>
                              <div className="p-4 text-white/72">
                                <p className="text-xs uppercase tracking-[0.24em] text-white/42">Aperçu visuel</p>
                                <p className="mt-2 text-sm leading-6 text-white/78">Le visuel sélectionné s'affiche ici avant publication.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Audience</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {audiences.map((item) => {
                                const active = selectedAudiences.includes(item);
                                return (
                                  <button
                                    key={item}
                                    type="button"
                                    onClick={() => toggleValue(item, selectedAudiences, setSelectedAudiences)}
                                    className={
                                      active
                                        ? "rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition"
                                        : "rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    }
                                  >
                                    {item}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Canaux</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {channels.map((item) => {
                                const active = selectedChannels.includes(item);
                                return (
                                  <button
                                    key={item}
                                    type="button"
                                    onClick={() => toggleValue(item, selectedChannels, setSelectedChannels)}
                                    className={
                                      active
                                        ? "rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition"
                                        : "rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    }
                                  >
                                    {item}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
                          <label className="grid gap-2">
                            <span className="text-sm font-medium text-zinc-800">Programmation</span>
                            <input
                              type="datetime-local"
                              value={scheduledAt}
                              onChange={(event) => {
                                setScheduledAt(event.target.value);
                                markDirty();
                              }}
                              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:bg-white"
                            />
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleSaveDraft}
                              className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
                            >
                              Enregistrer le brouillon
                            </button>
                            <button
                              type="button"
                              onClick={handlePublish}
                              className="rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800"
                            >
                              Publier maintenant
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.section>

                    <div className="space-y-6">
                      <motion.section
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="overflow-hidden rounded-[30px] border border-black/10 bg-zinc-950 text-white shadow-[0_18px_50px_rgba(0,0,0,0.08)]"
                      >
                        <div className="border-b border-white/10 p-5">
                          <p className="text-xs uppercase tracking-[0.24em] text-white/40">Live preview</p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-tight">Aperçu de diffusion</h3>
                          <p className="mt-2 text-sm leading-6 text-white/60">
                            Le rendu est aligné sur le contenu, le canal et le planning choisis.
                          </p>
                        </div>

                        <div className="p-5">
                          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#121212]">
                            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 text-sm text-white/70">
                              <div>
                                <p className="font-medium text-white">{restaurant.name}</p>
                                <p className="text-xs text-white/45">{restaurant.city} - {template.objective}</p>
                              </div>
                              <StatusBadge status={status} />
                            </div>

                            <AnimatePresence mode="wait">
                              <motion.div
                                key={mediaUrl ?? template.id}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.28 }}
                                className="relative h-56 overflow-hidden bg-zinc-900"
                              >
                                {mediaUrl ? (
                                  <img src={mediaUrl} alt="Aperçu du visuel" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full" style={{ backgroundImage: accentGradient }} />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                              </motion.div>
                            </AnimatePresence>

                            <div className="space-y-4 p-4">
                              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-white/55">
                                {selectedChannels.map((item) => (
                                  <span key={item} className="rounded-full border border-white/10 bg-white/8 px-3 py-1">
                                    {item}
                                  </span>
                                ))}
                              </div>

                              <div className="space-y-3">
                                <p className="text-xs uppercase tracking-[0.24em] text-white/38">{template.objective}</p>
                                <h4 className="text-2xl font-semibold leading-tight text-white">{postTitle}</h4>
                                <p className="text-sm leading-6 text-white/68">{postBody}</p>
                              </div>

                              <div className="flex items-center justify-between gap-3 pt-2">
                                <button type="button" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950">
                                  {template.cta}
                                </button>
                                <span className="text-xs text-white/48">Programmation: {previewDate}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.section>

                      <motion.section
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="rounded-[30px] border border-black/10 bg-white/92 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.05)] backdrop-blur"
                      >
                        <div className="flex items-center justify-between border-b border-black/8 pb-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Flux</p>
                            <h3 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">Activité récente</h3>
                          </div>
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">{selectedAudiences.length} audiences</span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {activityLog.map((item) => (
                            <div key={`${item.title}-${item.detail}`} className="flex items-start justify-between gap-4 rounded-2xl border border-black/6 bg-zinc-50 px-4 py-3">
                              <div>
                                <p className="font-medium text-zinc-950">{item.title}</p>
                                <p className="mt-1 text-sm text-zinc-500">{item.detail}</p>
                              </div>
                              <span
                                className={
                                  item.state === "Publié"
                                    ? "rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-700"
                                    : item.state === "Programmé"
                                      ? "rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white"
                                      : "rounded-full bg-amber-500/12 px-3 py-1 text-xs font-medium text-amber-700"
                                }
                              >
                                {item.state}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.section>
                    </div>
                  </div>
                </>
              )}

              {view === "Publications" && (
                <section className="rounded-[30px] border border-black/10 bg-white/92 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.05)] backdrop-blur sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/8 pb-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Bibliothèque</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Publications</h3>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                        Toutes les publications du système, enregistrées localement sur cet appareil.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={focusComposer}
                      className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      Nouvelle publication
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {(["Tous", "Brouillon", "Programmé", "Publié"] as const).map((item) => (
                      <PillButton key={item} active={filterStatus === item} onClick={() => setFilterStatus(item)}>
                        {item}
                      </PillButton>
                    ))}
                  </div>

                  <div className="mt-5 space-y-4">
                    {filteredPublications.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                          <Icon path="M6 18V6h6a4 4 0 1 1 0 8H6m6 4 6-12" className="h-5 w-5" />
                        </div>
                        <p className="mt-4 font-medium text-zinc-950">Aucune publication pour l'instant</p>
                        <p className="mt-1 text-sm text-zinc-500">Créez votre première publication depuis le dashboard.</p>
                      </div>
                    ) : (
                      filteredPublications.map((publication) => {
                        const owner = restaurants.find((item) => item.id === publication.restaurantId);
                        return (
                          <div
                            key={publication.id}
                            className="flex flex-col gap-4 rounded-[24px] border border-black/6 bg-zinc-50 p-4 sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-zinc-950">{publication.title}</p>
                                <StatusBadge status={publication.status} />
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">{publication.body}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                                  {owner ? `${owner.name} - ${owner.city}` : publication.restaurantId}
                                </span>
                                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                                  {formatDayLabel(publication.scheduledAt)} à {formatTime(publication.scheduledAt)}
                                </span>
                                {publication.channels.map((channel) => (
                                  <span key={channel} className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                                    {channel}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => resumePublication(publication)}
                                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-400"
                              >
                                Reprendre
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePublication(publication.id)}
                                className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}

              {view === "Calendrier" && (
                <section className="rounded-[30px] border border-black/10 bg-white/92 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.05)] backdrop-blur sm:p-7">
                  <div className="border-b border-black/8 pb-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Planning</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Calendrier des publications</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                      Les publications programmées et publiées, triées par date de diffusion.
                    </p>
                  </div>

                  <div className="mt-5 space-y-6">
                    {calendarGroups.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center">
                        <p className="font-medium text-zinc-950">Calendrier vide</p>
                        <p className="mt-1 text-sm text-zinc-500">Programmez une publication pour la voir apparaître ici.</p>
                      </div>
                    ) : (
                      calendarGroups.map(([day, items]) => (
                        <div key={day}>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{day}</p>
                          <div className="mt-3 space-y-3">
                            {items.map((publication) => {
                              const owner = restaurants.find((item) => item.id === publication.restaurantId);
                              return (
                                <div
                                  key={publication.id}
                                  className="flex flex-col gap-3 rounded-[20px] border border-black/6 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-zinc-950 text-white">
                                      <span className="text-sm font-semibold leading-none">{formatTime(publication.scheduledAt)}</span>
                                    </div>
                                    <div>
                                      <p className="font-medium text-zinc-950">{publication.title}</p>
                                      <p className="mt-1 text-xs text-zinc-500">
                                        {owner ? `${owner.name} - ${owner.city}` : publication.restaurantId} • {publication.objective}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <StatusBadge status={publication.status} />
                                    <button
                                      type="button"
                                      onClick={() => deletePublication(publication.id)}
                                      className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {view === "Campagnes" && (
                <section className="rounded-[30px] border border-black/10 bg-white/92 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.05)] backdrop-blur sm:p-7">
                  <div className="border-b border-black/8 pb-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Modèles</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Campagnes types</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                      Des modèles prêts à l'emploi pour démarrer une publication en un clic.
                    </p>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {templates.map((item) => (
                      <div key={item.id} className="overflow-hidden rounded-[24px] border border-black/8 bg-white">
                        <div className="relative h-32" style={{ backgroundImage: item.gradient }}>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.28),_transparent_35%)]" />
                          <div className="absolute bottom-3 left-4">
                            <p className="rounded-full bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur">{item.objective}</p>
                          </div>
                        </div>
                        <div className="p-4">
                          <p className="font-semibold text-zinc-950">{item.name}</p>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">{item.title}</p>
                          <button
                            type="button"
                            onClick={() => {
                              selectTemplate(item.id);
                              focusComposer();
                            }}
                            className="mt-4 w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                          >
                            Utiliser ce modèle
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {view === "Statistiques" && (
                <section className="rounded-[30px] border border-black/10 bg-white/92 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.05)] backdrop-blur sm:p-7">
                  <div className="border-b border-black/8 pb-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Mesures</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Statistiques par restaurant</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                      Vue d'ensemble de l'activité et de l'utilisation des canaux par établissement.
                    </p>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-4">
                      {restaurantStats.map((item) => (
                        <div key={item.id} className="rounded-[24px] border border-black/6 bg-zinc-50 p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-zinc-950">{item.name}</p>
                              <p className="mt-0.5 text-xs text-zinc-500">{item.city} - {item.category}</p>
                            </div>
                            <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white">
                              {item.count} publication{item.count > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-black/6 bg-white p-3">
                              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-400">Portée</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-950">{item.reach}</p>
                            </div>
                            <div className="rounded-2xl border border-black/6 bg-white p-3">
                              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-400">Commandes</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-950">{item.orders}</p>
                            </div>
                            <div className="rounded-2xl border border-black/6 bg-white p-3">
                              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-400">Réservations</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-950">{item.bookings}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-[24px] border border-black/6 bg-zinc-50 p-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Canaux utilisés</p>
                      <div className="mt-4 space-y-4">
                        {channelStats.map((item) => (
                          <div key={item.channel}>
                            <div className="flex items-center justify-between text-sm">
                              <p className="font-medium text-zinc-800">{item.channel}</p>
                              <p className="text-zinc-500">{item.count} publication{item.count > 1 ? "s" : ""}</p>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/8">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${item.count === 0 ? 4 : item.ratio}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 rounded-2xl bg-zinc-950 p-4 text-white">
                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Total publications</p>
                        <p className="mt-2 text-3xl font-semibold">{publications.length}</p>
                        <p className="mt-1 text-sm text-white/60">
                          {upcoming.length} en diffusion,{" "}
                          {publications.filter((item) => item.status === "Brouillon").length} en brouillon
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white shadow-[0_18px_50px_rgba(0,0,0,0.3)]"
            role="status"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
