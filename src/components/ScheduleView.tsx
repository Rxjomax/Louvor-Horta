import {
  CalendarPlus,
  Check,
  Copy,
  Download,
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
import { downloadSchedulePdf } from '../utils/pdfExport';
import { buildWhatsAppShareUrl } from '../utils/setlist';
import { BufferedInput } from './BufferedTextFields';

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
  const [pdfSaved, setPdfSaved] = useState<boolean>(false);

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

  const handleDownloadSchedulePdf = () => {
    if (filteredEntries.length === 0) return;
    downloadSchedulePdf(filteredEntries, schedule.roles, {
      month: selectedMonth,
      day: selectedDay,
      member: selectedMember,
    });
    setPdfSaved(true);
    setTimeout(() => setPdfSaved(false), 2500);
  };

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
      <div className="pb-4 border-b border-[#D7E2F0] dark:border-[#1F3B68] flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1
            id="schedule-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1D3A] dark:text-[#F4F8FC]"
          >
            Escala do Louvor
          </h1>
          <p className="mt-1 text-sm sm:text-base text-[#465B78] dark:text-[#9BB2CE]">
            Organize quem participa em cada data, passagem, tema e função no grupo de louvor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowManagePanel((prev) => !prev)}
            aria-expanded={showManagePanel}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
              showManagePanel
                ? 'border-[#1668A3] bg-[#1668A3] text-white dark:border-[#75C2F6] dark:bg-[#75C2F6] dark:text-[#0B1D3A]'
                : 'border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#11264A] text-[#0B1D3A] dark:text-[#F4F8FC] hover:bg-[#EAF1F8] dark:hover:bg-[#153463]'
            }`}
          >
            <Settings2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Equipa e Funções</span>
          </button>

          <button
            type="button"
            onClick={handleAddEntry}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-[#10284F] hover:bg-[#183A6E] dark:bg-[#E4B84F] dark:hover:bg-[#EBC467] text-white dark:text-[#0B1D3A] text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Nova Data</span>
          </button>
        </div>
      </div>

      {/* Expandable Team Members & Roles/Locations Configuration Panel */}
      {showManagePanel && (
        <div className="mt-4 rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Team Members */}
          <div>
            <h2 className="text-sm font-bold text-[#0B1D3A] dark:text-[#F4F8FC] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#1668A3] dark:text-[#E4B84F]" aria-hidden="true" />
              <span>Elementos do Grupo ({schedule.members.length})</span>
            </h2>
            <p className="mt-0.5 text-xs text-[#526886] dark:text-[#9BB2CE]">
              Nomes disponíveis para seleção rápida na escala.
            </p>

            <form onSubmit={handleAddMember} className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Ex: Lucas, Ana..."
                aria-label="Nome do novo elemento"
                className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg border border-[#C6D6E8] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#08162E] text-sm text-[#0B1D3A] dark:text-[#F4F8FC] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
              />
              <button
                type="submit"
                className="min-h-[44px] px-3 rounded-lg bg-[#10284F] dark:bg-[#1B3C71] text-white text-xs font-semibold inline-flex items-center gap-1 hover:bg-[#183A6E] shrink-0"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>Adicionar</span>
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {schedule.members.map((member) => (
                <span
                  key={member}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-[#EDF4FB] dark:bg-[#0B1D3A] text-xs font-semibold text-[#10284F] dark:text-[#F4F8FC] border border-[#D7E2F0] dark:border-[#284A7F]"
                >
                  <span>{member}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member)}
                    aria-label={`Remover elemento ${member}`}
                    className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-[#6B82A0] hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Roles / Instrument Locations */}
          <div>
            <h2 className="text-sm font-bold text-[#0B1D3A] dark:text-[#F4F8FC] flex items-center gap-1.5">
              <Settings2 className="w-4 h-4 text-[#1668A3] dark:text-[#E4B84F]" aria-hidden="true" />
              <span>Locais / Funções ({schedule.roles.length})</span>
            </h2>
            <p className="mt-0.5 text-xs text-[#526886] dark:text-[#9BB2CE]">
              Colunas da escala (ex: Ordem de Culto, Voz, Guitarra, Teclado, Som).
            </p>

            <form onSubmit={handleAddRole} className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
                placeholder="Ex: Teclado, Baixo, Som..."
                aria-label="Nome da nova função ou instrumento"
                className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg border border-[#C6D6E8] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#08162E] text-sm text-[#0B1D3A] dark:text-[#F4F8FC] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
              />
              <button
                type="submit"
                className="min-h-[44px] px-3 rounded-lg bg-[#10284F] dark:bg-[#1B3C71] text-white text-xs font-semibold inline-flex items-center gap-1 hover:bg-[#183A6E] shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Criar</span>
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {schedule.roles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-[#EAF4FC] dark:bg-[#0B1D3A] text-xs font-semibold text-[#1668A3] dark:text-[#75C2F6] border border-[#BBD9F0] dark:border-[#284A7F]"
                >
                  <span>{role.label}</span>
                  {schedule.roles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(role.id)}
                      aria-label={`Remover coluna ${role.label}`}
                      className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-[#6B82A0] hover:text-rose-600 dark:hover:text-rose-400"
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
            <h2 className="text-sm font-bold text-[#0B1D3A] dark:text-[#F4F8FC] flex items-center gap-1.5">
              <CalendarPlus className="w-4 h-4 text-[#8F620B] dark:text-[#E4B84F]" aria-hidden="true" />
              <span>Preencher Domingos do Mês</span>
            </h2>
            <p className="mt-0.5 text-xs text-[#526886] dark:text-[#9BB2CE]">
              Adiciona automaticamente todos os domingos do mês escolhido.
            </p>

            <div className="mt-2.5 flex gap-2">
              <select
                value={generatorMonth}
                onChange={(e) => setGeneratorMonth(e.target.value)}
                aria-label="Selecionar mês para gerar domingos"
                className="flex-1 min-h-[44px] px-3 rounded-lg border border-[#C6D6E8] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#08162E] text-sm font-medium text-[#0B1D3A] dark:text-[#F4F8FC] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
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
                className="min-h-[44px] px-3.5 rounded-lg bg-[#1668A3] hover:bg-[#125587] dark:bg-[#E4B84F] dark:hover:bg-[#EBC467] text-white dark:text-[#0B1D3A] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
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
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#465B78] dark:text-[#9BB2CE]">
              <Filter className="w-3.5 h-3.5 text-[#1668A3] dark:text-[#E4B84F]" aria-hidden="true" />
              <span>Mês:</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDay('Todas');
              }}
              aria-label="Filtrar por mês"
              className="min-h-[44px] px-3 rounded-xl border border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#11264A] text-sm font-semibold text-[#0B1D3A] dark:text-[#F4F8FC] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
            >
              <option value="Todos">Todos os meses</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#465B78] dark:text-[#9BB2CE] ml-1">
              <span>Data:</span>
            </div>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              aria-label="Filtrar por dia"
              className="min-h-[44px] px-3 rounded-xl border border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#11264A] text-sm font-semibold text-[#0B1D3A] dark:text-[#F4F8FC] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
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
            className="inline-flex items-center p-1 rounded-xl bg-[#E4EEF9] dark:bg-[#08162E] border border-[#D7E2F0] dark:border-[#1F3B68]"
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#153463] text-[#10284F] dark:text-[#E4B84F] shadow-xs'
                  : 'text-[#465B78] dark:text-[#9BB2CE] hover:text-[#0B1D3A] dark:hover:text-white'
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
                  ? 'bg-white dark:bg-[#153463] text-[#10284F] dark:text-[#E4B84F] shadow-xs'
                  : 'text-[#465B78] dark:text-[#9BB2CE] hover:text-[#0B1D3A] dark:hover:text-white'
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
          <span className="text-xs font-semibold text-[#526886] dark:text-[#9BB2CE] mr-1 shrink-0">
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
                className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                  active
                    ? 'bg-[#10284F] dark:bg-[#E4B84F] text-white dark:text-[#0B1D3A]'
                    : 'bg-white dark:bg-[#11264A] text-[#243B5A] dark:text-[#C4D5EB] border border-[#D7E2F0] dark:border-[#1F3B68] hover:bg-[#EAF1F8] dark:hover:bg-[#153463]'
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
        <div className="mt-4 rounded-2xl border border-[#C6D6E8] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table
              aria-label="Tabela da escala do grupo de louvor"
              className="w-full border-collapse text-left text-sm"
            >
              <thead>
                <tr className="bg-[#10284F] dark:bg-[#153463] text-white border-b border-[#0B1D3A] dark:border-[#284A7F]">
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
              <tbody className="divide-y divide-[#D7E2F0] dark:divide-[#1F3B68]">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5 + schedule.roles.length}
                      className="py-10 px-4 text-center text-[#526886] dark:text-[#9BB2CE]"
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
                            ? 'bg-[#EDF4FB]/80 dark:bg-[#11264A] hover:bg-[#E1EEF9] dark:hover:bg-[#173566] transition-colors'
                            : 'bg-white dark:bg-[#0D2140] hover:bg-[#E1EEF9] dark:hover:bg-[#173566] transition-colors'
                        }
                      >
                        {/* Mês */}
                        <td className="p-1.5 border-r border-[#D7E2F0] dark:border-[#1F3B68]">
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
                            className="w-full min-h-[38px] px-2 rounded-lg bg-transparent hover:bg-white/80 dark:hover:bg-[#0B1D3A] focus:bg-white dark:focus:bg-[#08162E] text-sm font-medium text-[#0B1D3A] dark:text-[#F4F8FC] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
                          >
                            {MONTHS_PT.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Data */}
                        <td className="p-1.5 border-r border-[#D7E2F0] dark:border-[#1F3B68]">
                          <BufferedInput
                            type="text"
                            inputMode="numeric"
                            value={entry.day}
                            onCommit={(nextVal) =>
                              handleUpdateEntryField(entry.id, 'day', nextVal)
                            }
                            placeholder="Dia"
                            aria-label={`Dia do culto (${entry.month})`}
                            className="w-full min-h-[38px] px-1.5 text-center rounded-lg bg-transparent hover:bg-white/80 dark:hover:bg-[#0B1D3A] focus:bg-white dark:focus:bg-[#08162E] text-sm font-semibold tabular-nums text-[#0B1D3A] dark:text-[#F4F8FC] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
                          />
                        </td>

                        {/* Passagem */}
                        <td className="p-1.5 border-r border-[#D7E2F0] dark:border-[#1F3B68]">
                          <BufferedInput
                            type="text"
                            value={entry.passage}
                            onCommit={(nextVal) =>
                              handleUpdateEntryField(
                                entry.id,
                                'passage',
                                nextVal
                              )
                            }
                            placeholder="Ex: Atos 8:25-40"
                            aria-label={`Passagem bíblica do dia ${entry.day}`}
                            className="w-full min-h-[38px] px-2 text-center rounded-lg bg-transparent hover:bg-white/80 dark:hover:bg-[#0B1D3A] focus:bg-white dark:focus:bg-[#08162E] text-sm text-[#0B1D3A] dark:text-[#F4F8FC] placeholder:text-[#6B82A0] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
                          />
                        </td>

                        {/* Tema */}
                        <td className="p-1.5 border-r border-[#D7E2F0] dark:border-[#1F3B68]">
                          <BufferedInput
                            type="text"
                            value={entry.theme}
                            onCommit={(nextVal) =>
                              handleUpdateEntryField(entry.id, 'theme', nextVal)
                            }
                            placeholder="Tema do culto"
                            aria-label={`Tema do culto do dia ${entry.day}`}
                            className="w-full min-h-[38px] px-2 text-center rounded-lg bg-transparent hover:bg-white/80 dark:hover:bg-[#0B1D3A] focus:bg-white dark:focus:bg-[#08162E] text-sm text-[#0B1D3A] dark:text-[#F4F8FC] placeholder:text-[#6B82A0] focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F]"
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
                              className="p-1.5 border-r border-[#D7E2F0] dark:border-[#1F3B68]"
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
                                className={`w-full min-h-[38px] px-2 text-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#1668A3] dark:focus:ring-[#E4B84F] ${
                                  isHighlighted
                                    ? 'bg-[#E4B84F] text-[#0B1D3A] font-bold'
                                    : assigned
                                      ? 'bg-transparent hover:bg-white/80 dark:hover:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC]'
                                      : 'bg-transparent hover:bg-white/80 dark:hover:bg-[#0B1D3A] text-[#6B82A0] dark:text-[#829CBE]'
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
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#1668A3] dark:text-[#E4B84F] hover:bg-white/80 dark:hover:bg-[#0B1D3A] transition-colors"
                            >
                              <ListMusic className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              title="Remover linha da escala"
                              aria-label={`Remover escala do dia ${entry.day} de ${entry.month}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#6B82A0] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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
              className="rounded-2xl border border-[#C6D6E8] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] overflow-hidden"
            >
              {/* Card Navy Header */}
              <div className="bg-[#10284F] dark:bg-[#153463] px-4 py-3 text-white flex items-center justify-between gap-2 border-b border-[#0B1D3A] dark:border-[#284A7F]">
                <div className="flex items-center gap-2">
                  <select
                    value={entry.month}
                    onChange={(e) =>
                      handleUpdateEntryField(entry.id, 'month', e.target.value)
                    }
                    aria-label="Mês do culto"
                    className="min-h-[36px] px-2 rounded-lg bg-white/15 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E4B84F]"
                  >
                    {MONTHS_PT.map((m) => (
                      <option key={m} value={m} className="text-[#0B1D3A]">
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="text-[#E4B84F]">·</span>
                  <div className="inline-flex items-center gap-1">
                    <span className="text-xs uppercase tracking-wider text-[#C4D5EB]">
                      Dia
                    </span>
                    <BufferedInput
                      type="text"
                      inputMode="numeric"
                      value={entry.day}
                      onCommit={(nextVal) =>
                        handleUpdateEntryField(entry.id, 'day', nextVal)
                      }
                      aria-label="Dia do culto"
                      className="w-12 min-h-[36px] px-1.5 text-center rounded-lg bg-white/15 text-[#E4B84F] font-bold text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#E4B84F]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUseInCultoDoDia(entry)}
                    className="min-h-[36px] px-2.5 rounded-lg bg-[#75C2F6]/20 hover:bg-[#75C2F6]/30 text-[#D8EEFD] text-xs font-semibold inline-flex items-center gap-1"
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
              <div className="p-4 bg-[#EDF4FB]/70 dark:bg-[#0D2140] border-b border-[#D7E2F0] dark:border-[#1F3B68] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526886] dark:text-[#9BB2CE]">
                    Passagem
                  </label>
                  <BufferedInput
                    type="text"
                    value={entry.passage}
                    onCommit={(nextVal) =>
                      handleUpdateEntryField(entry.id, 'passage', nextVal)
                    }
                    placeholder="Ex: Atos 8:25-40"
                    className="mt-1 w-full min-h-[42px] px-3 rounded-xl border border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#08162E] text-sm text-[#0B1D3A] dark:text-[#F4F8FC]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526886] dark:text-[#9BB2CE]">
                    Tema
                  </label>
                  <BufferedInput
                    type="text"
                    value={entry.theme}
                    onCommit={(nextVal) =>
                      handleUpdateEntryField(entry.id, 'theme', nextVal)
                    }
                    placeholder="Ex: Ceia e baptismo"
                    className="mt-1 w-full min-h-[42px] px-3 rounded-xl border border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#08162E] text-sm text-[#0B1D3A] dark:text-[#F4F8FC]"
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
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526886] dark:text-[#9BB2CE] truncate">
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
                            ? 'border-[#DCA93B] bg-[#E4B84F] text-[#0B1D3A]'
                            : 'border-[#C6D6E8] dark:border-[#284A7F] bg-[#F4F8FC] dark:bg-[#08162E] text-[#0B1D3A] dark:text-[#F4F8FC]'
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

      {/* WhatsApp Schedule Share & PDF Card */}
      <div className="mt-6 rounded-2xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0B1D3A] dark:text-[#F4F8FC]">
              Partilhar Escala no WhatsApp
            </h2>
            <p className="text-xs sm:text-sm text-[#465B78] dark:text-[#9BB2CE]">
              Partilha a escala filtrada acima no WhatsApp ou transfira a tabela completa em PDF para guardar e enviar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadSchedulePdf}
              disabled={filteredEntries.length === 0}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#BBD9F0] dark:border-[#75C2F6]/40 bg-[#EAF4FC] dark:bg-[#75C2F6]/12 text-[#1668A3] dark:text-[#75C2F6] text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap hover:bg-[#DCEDFB] dark:hover:bg-[#75C2F6]/20 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#75C2F6]"
            >
              {pdfSaved ? (
                <>
                  <Check className="w-4 h-4 text-[#1668A3] dark:text-[#75C2F6] shrink-0" aria-hidden="true" />
                  <span>PDF Guardado!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Guardar e Baixar PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={filteredEntries.length === 0}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#C6D6E8] dark:border-[#284A7F] bg-white dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap hover:bg-[#F4F8FC] dark:hover:bg-[#153463] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#1668A3] dark:text-[#75C2F6] shrink-0" aria-hidden="true" />
                  <span>Escala Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
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
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668A3] dark:focus-visible:ring-[#E4B84F] ${
                filteredEntries.length === 0
                  ? 'bg-[#10284F]/40 text-white/70 pointer-events-none'
                  : 'bg-[#10284F] hover:bg-[#183A6E] dark:bg-[#E4B84F] dark:hover:bg-[#EBC467] text-white dark:text-[#0B1D3A]'
              }`}
            >
              <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Partilhar no WhatsApp</span>
            </a>
          </div>
        </div>

        <pre
          aria-label="Pré-visualização da escala para o WhatsApp"
          className="mt-3 p-3 rounded-xl bg-[#F4F8FC] dark:bg-[#08162E] border border-[#D7E2F0] dark:border-[#1F3B68] text-xs sm:text-sm font-cifra text-[#243B5A] dark:text-[#C4D5EB] whitespace-pre-wrap break-words leading-relaxed max-h-60 overflow-y-auto"
        >
          {whatsAppMessage}
        </pre>
      </div>
    </section>
  );
}
