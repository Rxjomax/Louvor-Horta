import {
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  Filter,
  LayoutGrid,
  ListMusic,
  Plus,
  Settings2,
  Table2,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ScheduleEntry, ScheduleRole, ScheduleState } from '../types/music';
import { buildWhatsAppShareUrl } from '../utils/setlist';

interface ScheduleViewProps {
  schedule: ScheduleState;
  onUpdateSchedule: (
    updater: (prev: ScheduleState) => ScheduleState
  ) => void;
  onUseInCultoDoDia: (entry: ScheduleEntry) => void;
}

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export function formatScheduleWhatsApp(
  entries: ScheduleEntry[],
  roles: ScheduleRole[],
  filterMonth: string,
  filterMember: string
): string {
  const titleSuffix =
    filterMonth !== 'Todos' ? ` — ${filterMonth}` : ' — Geral';
  const memberSuffix =
    filterMember !== 'Todos' ? ` (${filterMember})` : '';
  const lines: string[] = [
    `*Louvor IEB Horta*`,
    `*Escala do Grupo de Louvor${titleSuffix}${memberSuffix}*`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('Nenhuma data registada para este filtro.');
    return lines.join('\n');
  }

  for (const entry of entries) {
    const headerParts = [`*${entry.month} · Dia ${entry.day || '—'}*`];
    if (entry.theme.trim()) headerParts.push(`_${entry.theme.trim()}_`);
    if (entry.passage.trim()) headerParts.push(`(${entry.passage.trim()})`);
    lines.push(headerParts.join(' — '));

    const assignedLines: string[] = [];
    for (const role of roles) {
      const person = (entry.assignments[role.id] ?? '').trim();
      if (person) {
        assignedLines.push(`  • ${role.label}: *${person}*`);
      }
    }
    if (assignedLines.length > 0) {
      lines.push(...assignedLines);
    } else {
      lines.push('  • (Sem elementos definidos)');
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function ScheduleView({
  schedule,
  onUpdateSchedule,
  onUseInCultoDoDia,
}: ScheduleViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
  const [selectedDay, setSelectedDay] = useState<string>('Todas');
  const [selectedMember, setSelectedMember] = useState<string>('Todos');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table'
  );
  const [showManagePanel, setShowManagePanel] = useState<boolean>(false);

  // Inputs for managing team members & roles/locations
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newRoleLabel, setNewRoleLabel] = useState<string>('');
  const [generatorMonth, setGeneratorMonth] = useState<string>('Dezembro');
  const [copied, setCopied] = useState<boolean>(false);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const e of schedule.entries) {
      if (e.month.trim()) set.add(e.month.trim());
    }
    return Array.from(set);
  }, [schedule.entries]);

  const availableDays = useMemo(() => {
    const set = new Set<string>();
    for (const e of schedule.entries) {
      if (selectedMonth !== 'Todos' && e.month !== selectedMonth) continue;
      if (e.day.trim()) set.add(e.day.trim());
    }
    return Array.from(set);
  }, [schedule.entries, selectedMonth]);

  const filteredEntries = useMemo(() => {
    return schedule.entries.filter((entry) => {
      if (selectedMonth !== 'Todos' && entry.month !== selectedMonth) {
        return false;
      }
      if (selectedDay !== 'Todas' && entry.day !== selectedDay) {
        return false;
      }
      if (selectedMember !== 'Todos') {
        const hasMember = Object.values(entry.assignments).some(
          (val) =>
            val.trim().toLowerCase() === selectedMember.trim().toLowerCase()
        );
        if (!hasMember) return false;
      }
      return true;
    });
  }, [schedule.entries, selectedMonth, selectedDay, selectedMember]);

  const whatsAppMessage = useMemo(
    () =>
      formatScheduleWhatsApp(
        filteredEntries,
        schedule.roles,
        selectedMonth,
        selectedMember
      ),
    [filteredEntries, schedule.roles, selectedMonth, selectedMember]
  );

  const whatsAppUrl = useMemo(
    () => buildWhatsAppShareUrl(whatsAppMessage),
    [whatsAppMessage]
  );

  const handleUpdateEntryField = (
    entryId: string,
    field: 'month' | 'day' | 'passage' | 'theme',
    value: string
  ) => {
    onUpdateSchedule((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        e.id === entryId ? { ...e, [field]: value } : e
      ),
    }));
  };

  const handleUpdateAssignment = (
    entryId: string,
    roleId: string,
    memberName: string
  ) => {
    onUpdateSchedule((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              assignments: {
                ...e.assignments,
                [roleId]: memberName,
              },
            }
          : e
      ),
    }));
  };

  const handleAddEntry = () => {
    const defaultMonth =
      selectedMonth !== 'Todos'
        ? selectedMonth
        : schedule.entries[schedule.entries.length - 1]?.month || 'Novembro';

    const emptyAssignments: Record<string, string> = {};
    for (const role of schedule.roles) {
      emptyAssignments[role.id] = '';
    }

    const newEntry: ScheduleEntry = {
      id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      month: defaultMonth,
      day: '',
      passage: '',
      theme: '',
      assignments: emptyAssignments,
    };

    onUpdateSchedule((prev) => ({
      ...prev,
      entries: [...prev.entries, newEntry],
    }));
  };

  const handleGenerateSundaysForMonth = () => {
    const monthIndex = MONTHS_PT.indexOf(
      generatorMonth as (typeof MONTHS_PT)[number]
    );
    const year = new Date().getFullYear();
    const targetMonthIdx = monthIndex >= 0 ? monthIndex : 10;

    const sundays: number[] = [];
    const date = new Date(year, targetMonthIdx, 1);
    while (date.getMonth() === targetMonthIdx) {
      if (date.getDay() === 0) {
        sundays.push(date.getDate());
      }
      date.setDate(date.getDate() + 1);
    }

    onUpdateSchedule((prev) => {
      const existingDaysInMonth = new Set(
        prev.entries
          .filter((e) => e.month === generatorMonth)
          .map((e) => e.day.trim())
      );

      const newRows: ScheduleEntry[] = [];
      for (const dayNum of sundays) {
        if (existingDaysInMonth.has(String(dayNum))) continue;
        const emptyAssignments: Record<string, string> = {};
        for (const r of prev.roles) {
          emptyAssignments[r.id] = '';
        }
        newRows.push({
          id: `sched-${generatorMonth.toLowerCase()}-${dayNum}-${Date.now()}`,
          month: generatorMonth,
          day: String(dayNum),
          passage: '',
          theme: '',
          assignments: emptyAssignments,
        });
      }

      return {
        ...prev,
        entries: [...prev.entries, ...newRows],
      };
    });

    setSelectedMonth(generatorMonth);
    setSelectedDay('Todas');
  };

  const handleDeleteEntry = (entryId: string) => {
    onUpdateSchedule((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== entryId),
    }));
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    onUpdateSchedule((prev) => {
      if (
        prev.members.some((m) => m.toLowerCase() === trimmed.toLowerCase())
      ) {
        return prev;
      }
      return {
        ...prev,
        members: [...prev.members, trimmed],
      };
    });
    setNewMemberName('');
  };

  const handleRemoveMember = (member: string) => {
    onUpdateSchedule((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m !== member),
    }));
    if (selectedMember === member) {
      setSelectedMember('Todos');
    }
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newRoleLabel.trim();
    if (!trimmed) return;
    const roleId = `role-${trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .toLowerCase()}-${Date.now().toString(36).slice(-3)}`;

    onUpdateSchedule((prev) => ({
      ...prev,
      roles: [...prev.roles, { id: roleId, label: trimmed }],
    }));
    setNewRoleLabel('');
  };

  const handleRemoveRole = (roleId: string) => {
    onUpdateSchedule((prev) => ({
      ...prev,
      roles: prev.roles.filter((r) => r.id !== roleId),
    }));
  };

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsAppMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = whatsAppMessage;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  return (
    <section
      aria-labelledby="schedule-heading"
      className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-12"
    >
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1
            id="schedule-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
          >
            Escala do Louvor
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Organize quem participa em cada data, passagem, tema e função no grupo de louvor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowManagePanel((prev) => !prev)}
            aria-expanded={showManagePanel}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85414] dark:focus-visible:ring-amber-500 ${
              showManagePanel
                ? 'border-[#386641] bg-[#386641] text-white dark:border-emerald-500 dark:bg-emerald-600'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Settings2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Equipa e Funções</span>
          </button>

          <button
            type="button"
            onClick={handleAddEntry}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-[#386641] hover:bg-[#2d5334] dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#386641] dark:focus-visible:ring-amber-400"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Nova Data</span>
          </button>
        </div>
      </div>

      {/* Expandable Team Members & Roles/Locations Configuration Panel */}
      {showManagePanel && (
        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Team Members */}
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#386641] dark:text-amber-400" aria-hidden="true" />
              <span>Elementos do Grupo ({schedule.members.length})</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Nomes disponíveis para seleção rápida na escala.
            </p>

            <form onSubmit={handleAddMember} className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Ex: Lucas, Ana..."
                aria-label="Nome do novo elemento"
                className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500"
              />
              <button
                type="submit"
                className="min-h-[44px] px-3 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1 hover:bg-slate-800 shrink-0"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>Adicionar</span>
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {schedule.members.map((member) => (
                <span
                  key={member}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                >
                  <span>{member}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member)}
                    aria-label={`Remover elemento ${member}`}
                    className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Roles / Instrument Locations */}
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Settings2 className="w-4 h-4 text-[#386641] dark:text-amber-400" aria-hidden="true" />
              <span>Locais / Funções ({schedule.roles.length})</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Colunas da escala (ex: Ordem de Culto, Voz, Guitarra, Teclado, Som).
            </p>

            <form onSubmit={handleAddRole} className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
                placeholder="Ex: Teclado, Baixo, Som..."
                aria-label="Nome da nova função ou instrumento"
                className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500"
              />
              <button
                type="submit"
                className="min-h-[44px] px-3 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1 hover:bg-slate-800 shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Criar</span>
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {schedule.roles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-emerald-50 dark:bg-slate-800 text-xs font-semibold text-[#2d5334] dark:text-emerald-300 border border-emerald-200 dark:border-slate-700"
                >
                  <span>{role.label}</span>
                  {schedule.roles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(role.id)}
                      aria-label={`Remover coluna ${role.label}`}
                      className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Month Sundays Generator */}
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <CalendarPlus className="w-4 h-4 text-[#386641] dark:text-amber-400" aria-hidden="true" />
              <span>Preencher Domingos do Mês</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Adiciona automaticamente todos os domingos do mês escolhido.
            </p>

            <div className="mt-2.5 flex gap-2">
              <select
                value={generatorMonth}
                onChange={(e) => setGeneratorMonth(e.target.value)}
                aria-label="Selecionar mês para gerar domingos"
                className="flex-1 min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500"
              >
                {MONTHS_PT.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleGenerateSundaysForMonth}
                className="min-h-[44px] px-3.5 rounded-lg bg-[#386641] hover:bg-[#2d5334] dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
              >
                <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                <span>Gerar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar: Month, Day, Member Filter & View Switcher */}
      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Month & Day Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5 text-[#386641] dark:text-amber-400" aria-hidden="true" />
              <span>Mês:</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDay('Todas');
              }}
              aria-label="Filtrar por mês"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500"
            >
              <option value="Todos">Todos os meses</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">
              <span>Data:</span>
            </div>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              aria-label="Filtrar por dia"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500"
            >
              <option value="Todas">Todas</option>
              {availableDays.map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </select>
          </div>

          {/* Table vs Cards View Toggle */}
          <div
            role="group"
            aria-label="Modo de visualização da escala"
            className="inline-flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-950 text-[#386641] dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Table2 className="w-4 h-4" aria-hidden="true" />
              <span>Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-950 text-[#386641] dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
              <span>Cartões</span>
            </button>
          </div>
        </div>

        {/* Member Quick Filter Chips */}
        <div
          role="group"
          aria-label="Filtrar escala por elemento"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1"
        >
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 shrink-0">
            Elemento:
          </span>
          {['Todos', ...schedule.members].map((member) => {
            const active = selectedMember === member;
            return (
              <button
                key={member}
                type="button"
                onClick={() => setSelectedMember(member)}
                aria-pressed={active}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#386641] dark:focus-visible:ring-amber-500 ${
                  active
                    ? 'bg-[#386641] dark:bg-amber-500 text-white dark:text-slate-950'
                    : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {member}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Schedule Display: Spreadsheet Table OR Mobile Cards */}
      {viewMode === 'table' ? (
        <div className="mt-4 rounded-2xl border border-[#386641]/30 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table
              aria-label="Tabela da escala do grupo de louvor"
              className="w-full border-collapse text-left text-sm"
            >
              <thead>
                <tr className="bg-[#3E6B48] dark:bg-slate-800 text-white border-b border-[#2d5334] dark:border-slate-700">
                  <th className="py-3 px-2.5 font-bold text-xs uppercase tracking-wider border-r border-white/15 min-w-[132px]">
                    Mês
                  </th>
                  <th className="py-3 px-2 font-bold text-xs uppercase tracking-wider text-center border-r border-white/15 w-14">
                    Data
                  </th>
                  <th className="py-3 px-2.5 font-bold text-xs uppercase tracking-wider border-r border-white/15 min-w-[130px]">
                    Passagem
                  </th>
                  <th className="py-3 px-2.5 font-bold text-xs uppercase tracking-wider border-r border-white/15 min-w-[165px]">
                    Tema
                  </th>
                  {schedule.roles.map((role) => (
                    <th
                      key={role.id}
                      className="py-3 px-2 font-bold text-xs uppercase tracking-wider text-center border-r border-white/15 min-w-[112px]"
                    >
                      {role.label}
                    </th>
                  ))}
                  <th className="py-3 px-2 font-bold text-xs uppercase tracking-wider text-center w-20">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c8dec4] dark:divide-slate-800">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5 + schedule.roles.length}
                      className="py-10 px-4 text-center text-slate-500 dark:text-slate-400"
                    >
                      Nenhuma data encontrada para o filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry, rowIdx) => {
                    const isEven = rowIdx % 2 === 0;
                    return (
                      <tr
                        key={entry.id}
                        className={
                          isEven
                            ? 'bg-[#DFEDE0]/75 dark:bg-slate-900/90 hover:bg-[#d3e6d5] dark:hover:bg-slate-800/70 transition-colors'
                            : 'bg-[#EEF6EE]/85 dark:bg-slate-900/40 hover:bg-[#d3e6d5] dark:hover:bg-slate-800/70 transition-colors'
                        }
                      >
                        {/* Mês */}
                        <td className="p-1.5 border-r border-[#c8dec4] dark:border-slate-800">
                          <select
                            value={entry.month}
                            onChange={(e) =>
                              handleUpdateEntryField(
                                entry.id,
                                'month',
                                e.target.value
                              )
                            }
                            aria-label={`Mês da linha ${rowIdx + 1}`}
                            className="w-full min-h-[38px] px-2 rounded-lg bg-transparent hover:bg-white/70 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-950 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500"
                          >
                            {MONTHS_PT.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Data */}
                        <td className="p-1.5 border-r border-[#c8dec4] dark:border-slate-800">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={entry.day}
                            onChange={(e) =>
                              handleUpdateEntryField(
                                entry.id,
                                'day',
                                e.target.value
                              )
                            }
                            placeholder="Dia"
                            aria-label={`Dia do culto (${entry.month})`}
                            className="w-full min-h-[38px] px-1.5 text-center rounded-lg bg-transparent hover:bg-white/70 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-950 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500"
                          />
                        </td>

                        {/* Passagem */}
                        <td className="p-1.5 border-r border-[#c8dec4] dark:border-slate-800">
                          <input
                            type="text"
                            value={entry.passage}
                            onChange={(e) =>
                              handleUpdateEntryField(
                                entry.id,
                                'passage',
                                e.target.value
                              )
                            }
                            placeholder="Ex: Atos 8:25-40"
                            aria-label={`Passagem bíblica do dia ${entry.day}`}
                            className="w-full min-h-[38px] px-2 text-center rounded-lg bg-transparent hover:bg-white/70 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-950 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400/80 focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500"
                          />
                        </td>

                        {/* Tema */}
                        <td className="p-1.5 border-r border-[#c8dec4] dark:border-slate-800">
                          <input
                            type="text"
                            value={entry.theme}
                            onChange={(e) =>
                              handleUpdateEntryField(
                                entry.id,
                                'theme',
                                e.target.value
                              )
                            }
                            placeholder="Tema do culto"
                            aria-label={`Tema do culto do dia ${entry.day}`}
                            className="w-full min-h-[38px] px-2 text-center rounded-lg bg-transparent hover:bg-white/70 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-950 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400/80 focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500"
                          />
                        </td>

                        {/* Role Assignments */}
                        {schedule.roles.map((role) => {
                          const assigned = entry.assignments[role.id] ?? '';
                          const isHighlighted =
                            selectedMember !== 'Todos' &&
                            assigned.trim().toLowerCase() ===
                              selectedMember.trim().toLowerCase();

                          const memberOptions =
                            assigned && !schedule.members.includes(assigned)
                              ? [assigned, ...schedule.members]
                              : schedule.members;

                          return (
                            <td
                              key={role.id}
                              className="p-1.5 border-r border-[#c8dec4] dark:border-slate-800"
                            >
                              <select
                                value={assigned}
                                onChange={(e) =>
                                  handleUpdateAssignment(
                                    entry.id,
                                    role.id,
                                    e.target.value
                                  )
                                }
                                aria-label={`${role.label} no dia ${entry.day || rowIdx + 1}`}
                                className={`w-full min-h-[38px] px-2 text-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#386641] dark:focus:ring-amber-500 ${
                                  isHighlighted
                                    ? 'bg-[#386641] text-white dark:bg-amber-500 dark:text-slate-950 font-bold'
                                    : assigned
                                      ? 'bg-transparent hover:bg-white/70 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100'
                                      : 'bg-transparent hover:bg-white/70 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                <option value="">—</option>
                                {memberOptions.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}

                        {/* Row Actions */}
                        <td className="p-1.5 text-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onUseInCultoDoDia(entry)}
                              title="Utilizar esta data no Culto do Dia"
                              aria-label={`Preparar repertório para o dia ${entry.day} de ${entry.month}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#386641] dark:text-amber-400 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors"
                            >
                              <ListMusic className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              title="Remover linha da escala"
                              aria-label={`Remover escala do dia ${entry.day} de ${entry.month}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Mobile-friendly Cards View (Zero Horizontal Scroll) */
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((entry, idx) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-[#386641]/30 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
            >
              {/* Card Green Header */}
              <div className="bg-[#3E6B48] dark:bg-slate-800 px-4 py-3 text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={entry.month}
                    onChange={(e) =>
                      handleUpdateEntryField(entry.id, 'month', e.target.value)
                    }
                    aria-label="Mês do culto"
                    className="min-h-[36px] px-2 rounded-lg bg-white/15 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    {MONTHS_PT.map((m) => (
                      <option key={m} value={m} className="text-slate-900">
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="text-white/70">·</span>
                  <div className="inline-flex items-center gap-1">
                    <span className="text-xs uppercase tracking-wider text-white/80">
                      Dia
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={entry.day}
                      onChange={(e) =>
                        handleUpdateEntryField(entry.id, 'day', e.target.value)
                      }
                      aria-label="Dia do culto"
                      className="w-12 min-h-[36px] px-1.5 text-center rounded-lg bg-white/15 text-white font-bold text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUseInCultoDoDia(entry)}
                    className="min-h-[36px] px-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <ListMusic className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Culto do Dia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(entry.id)}
                    aria-label={`Remover dia ${entry.day}`}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-rose-600/80"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Passage & Theme */}
              <div className="p-4 bg-[#EEF6EE]/60 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Passagem
                  </label>
                  <input
                    type="text"
                    value={entry.passage}
                    onChange={(e) =>
                      handleUpdateEntryField(
                        entry.id,
                        'passage',
                        e.target.value
                      )
                    }
                    placeholder="Ex: Atos 8:25-40"
                    className="mt-1 w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tema
                  </label>
                  <input
                    type="text"
                    value={entry.theme}
                    onChange={(e) =>
                      handleUpdateEntryField(entry.id, 'theme', e.target.value)
                    }
                    placeholder="Ex: Ceia e baptismo"
                    className="mt-1 w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Role Assignments Grid */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {schedule.roles.map((role) => {
                  const assigned = entry.assignments[role.id] ?? '';
                  const isHighlighted =
                    selectedMember !== 'Todos' &&
                    assigned.trim().toLowerCase() ===
                      selectedMember.trim().toLowerCase();

                  const memberOptions =
                    assigned && !schedule.members.includes(assigned)
                      ? [assigned, ...schedule.members]
                      : schedule.members;

                  return (
                    <div key={role.id}>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                        {role.label}
                      </label>
                      <select
                        value={assigned}
                        onChange={(e) =>
                          handleUpdateAssignment(
                            entry.id,
                            role.id,
                            e.target.value
                          )
                        }
                        aria-label={`${role.label} no culto ${idx + 1}`}
                        className={`mt-1 w-full min-h-[42px] px-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                          isHighlighted
                            ? 'border-[#386641] bg-[#386641] text-white dark:border-amber-400 dark:bg-amber-500 dark:text-slate-950'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <option value="">— Vazio —</option>
                        {memberOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* WhatsApp Schedule Share Card */}
      <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Partilhar Escala no WhatsApp
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Partilha a escala filtrada acima com as datas, temas e funções de cada elemento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={filteredEntries.length === 0}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>Escala Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  <span>Copiar Escala</span>
                </>
              )}
            </button>

            <a
              href={filteredEntries.length > 0 ? whatsAppUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={filteredEntries.length === 0}
              onClick={(e) => {
                if (filteredEntries.length === 0) e.preventDefault();
              }}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                filteredEntries.length === 0
                  ? 'bg-emerald-600/40 text-white/70 pointer-events-none'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span>Partilhar no WhatsApp</span>
            </a>
          </div>
        </div>

        <pre
          aria-label="Pré-visualização da escala para o WhatsApp"
          className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-cifra text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed max-h-60 overflow-y-auto"
        >
          {whatsAppMessage}
        </pre>
      </div>
    </section>
  );
}
