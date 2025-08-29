/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Download, Upload, Trash2, Plus, Filter, ListFilter, Settings, ChevronRight, ChevronLeft } from "lucide-react";

// ---- Data Types ----
const TERMS = ["short", "medium", "long"] as const;
const STATUSES = ["backlog", "in_progress", "blocked", "done"] as const;

const DEFAULT_CATEGORIES = [
  { id: "career", label: "Career/Projects (Education)" },
  { id: "social", label: "Social" },
  { id: "environment", label: "Environment" },
  { id: "finance", label: "Finance" },
  { id: "health", label: "Health" },
] as const;

type Term = typeof TERMS[number];
type Status = typeof STATUSES[number];

type Item = {
  id: string;
  text: string;
  category: string; // category id
  createdAt: number;
  term?: Term;
  priority?: number; // 1-5
  status?: Status; // ticket-style
};

type Category = { id: string; label: string };

// ---- Storage Helpers ----
const LS_KEY = "brain_dump_mvp_v1";
const LS_CATS_KEY = "brain_dump_mvp_categories";

function loadState(): Item[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Item[]) : [];
  } catch {
    return [];
  }
}
function saveState(items: Item[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}
function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(LS_CATS_KEY);
    if (!raw) return [...DEFAULT_CATEGORIES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...DEFAULT_CATEGORIES];
    }
    return parsed as Category[];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

function saveCategories(cats: Category[]) {
  localStorage.setItem(LS_CATS_KEY, JSON.stringify(cats));
}

// ---- Utils ----
const uid = () => Math.random().toString(36).slice(2);
const fmtDate = (ts: number) => new Date(ts).toLocaleString();

// ---- Main App ----
export default function BrainDumpMVP() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>(DEFAULT_CATEGORIES[0].id);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kanban, setKanban] = useState<boolean>(false);
  const [filterTerm, setFilterTerm] = useState<Term | "all">("all");

  useEffect(() => {
    setItems(loadState());
    const loadedCats = loadCategories();
    setCategories(loadedCats);
    if (loadedCats.length) setActiveCat(loadedCats[0].id);
  }, []);

  useEffect(() => saveState(items), [items]);
  useEffect(() => saveCategories(categories), [categories]);

  const itemsByCat = useMemo(() => {
    const map: Record<string, Item[]> = {};
    categories.forEach((c) => (map[c.id] = []));
    items.forEach((it) => {
      if (!map[it.category]) map[it.category] = [];
      map[it.category].push(it);
    });
    // sort by created then priority desc within
    Object.keys(map).forEach((k) =>
      map[k].sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.createdAt - b.createdAt)
    );
    return map;
  }, [items, categories]);

  const activeItems = (itemsByCat[activeCat] || []).filter((i) =>
    filterTerm === "all" ? true : i.term === filterTerm
  );

  // ---- Actions ----
  const addItem = (text: string) => {
    if (!text.trim()) return;
    const item: Item = {
      id: uid(),
      text: text.trim(),
      category: activeCat,
      createdAt: Date.now(),
      status: "backlog",
    };
    setItems((prev) => [item, ...prev]);
  };

  const setItem = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const addCategory = (label: string) => {
    if (!label.trim()) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (categories.some((c) => c.id === id)) return;
    const next = [...categories, { id, label: label.trim() }];
    setCategories(next);
    setActiveCat(id);
  };

  const removeCategory = (id: string) => {
    // prevent deleting if it has items unless confirmed
    const hasItems = items.some((i) => i.category === id);
    if (hasItems && !confirm("This category has items. Delete anyway? Items will be kept but unassigned.")) return;
    if (hasItems) setItems((prev) => prev.map((i) => (i.category === id ? { ...i, category: categories[0]?.id || "uncat" } : i)));
    const next = categories.filter((c) => c.id !== id);
    setCategories(next);
    if (next.length) setActiveCat(next[0].id);
  };

  const exportJSON = () => {
    const data = { items, categories, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brain-dump-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data.items) && Array.isArray(data.categories)) {
          setItems(data.items);
          setCategories(data.categories);
          setActiveCat(data.categories[0]?.id || activeCat);
        } else {
          alert("Invalid file structure.");
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        alert("Failed to parse file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-2xl bg-zinc-900 text-white grid place-items-center">BD</div>
            <h1 className="text-2xl font-semibold">Brain Dump – MVP</h1>
            <Badge variant="secondary" className="ml-2">Local Only</Badge>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm"><ListFilter className="size-4" />
              <select className="border rounded-md px-2 py-1" value={filterTerm} onChange={(e) => setFilterTerm(e.target.value as any)}>
                <option value="all">All terms</option>
                {TERMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <Button variant="outline" onClick={exportJSON}><Download className="size-4 mr-2"/>Export</Button>
            <label className="inline-flex items-center">
              <Input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
              <Button variant="outline"><Upload className="size-4 mr-2"/>Import</Button>
            </label>
            <div className="flex items-center gap-2 pl-2 border-l">
              <Switch id="kanban" checked={kanban} onCheckedChange={setKanban} />
              <label htmlFor="kanban" className="text-sm">Ticket Board</label>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-col gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCat(c.id)}
                      className={`text-left px-3 py-2 rounded-xl border hover:shadow ${activeCat === c.id ? "bg-zinc-900 text-white" : "bg-white"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{c.label}</span>
                        <Badge variant={activeCat === c.id ? "secondary" : "outline"}>{itemsByCat[c.id]?.length || 0}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
                <AddCategory onAdd={addCategory} />
                {categories.length > 5 && (
                  <p className="text-xs text-zinc-500">Tip: You can delete custom categories from the settings below.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="size-4" />Manage
                  </CardTitle>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" title="Actions">
                        <Settings className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          if (confirm("Reset categories to defaults?")) {
                            setCategories([...DEFAULT_CATEGORIES]);
                            setActiveCat(DEFAULT_CATEGORIES[0].id);
                          }
                        }}
                      >
                        Reset categories
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (confirm("Clear ALL data (items + categories)?")) {
                            localStorage.removeItem(LS_KEY);
                            localStorage.removeItem(LS_CATS_KEY);
                            setItems([]);
                            setCategories([...DEFAULT_CATEGORIES]);
                            setActiveCat(DEFAULT_CATEGORIES[0].id);
                          }
                        }}
                      >
                        Clear all data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {categories.map((c) => (
                  !DEFAULT_CATEGORIES.find((d) => d.id === c.id) && (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{c.label}</span>
                      <Button size="icon" variant="ghost" onClick={() => removeCategory(c.id)} title="Delete">
                        <Trash2 className="size-4"/>
                      </Button>
                    </div>
                  )
                ))}
              </CardContent>
            </Card>
          </aside>

          {/* Main */}
          <main className="space-y-6">
            <Stepper step={step} setStep={setStep} />

            {step === 1 && (
              <RawInputPanel categoryLabel={categories.find((c) => c.id === activeCat)?.label || ""} onAdd={addItem} />
            )}

            {step === 2 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Step 2: Sort by Term</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {activeItems.length === 0 ? (
                    <EmptyState message="No items yet for this category. Add some in Step 1." />
                  ) : (
                    activeItems.map((it) => (
                      <ItemRow key={it.id} item={it} onChange={(patch) => setItem(it.id, patch)} onRemove={() => removeItem(it.id)} showTerm showPriority={false} />
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              !kanban ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Step 3: Prioritize</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {activeItems.length === 0 ? (
                      <EmptyState message="Nothing to prioritize. Add items first." />
                    ) : (
                      activeItems.map((it) => (
                        <ItemRow key={it.id} item={it} onChange={(patch) => setItem(it.id, patch)} onRemove={() => removeItem(it.id)} showTerm showPriority showStatus />
                      ))
                    )}
                  </CardContent>
                </Card>
              ) : (
                <KanbanBoard items={activeItems} onChange={(id, patch) => setItem(id, patch)} />
              )
            )}

            {/* List View (always visible for quick glance) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">Overview <Filter className="size-4"/></CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all">
                  <TabsList className="flex flex-wrap">
                    <TabsTrigger value="all">All</TabsTrigger>
                    {TERMS.map((t) => (
                      <TabsTrigger key={t} value={t}>{t}</TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value="all"><OverviewList items={activeItems} /></TabsContent>
                  {TERMS.map((t) => (
                    <TabsContent key={t} value={t}>
                      <OverviewList items={activeItems.filter((i) => i.term === t)} />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}

// ---- Components ----
function Stepper({ step, setStep }: { step: 1 | 2 | 3; setStep: (s: 1 | 2 | 3) => void }) {
  const steps = [
    { n: 1, label: "Dump" },
    { n: 2, label: "Sort" },
    { n: 3, label: "Prioritize" },
  ] as const;
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => setStep((Math.max(1, step - 1) as 1 | 2 | 3))}><ChevronLeft className="size-4"/></Button>
      <div className="flex items-center gap-3">
        {steps.map((s, idx) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`size-8 grid place-items-center rounded-full border ${step === s.n ? "bg-zinc-900 text-white" : "bg-white"}`}>{s.n}</div>
            <span className={`text-sm ${step === s.n ? "font-semibold" : "text-zinc-600"}`}>{s.label}</span>
            {idx < steps.length - 1 && <ChevronRight className="size-4 text-zinc-400"/>}
          </div>
        ))}
      </div>
      <Button variant="outline" size="icon" onClick={() => setStep((Math.min(3, step + 1) as 1 | 2 | 3))}><ChevronRight className="size-4"/></Button>
    </div>
  );
}

function RawInputPanel({ categoryLabel, onAdd }: { categoryLabel: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  const [count, setCount] = useState(0);
  const [bulk, setBulk] = useState("");

  const addOne = () => {
    onAdd(text);
    if (text.trim()) setCount((c) => c + 1);
    setText("");
  };

  const addBulk = () => {
    const lines = bulk.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    lines.forEach(onAdd);
    setCount((c) => c + lines.length);
    setBulk("");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Step 1: Brain Dump – {categoryLabel}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
         <label className="text-sm text-zinc-600">Quick add</label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addOne();
            }}
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a thought/task and hit Enter"
            />
            <Button type="submit"><Plus className="size-4 mr-2" />Add</Button>
          </form>
          <p className="text-xs text-zinc-500">Captured this session: {count}</p>
        </div>
        <div className="grid gap-2">
          <label className="text-sm text-zinc-600">Bulk paste (one per line)</label>
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                addBulk();
              }
            }}
            placeholder="Paste a list here (one per line). Ctrl/Cmd+Enter to add."
            rows={5}
          />
          <div className="flex justify-end"><Button variant="secondary" onClick={addBulk}>Add List</Button></div>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemRow({ item, onChange, onRemove, showTerm, showPriority, showStatus }: { item: Item; onChange: (patch: Partial<Item>) => void; onRemove: () => void; showTerm?: boolean; showPriority?: boolean; showStatus?: boolean; }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-white p-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline">{fmtDate(item.createdAt)}</Badge>
          {item.term && <Badge variant="secondary">{item.term}</Badge>}
          {typeof item.priority === "number" && <Badge variant="secondary">P{item.priority}</Badge>}
          {item.status && <Badge className="capitalize" variant="outline">{item.status.replace("_", " ")}</Badge>}
        </div>
        <div className="whitespace-pre-wrap">{item.text}</div>
      </div>
      <div className="flex flex-col gap-2 min-w-52">
        {showTerm && (
          <div className="px-2 py-1 rounded-md border bg-white">
            <label className="text-xs text-zinc-600">Term</label>
            <select
              className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
              value={item.term ?? ""}
              onChange={(e) =>
                onChange({ term: (e.target.value || undefined) as Term | undefined })
              }
            >
              <option value="">— set term —</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
        {showPriority && (
          <div className="px-2 py-1 rounded-md border">
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Priority</span>
              <span>{item.priority ?? 0}</span>
            </div>
            <Slider defaultValue={[item.priority ?? 0]} max={5} step={1} onValueChange={(v) => onChange({ priority: v[0] })} />
          </div>
        )}
        {showStatus && (
          <div className="px-2 py-1 rounded-md border bg-white">
            <label className="text-xs text-zinc-600">Status</label>
            <select
              className="mt-1 w-full rounded-md border px-2 py-1 text-sm capitalize"
              value={item.status ?? ""}
              onChange={(e) =>
                onChange({ status: (e.target.value || undefined) as Status | undefined })
              }
            >
              <option value="">— set status —</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={onRemove} title="Delete item"><Trash2 className="size-4"/></Button>
      </div>
    </div>
  );
}

function OverviewList({ items }: { items: Item[] }) {
  if (items.length === 0) return <EmptyState message="No items to show." />;
  return (
    <div className="grid gap-2">
      {items.map((it) => (
        <div key={it.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            {it.term && <Badge variant="secondary">{it.term}</Badge>}
            {typeof it.priority === "number" && <Badge variant="outline">P{it.priority}</Badge>}
            {it.status && <Badge className="capitalize" variant="outline">{it.status.replace("_", " ")}</Badge>}
            <span>{it.text}</span>
          </div>
          <span className="text-xs text-zinc-500">{fmtDate(it.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

function KanbanBoard({ items, onChange }: { items: Item[]; onChange: (id: string, patch: Partial<Item>) => void }) {
  const grouped = useMemo(() => {
    const g: Record<Status, Item[]> = { backlog: [], in_progress: [], blocked: [], done: [] };
    items.forEach((i) => g[(i.status as Status) || "backlog"].push(i));
    return g;
  }, [items]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {STATUSES.map((s) => (
        <Card key={s} className="min-h-[220px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm capitalize">{s.replace("_", " ")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {grouped[s].length === 0 ? (
              <EmptyState small message="No cards" />
            ) : (
              grouped[s].map((it) => (
                <div key={it.id} className="rounded-lg border bg-white p-2">
                  <div className="text-sm mb-1">{it.text}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {it.term && <Badge variant="secondary">{it.term}</Badge>}
                      {typeof it.priority === "number" && <Badge variant="outline">P{it.priority}</Badge>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">Move</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {STATUSES.map((dest) => (
                          <DropdownMenuItem key={dest} className="capitalize" onClick={() => onChange(it.id, { status: dest })}>{dest.replace("_", " ")}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AddCategory({ onAdd }: { onAdd: (label: string) => void }) {
  const [label, setLabel] = useState("");
  return (
    <div className="flex gap-2">
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add category" />
      <Button onClick={() => { onAdd(label); setLabel(""); }}><Plus className="size-4"/></Button>
    </div>
  );
}

function EmptyState({ message, small }: { message: string; small?: boolean }) {
  return (
    <div className={`text-center ${small ? "text-xs" : "text-sm"} text-zinc-500 py-6`}>{message}</div>
  );
}
