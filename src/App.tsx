import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  getOverviewStats,
  getEmotionDistribution,
  getDailyTrends,
  getPeakHours,
  getUserStats,
  getAlertsWithConsentStatus,
  getContactsWithConsent,
  logIntervention,
  getInterventions,
  getTabCounts,
  getIndiceAcompana,
  getAutomaticInsights,
  getAlertsByLevel,
  getActionableRecommendations,
  getTemporalComparisons,
  getInterventionImpactMetrics,
  getEarlyWarningPredictions,
  getUserEmotionalTimeline,
  AlertWithConsent,
  ContactWithConsent,
  Intervention,
  IndiceAcompana,
  AutomaticInsight,
  AlertsByLevel,
  AlertWithLevel,
  ActionableRecommendation,
  TemporalComparisonData,
  InterventionImpactMetrics,
  EarlyWarningData,
  UserEmotionalTimeline,
} from './supabase';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const EMOTION_COLORS: Record<string, string> = {
  'muy-mal': '#EF4444',
  mal: '#F97316',
  neutral: '#EAB308',
  bien: '#22C55E',
  'muy-bien': '#10B981',
};

const EMOTION_LABELS: Record<string, string> = {
  'muy-mal': 'Muy mal',
  mal: 'Mal',
  neutral: 'Neutral',
  bien: 'Bien',
  'muy-bien': 'Muy bien',
};

// Contraseña para el panel admin (en producción usar variables de entorno)
const ADMIN_PASSWORD = 'acompana2024';

type OverviewStats = {
  totalLogs: number;
  weekLogs: number;
  monthLogs: number;
  activeUsers: number;
};

type UserStatsData = {
  total: number;
  byGender: Record<string, number>;
  byAge: Record<string, number>;
  thisWeek: number;
};

const GENDER_LABELS: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  'no-binario': 'No binario',
  'no-especificado': 'No especificado',
};

const AGE_RANGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('admin_authenticated', 'true');
      onLogin();
    } else {
      setError('Contraseña incorrecta');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❤️</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Acompaña</h1>
          <p className="text-slate-500 mt-1">Panel Administrativo</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Contraseña de acceso
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Ingresa la contraseña"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary-700 transition-colors"
          >
            Acceder
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Solo para uso institucional autorizado
        </p>
      </div>
    </div>
  );
}

// Modal para registrar intervención
function InterventionModal({
  isOpen,
  onClose,
  contact,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  contact: ContactWithConsent | null;
  onSave: () => void;
}) {
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen || !contact) return null;

  const handleSave = async () => {
    if (!outcome) return;
    setSaving(true);
    try {
      await logIntervention({
        anonymousId: contact.anonymousId,
        alertType: 'manual_contact',
        contactOutcome: outcome,
        adminNotes: notes || undefined,
      });
      onSave();
      onClose();
      setOutcome('');
      setNotes('');
    } catch (error) {
      console.error('Error saving intervention:', error);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Registrar contacto
        </h3>

        <div className="mb-4 p-3 bg-slate-50 rounded-xl">
          <p className="text-sm text-slate-500">Contactando a:</p>
          <p className="font-medium text-slate-800">{contact.name}</p>
          <p className="text-sm text-slate-600">{contact.phone}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Resultado del contacto *
          </label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Seleccionar...</option>
            <option value="successful">Contacto exitoso - Usuario atendido</option>
            <option value="no_answer">No contestó</option>
            <option value="declined">Declinó ayuda</option>
            <option value="referred">Referido a especialista</option>
            <option value="emergency">Emergencia - Activado protocolo</option>
            <option value="follow_up">Requiere seguimiento</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={3}
            placeholder="Observaciones del contacto..."
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!outcome || saving}
            className="flex-1 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal para ver historial de intervenciones
function InterventionHistoryModal({
  isOpen,
  onClose,
  anonymousId,
  contactName,
}: {
  isOpen: boolean;
  onClose: () => void;
  anonymousId: string;
  contactName: string;
}) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && anonymousId) {
      loadInterventions();
    }
  }, [isOpen, anonymousId]);

  const loadInterventions = async () => {
    setLoading(true);
    const data = await getInterventions(anonymousId);
    setInterventions(data);
    setLoading(false);
  };

  if (!isOpen) return null;

  const outcomeLabels: Record<string, string> = {
    successful: 'Exitoso',
    no_answer: 'No contestó',
    declined: 'Declinó',
    referred: 'Referido',
    emergency: 'Emergencia',
    follow_up: 'Seguimiento',
  };

  const outcomeColors: Record<string, string> = {
    successful: 'bg-green-100 text-green-700',
    no_answer: 'bg-yellow-100 text-yellow-700',
    declined: 'bg-slate-100 text-slate-700',
    referred: 'bg-blue-100 text-blue-700',
    emergency: 'bg-red-100 text-red-700',
    follow_up: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              Historial de contactos
            </h3>
            <p className="text-sm text-slate-500">{contactName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : interventions.length > 0 ? (
            <div className="space-y-3">
              {interventions.map((intervention) => (
                <div
                  key={intervention.id}
                  className="p-4 bg-slate-50 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        outcomeColors[intervention.contactOutcome || ''] ||
                        'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {outcomeLabels[intervention.contactOutcome || ''] ||
                        intervention.contactOutcome}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(intervention.createdAt).toLocaleDateString(
                        'es-MX',
                        {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </span>
                  </div>
                  {intervention.adminNotes && (
                    <p className="text-sm text-slate-600">
                      {intervention.adminNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400">No hay contactos registrados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [emotionDist, setEmotionDist] = useState<Record<string, number>>({});
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);
  const [userStats, setUserStats] = useState<UserStatsData | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'alerts' | 'contacts'>('stats');

  // Nivel B data
  const [alerts, setAlerts] = useState<AlertWithConsent[]>([]);
  const [contacts, setContacts] = useState<ContactWithConsent[]>([]);
  const [tabCounts, setTabCounts] = useState({ alerts: 0, contacts: 0 });

  // Nuevos datos de impacto
  const [indiceAcompana, setIndiceAcompana] = useState<IndiceAcompana | null>(null);
  const [insights, setInsights] = useState<AutomaticInsight[]>([]);
  const [alertsByLevel, setAlertsByLevel] = useState<AlertsByLevel | null>(null);
  const [alertFilter, setAlertFilter] = useState<'all' | 'preventivo' | 'atencion' | 'prioritario'>('all');

  // PREMIUM: Nuevos estados para características avanzadas
  const [recommendations, setRecommendations] = useState<ActionableRecommendation[]>([]);
  const [temporalData, setTemporalData] = useState<TemporalComparisonData | null>(null);
  const [impactMetrics, setImpactMetrics] = useState<InterventionImpactMetrics | null>(null);
  const [earlyWarnings, setEarlyWarnings] = useState<EarlyWarningData | null>(null);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [alertTimelines, setAlertTimelines] = useState<Map<string, UserEmotionalTimeline>>(new Map());

  // Modal states
  const [interventionModalOpen, setInterventionModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactWithConsent | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<{ anonymousId: string; name: string } | null>(null);

  // PDF generation state
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        statsData,
        distData,
        trendsData,
        hoursData,
        userStatsData,
        alertsData,
        contactsData,
        counts,
        indiceData,
        insightsData,
        alertsLevelData,
        recommendationsData,
        temporalCompData,
        impactData,
        earlyWarningData,
      ] = await Promise.all([
        getOverviewStats(),
        getEmotionDistribution(timeRange),
        getDailyTrends(timeRange),
        getPeakHours(timeRange),
        getUserStats(),
        getAlertsWithConsentStatus(),
        getContactsWithConsent(),
        getTabCounts(),
        getIndiceAcompana(),
        getAutomaticInsights(),
        getAlertsByLevel(),
        getActionableRecommendations(),
        getTemporalComparisons(),
        getInterventionImpactMetrics(),
        getEarlyWarningPredictions(),
      ]);

      setStats(statsData);
      setEmotionDist(distData);
      setDailyTrends(trendsData);
      setPeakHours(hoursData);
      setUserStats(userStatsData);
      setAlerts(alertsData);
      setContacts(contactsData);
      setTabCounts(counts);
      setIndiceAcompana(indiceData);
      setInsights(insightsData);
      setAlertsByLevel(alertsLevelData);
      setRecommendations(recommendationsData);
      setTemporalData(temporalCompData);
      setImpactMetrics(impactData);
      setEarlyWarnings(earlyWarningData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    onLogout();
  };

  const handleContactClick = (contact: ContactWithConsent) => {
    setSelectedContact(contact);
    setInterventionModalOpen(true);
  };

  const handleViewHistory = (anonymousId: string, name: string) => {
    setHistoryContact({ anonymousId, name });
    setHistoryModalOpen(true);
  };

  // Handler para expandir alerta y cargar timeline
  const handleToggleAlertExpand = async (deviceId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(deviceId)) {
      newExpanded.delete(deviceId);
    } else {
      newExpanded.add(deviceId);
      // Cargar timeline si no existe
      if (!alertTimelines.has(deviceId)) {
        const timeline = await getUserEmotionalTimeline(deviceId);
        if (timeline) {
          setAlertTimelines(prev => new Map(prev).set(deviceId, timeline));
        }
      }
    }
    setExpandedAlerts(newExpanded);
  };

  // Generación de reporte PDF semanal
  const generateWeeklyReport = async () => {
    setGeneratingPDF(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Header
      doc.setFillColor(175, 39, 47); // Primary color
      doc.rect(0, 0, pageWidth, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte Semanal', 20, 25);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Panel Acompaña - Salud Mental Puebla', 20, 35);

      // Fecha del reporte
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.text(`Generado: ${today.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, 20, 50);
      doc.text(`Período: ${weekAgo.toLocaleDateString('es-MX')} - ${today.toLocaleDateString('es-MX')}`, 20, 56);

      let yPos = 70;

      // =====================
      // SECCIÓN 1: ÍNDICE ACOMPAÑA
      // =====================
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPos - 5, pageWidth - 30, 35, 'F');

      doc.setTextColor(175, 39, 47);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Indice Acompana', 20, yPos + 5);

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(36);
      doc.text(`${indiceAcompana?.total || 0}/100`, 20, yPos + 25);

      // Subindicadores
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Frecuencia: ${indiceAcompana?.frecuencia || 0}  |  Balance: ${indiceAcompana?.balance || 0}  |  Recuperacion: ${indiceAcompana?.recuperacion || 0}`, 100, yPos + 15);

      if (indiceAcompana && indiceAcompana.cambioSemanal !== 0) {
        const cambioText = indiceAcompana.cambioSemanal > 0
          ? `+${indiceAcompana.cambioSemanal}% vs semana anterior`
          : `${indiceAcompana.cambioSemanal}% vs semana anterior`;
        doc.setTextColor(indiceAcompana.cambioSemanal > 0 ? 34 : 239, indiceAcompana.cambioSemanal > 0 ? 197 : 68, indiceAcompana.cambioSemanal > 0 ? 94 : 68);
        doc.text(cambioText, 100, yPos + 25);
      }

      yPos += 45;

      // =====================
      // SECCIÓN 2: ESTADÍSTICAS GENERALES
      // =====================
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Estadisticas del Periodo', 20, yPos);
      yPos += 10;

      const statsData = [
        ['Total registros emocionales', String(stats?.totalLogs || 0)],
        ['Registros esta semana', String(stats?.weekLogs || 0)],
        ['Dispositivos activos', String(stats?.activeUsers || 0)],
        ['% Emociones negativas', `${negativePercentage}%`],
        ['Usuarios anonimos totales', String(userStats?.total || 0)],
        ['Nuevos esta semana', String(userStats?.thisWeek || 0)],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Metrica', 'Valor']],
        body: statsData,
        theme: 'striped',
        headStyles: { fillColor: [175, 39, 47] },
        margin: { left: 20, right: 20 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // =====================
      // SECCIÓN 3: HORARIOS CRÍTICOS
      // =====================
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Horarios de Mayor Actividad', 20, yPos);
      yPos += 10;

      // Encontrar las 5 horas con más registros
      const sortedHours = Object.entries(peakHours)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      if (sortedHours.length > 0) {
        const hoursData = sortedHours.map(h => [
          `${h.hour}:00 - ${h.hour + 1}:00`,
          String(h.count),
          h.count > 10 ? 'Alto' : h.count > 5 ? 'Medio' : 'Bajo'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Horario', 'Registros', 'Nivel']],
          body: hoursData,
          theme: 'striped',
          headStyles: { fillColor: [175, 39, 47] },
          margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // =====================
      // SECCIÓN 4: ALERTAS ACTIVAS
      // =====================
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen de Alertas', 20, yPos);
      yPos += 10;

      const alertsData = [
        ['Prioritario (5+ negativos)', String(alertsByLevel?.totals.prioritario || 0), 'Requiere intervencion inmediata'],
        ['Atencion (3-4 negativos)', String(alertsByLevel?.totals.atencion || 0), 'Monitoreo cercano'],
        ['Preventivo (1-2 negativos)', String(alertsByLevel?.totals.preventivo || 0), 'Seguimiento ligero'],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Nivel', 'Cantidad', 'Accion Sugerida']],
        body: alertsData,
        theme: 'striped',
        headStyles: { fillColor: [175, 39, 47] },
        margin: { left: 20, right: 20 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            if (data.row.index === 0) data.cell.styles.textColor = [220, 38, 38];
            if (data.row.index === 1) data.cell.styles.textColor = [217, 119, 6];
            if (data.row.index === 2) data.cell.styles.textColor = [22, 163, 74];
          }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Nueva página si es necesario
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }

      // =====================
      // SECCIÓN 5: RECOMENDACIONES ACCIONABLES
      // =====================
      if (recommendations.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Recomendaciones Accionables', 20, yPos);
        yPos += 10;

        const recsData = recommendations.map(rec => [
          rec.priority.toUpperCase(),
          rec.title,
          rec.action,
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Prioridad', 'Situacion', 'Accion Sugerida']],
          body: recsData,
          theme: 'striped',
          headStyles: { fillColor: [175, 39, 47] },
          margin: { left: 20, right: 20 },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 60 },
            2: { cellWidth: 'auto' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
              const text = String(data.cell.raw);
              if (text === 'URGENTE') data.cell.styles.textColor = [220, 38, 38];
              if (text === 'SUGERIDO') data.cell.styles.textColor = [217, 119, 6];
              if (text === 'OPORTUNIDAD') data.cell.styles.textColor = [22, 163, 74];
            }
          }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Nueva página si es necesario
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }

      // =====================
      // SECCIÓN 6: COMPARATIVAS TEMPORALES
      // =====================
      if (temporalData && temporalData.weekComparison.metrics.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Comparativa Semanal', 20, yPos);
        yPos += 10;

        const compData = temporalData.weekComparison.metrics.map(m => [
          m.label,
          String(m.previous),
          String(m.current),
          `${m.change > 0 ? '+' : ''}${m.change}${m.label.includes('%') ? '%' : ''}`,
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Metrica', 'Semana Anterior', 'Esta Semana', 'Cambio']],
          body: compData,
          theme: 'striped',
          headStyles: { fillColor: [175, 39, 47] },
          margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // =====================
      // SECCIÓN 7: IMPACTO DE INTERVENCIONES
      // =====================
      if (impactMetrics && impactMetrics.totalInterventions > 0) {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Impacto de Intervenciones', 20, yPos);
        yPos += 10;

        const impactData = [
          ['Total intervenciones', String(impactMetrics.totalInterventions)],
          ['Mejora a las 24h', `${impactMetrics.improvementAt24h}%`],
          ['Mejora a las 72h', `${impactMetrics.improvementAt72h}%`],
          ['Emocion promedio antes', String(impactMetrics.avgEmotionBefore)],
          ['Emocion promedio despues', String(impactMetrics.avgEmotionAfter)],
        ];

        autoTable(doc, {
          startY: yPos,
          head: [['Metrica', 'Valor']],
          body: impactData,
          theme: 'striped',
          headStyles: { fillColor: [175, 39, 47] },
          margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // =====================
      // FOOTER
      // =====================
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Pagina ${i} de ${pageCount} | Generado por Panel Acompana | Confidencial - Solo uso institucional`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Guardar el PDF
      const fileName = `reporte-acompana-${today.toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el reporte. Por favor intenta de nuevo.');
    }

    setGeneratingPDF(false);
  };

  const emotionChartData = {
    labels: Object.keys(emotionDist).map(e => EMOTION_LABELS[e] || e),
    datasets: [
      {
        data: Object.values(emotionDist),
        backgroundColor: Object.keys(emotionDist).map(e => EMOTION_COLORS[e] || '#94A3B8'),
        borderWidth: 0,
      },
    ],
  };

  const trendChartData = {
    labels: dailyTrends.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Muy mal',
        data: dailyTrends.map(d => d['muy-mal'] || 0),
        borderColor: EMOTION_COLORS['muy-mal'],
        backgroundColor: EMOTION_COLORS['muy-mal'] + '40',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Mal',
        data: dailyTrends.map(d => d['mal'] || 0),
        borderColor: EMOTION_COLORS['mal'],
        backgroundColor: EMOTION_COLORS['mal'] + '40',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Neutral',
        data: dailyTrends.map(d => d['neutral'] || 0),
        borderColor: EMOTION_COLORS['neutral'],
        backgroundColor: EMOTION_COLORS['neutral'] + '40',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Bien',
        data: dailyTrends.map(d => d['bien'] || 0),
        borderColor: EMOTION_COLORS['bien'],
        backgroundColor: EMOTION_COLORS['bien'] + '40',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Muy bien',
        data: dailyTrends.map(d => d['muy-bien'] || 0),
        borderColor: EMOTION_COLORS['muy-bien'],
        backgroundColor: EMOTION_COLORS['muy-bien'] + '40',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const hoursChartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: 'Registros',
        data: Array.from({ length: 24 }, (_, i) => peakHours[i] || 0),
        backgroundColor: '#AF272F',
        borderRadius: 4,
      },
    ],
  };

  // Datos para gráfico de edad
  const sortedAgeData = AGE_RANGE_ORDER
    .filter(range => userStats?.byAge?.[range])
    .map(range => ({ range, count: userStats?.byAge?.[range] || 0 }));

  const ageChartData = {
    labels: sortedAgeData.map(d => d.range),
    datasets: [
      {
        label: 'Usuarios',
        data: sortedAgeData.map(d => d.count),
        backgroundColor: '#6366F1',
        borderRadius: 4,
      },
    ],
  };

  // Datos para gráfico de género
  const genderChartData = {
    labels: Object.keys(userStats?.byGender || {}).map(g => GENDER_LABELS[g] || g),
    datasets: [
      {
        data: Object.values(userStats?.byGender || {}),
        backgroundColor: ['#3B82F6', '#EC4899', '#8B5CF6', '#94A3B8'],
        borderWidth: 0,
      },
    ],
  };

  // Calcular porcentaje de emociones negativas
  const totalEmotions = Object.values(emotionDist).reduce((a, b) => a + b, 0);
  const negativeEmotions = (emotionDist['muy-mal'] || 0) + (emotionDist['mal'] || 0);
  const negativePercentage = totalEmotions > 0 ? ((negativeEmotions / totalEmotions) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">❤️</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Acompaña</h1>
                <p className="text-sm text-slate-500">Panel Administrativo</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {activeTab === 'stats' && (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-500">Período:</span>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(Number(e.target.value))}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value={7}>Últimos 7 días</option>
                      <option value={14}>Últimos 14 días</option>
                      <option value={30}>Últimos 30 días</option>
                    </select>
                  </div>
                  <button
                    onClick={generateWeeklyReport}
                    disabled={generatingPDF}
                    className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium transition-colors"
                  >
                    {generatingPDF ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Generando...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Reporte PDF</span>
                      </>
                    )}
                  </button>
                </>
              )}
              <button
                onClick={loadData}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center space-x-1"
              >
                <span>Actualizar</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center space-x-1"
              >
                <span>Cerrar sesión</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
          {/* Tabs - 3 pestañas del sistema de privacidad */}
          <div className="flex space-x-1 mt-4">
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'stats'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              📊 Estadísticas
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1 ${
                activeTab === 'alerts'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🚨 Alertas</span>
              {tabCounts.alerts > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === 'alerts' ? 'bg-white/20' : 'bg-red-100 text-red-600'
                }`}>
                  {tabCounts.alerts}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1 ${
                activeTab === 'contacts'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>🤝 Contactos</span>
              {tabCounts.contacts > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === 'contacts' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'
                }`}>
                  {tabCounts.contacts}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ============================================ */}
        {/* TAB 1: ESTADÍSTICAS (Nivel A - Anónimo) */}
        {/* ============================================ */}
        {activeTab === 'stats' && (
          <>
            {/* Banner de nivel de privacidad */}
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-2">
              <span className="text-lg">🔒</span>
              <p className="text-sm text-green-700">
                <strong>Nivel A:</strong> Todos los datos en esta vista son anónimos y agregados. No se muestra información personal identificable.
              </p>
            </div>

            {/* ÍNDICE ACOMPAÑA - KPI Principal */}
            <div className="mb-6 bg-gradient-to-r from-primary to-primary-700 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div className="mb-4 lg:mb-0">
                  <h2 className="text-lg font-medium opacity-90 mb-1">Índice Acompaña</h2>
                  <div className="flex items-baseline space-x-3">
                    <span className="text-5xl font-bold">{indiceAcompana?.total || 0}</span>
                    <span className="text-xl opacity-75">/100</span>
                    {indiceAcompana && indiceAcompana.cambioSemanal !== 0 && (
                      <span className={`text-sm px-2 py-1 rounded-full ${
                        indiceAcompana.cambioSemanal > 0
                          ? 'bg-green-500/30 text-green-100'
                          : 'bg-red-500/30 text-red-100'
                      }`}>
                        {indiceAcompana.cambioSemanal > 0 ? '▲' : '▼'} {Math.abs(indiceAcompana.cambioSemanal)}% vs semana pasada
                      </span>
                    )}
                  </div>
                </div>

                {/* Barra de progreso visual */}
                <div className="lg:w-1/3">
                  <div className="h-4 bg-white/20 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${indiceAcompana?.total || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs opacity-75">
                    <span>Crítico</span>
                    <span>Óptimo</span>
                  </div>
                </div>
              </div>

              {/* Subindicadores */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/20">
                <div className="text-center">
                  <p className="text-sm opacity-75">Frecuencia</p>
                  <p className="text-2xl font-semibold">{indiceAcompana?.frecuencia || 0}</p>
                  <p className="text-xs opacity-60">Usuarios activos</p>
                </div>
                <div className="text-center border-x border-white/20">
                  <p className="text-sm opacity-75">Balance</p>
                  <p className="text-2xl font-semibold">{indiceAcompana?.balance || 0}</p>
                  <p className="text-xs opacity-60">Emociones positivas</p>
                </div>
                <div className="text-center">
                  <p className="text-sm opacity-75">Recuperación</p>
                  <p className="text-2xl font-semibold">{indiceAcompana?.recuperacion || 0}</p>
                  <p className="text-xs opacity-60">Mejora tras crisis</p>
                </div>
              </div>
            </div>

            {/* INSIGHTS AUTOMÁTICOS */}
            {insights.length > 0 && (
              <div className="mb-6 bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                  <span className="mr-2">💡</span>
                  Insights de la Semana
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border ${
                        insight.severity === 'positive'
                          ? 'bg-green-50 border-green-200'
                          : insight.severity === 'warning'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">{insight.icon}</span>
                        <div>
                          <p className={`font-medium ${
                            insight.severity === 'positive'
                              ? 'text-green-800'
                              : insight.severity === 'warning'
                              ? 'text-amber-800'
                              : 'text-slate-800'
                          }`}>
                            {insight.title}
                          </p>
                          <p className={`text-sm ${
                            insight.severity === 'positive'
                              ? 'text-green-600'
                              : insight.severity === 'warning'
                              ? 'text-amber-600'
                              : 'text-slate-600'
                          }`}>
                            {insight.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RECOMENDACIONES ACCIONABLES - PREMIUM */}
            {recommendations.length > 0 && (
              <div className="mb-6 bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                  <span className="mr-2">🎯</span>
                  Recomendaciones Accionables
                </h2>
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-xl border-l-4"
                      style={{
                        borderLeftColor: rec.priorityColor,
                        backgroundColor: rec.priority === 'urgente' ? '#FEF2F2' :
                                        rec.priority === 'sugerido' ? '#FFFBEB' : '#ECFDF5'
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">{rec.priorityIcon}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold" style={{ color: rec.priorityColor }}>
                              {rec.priority.toUpperCase()}: {rec.title}
                            </p>
                          </div>
                          <p className="text-slate-700 font-medium mb-1">
                            {rec.action}
                          </p>
                          <p className="text-sm text-slate-500">
                            {rec.dataSupport}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm">Total registros</p>
                    <p className="text-3xl font-bold text-slate-800">{stats?.totalLogs || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm">Esta semana</p>
                    <p className="text-3xl font-bold text-slate-800">{stats?.weekLogs || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📈</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm">Dispositivos activos</p>
                    <p className="text-3xl font-bold text-slate-800">{stats?.activeUsers || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📱</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm">% Emociones negativas</p>
                    <p className={`text-3xl font-bold ${Number(negativePercentage) > 30 ? 'text-red-500' : 'text-slate-800'}`}>
                      {negativePercentage}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Distribución de emociones */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  Distribución de emociones
                </h2>
                <div className="h-64 flex items-center justify-center">
                  {totalEmotions > 0 ? (
                    <Doughnut
                      data={emotionChartData}
                      options={{
                        plugins: {
                          legend: {
                            position: 'bottom',
                          },
                        },
                        maintainAspectRatio: false,
                      }}
                    />
                  ) : (
                    <p className="text-slate-400">Sin datos disponibles</p>
                  )}
                </div>
              </div>

              {/* Tendencias diarias */}
              <div className="bg-white rounded-2xl p-6 shadow-sm lg:col-span-2">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  Tendencias diarias
                </h2>
                <div className="h-64">
                  {dailyTrends.length > 0 ? (
                    <Line
                      data={trendChartData}
                      options={{
                        plugins: {
                          legend: {
                            position: 'top',
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                          },
                        },
                        maintainAspectRatio: false,
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-slate-400">Sin datos disponibles</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Segunda fila - Horas pico y Demografía */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Horas pico */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  Horarios de uso
                </h2>
                <div className="h-64">
                  <Bar
                    data={hoursChartData}
                    options={{
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </div>

              {/* Demografía anónima */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  Demografía anónima
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {/* Por género */}
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Por género</p>
                    <div className="h-40">
                      {Object.keys(userStats?.byGender || {}).length > 0 ? (
                        <Doughnut
                          data={genderChartData}
                          options={{
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: { boxWidth: 12, font: { size: 10 } },
                              },
                            },
                            maintainAspectRatio: false,
                          }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-slate-400 text-sm">Sin datos</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Por edad */}
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Por rango de edad</p>
                    <div className="h-40">
                      {sortedAgeData.length > 0 ? (
                        <Bar
                          data={ageChartData}
                          options={{
                            indexAxis: 'y',
                            plugins: {
                              legend: { display: false },
                            },
                            scales: {
                              x: { beginAtZero: true },
                            },
                            maintainAspectRatio: false,
                          }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-slate-400 text-sm">Sin datos</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total usuarios anónimos:</span>
                    <span className="font-medium text-slate-800">{userStats?.total || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-500">Nuevos esta semana:</span>
                    <span className="font-medium text-green-600">+{userStats?.thisWeek || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* COMPARATIVAS TEMPORALES - PREMIUM */}
            {temporalData && temporalData.weekComparison.metrics.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                  <span className="mr-2">📅</span>
                  Comparativas Temporales
                </h2>

                {/* Comparación semana vs semana */}
                <div className="mb-6">
                  <p className="text-sm text-slate-500 mb-3">{temporalData.weekComparison.period}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {temporalData.weekComparison.metrics.map((metric, index) => (
                      <div key={index} className="bg-slate-50 rounded-xl p-4">
                        <p className="text-sm text-slate-500 mb-1">{metric.label}</p>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-2xl font-bold text-slate-800">
                            {metric.current}{metric.label.includes('%') || metric.label.includes('positivas') || metric.label.includes('negativas') ? '%' : ''}
                          </span>
                          <span className={`text-sm font-medium flex items-center ${
                            metric.isPositive ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
                            {Math.abs(metric.change)}{metric.label.includes('%') || metric.label.includes('positivas') || metric.label.includes('negativas') ? '%' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Anterior: {metric.previous}{metric.label.includes('%') || metric.label.includes('positivas') || metric.label.includes('negativas') ? '%' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tendencia 30 días */}
                {temporalData.thirtyDayTrend.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-3">Tendencia últimos 30 días</p>
                    <div className="h-40">
                      <Line
                        data={{
                          labels: temporalData.thirtyDayTrend.map(d => {
                            const date = new Date(d.date);
                            return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                          }),
                          datasets: [{
                            label: 'Índice de bienestar',
                            data: temporalData.thirtyDayTrend.map(d => d.indiceAcompana),
                            borderColor: '#AF272F',
                            backgroundColor: '#AF272F20',
                            fill: true,
                            tension: 0.3,
                          }]
                        }}
                        options={{
                          plugins: {
                            legend: { display: false },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: 100,
                            },
                            x: {
                              ticks: {
                                maxTicksLimit: 10,
                              }
                            }
                          },
                          maintainAspectRatio: false,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer disclaimer */}
            <div className="mt-8 p-4 bg-slate-100 rounded-xl">
              <p className="text-sm text-slate-500 text-center">
                📊 Todos los datos son anónimos y agregados. No se almacena información personal identificable.
                <br />
                Este panel es solo para uso institucional autorizado.
              </p>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* TAB 2: ALERTAS CON 3 NIVELES */}
        {/* ============================================ */}
        {activeTab === 'alerts' && (
          <>
            {/* Banner explicativo */}
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2">
              <span className="text-lg">📋</span>
              <p className="text-sm text-amber-700">
                Sistema de alertas con 3 niveles de atención. Solo puedes contactar a quienes dieron consentimiento explícito.
              </p>
            </div>

            {/* EARLY WARNING - PREDICCIÓN 72H */}
            {earlyWarnings && earlyWarnings.users.length > 0 && (
              <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 shadow-sm border border-amber-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-amber-800 flex items-center">
                    <span className="mr-2">⚠️</span>
                    Alerta Temprana (próximas 72h)
                  </h2>
                  <span className="text-sm text-amber-600">
                    {earlyWarnings.totalAtRisk} en riesgo • {earlyWarnings.totalWithConsent} contactables
                  </span>
                </div>
                <p className="text-sm text-amber-700 mb-4">
                  Usuarios que podrían necesitar apoyo pronto basado en sus tendencias emocionales:
                </p>
                <div className="space-y-2">
                  {earlyWarnings.users.slice(0, 5).map((user, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                          user.riskScore >= 80 ? 'bg-red-500' :
                          user.riskScore >= 65 ? 'bg-orange-500' : 'bg-amber-500'
                        }`}>
                          {user.riskScore}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            ID: {user.deviceId}
                          </p>
                          <p className="text-sm text-slate-500">
                            Tendencia: <span className="font-mono">{user.trendArrows}</span> •
                            {user.daysSincePositive} días sin positivo
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex space-x-1">
                          {user.recentEmotions.slice(-3).map((emotion, i) => (
                            <span
                              key={i}
                              className="w-6 h-6 rounded-full text-xs flex items-center justify-center"
                              style={{ backgroundColor: EMOTION_COLORS[emotion] + '30' }}
                              title={EMOTION_LABELS[emotion]}
                            >
                              {emotion === 'muy-bien' ? '😊' :
                               emotion === 'bien' ? '🙂' :
                               emotion === 'neutral' ? '😐' :
                               emotion === 'mal' ? '😟' : '😢'}
                            </span>
                          ))}
                        </div>
                        {user.hasConsent ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            ✓ Contactable
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs">
                            Sin datos
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {earlyWarnings.users.length > 5 && (
                  <p className="text-sm text-amber-600 mt-3 text-center">
                    + {earlyWarnings.users.length - 5} usuarios más en la lista
                  </p>
                )}
              </div>
            )}

            {/* Resumen por nivel - Tarjetas clickeables */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <button
                onClick={() => setAlertFilter('all')}
                className={`bg-white rounded-xl p-4 shadow-sm text-left transition-all ${
                  alertFilter === 'all' ? 'ring-2 ring-primary' : 'hover:shadow-md'
                }`}
              >
                <p className="text-sm text-slate-500">Todas</p>
                <p className="text-2xl font-bold text-slate-800">
                  {(alertsByLevel?.totals.preventivo || 0) + (alertsByLevel?.totals.atencion || 0) + (alertsByLevel?.totals.prioritario || 0)}
                </p>
              </button>
              <button
                onClick={() => setAlertFilter('preventivo')}
                className={`rounded-xl p-4 shadow-sm text-left transition-all ${
                  alertFilter === 'preventivo' ? 'ring-2 ring-green-500' : 'hover:shadow-md'
                }`}
                style={{ backgroundColor: '#ECFDF5' }}
              >
                <div className="flex items-center space-x-2">
                  <span>🟢</span>
                  <p className="text-sm text-green-700">Preventivo</p>
                </div>
                <p className="text-2xl font-bold text-green-700">{alertsByLevel?.totals.preventivo || 0}</p>
                <p className="text-xs text-green-600">1-2 registros negativos</p>
              </button>
              <button
                onClick={() => setAlertFilter('atencion')}
                className={`rounded-xl p-4 shadow-sm text-left transition-all ${
                  alertFilter === 'atencion' ? 'ring-2 ring-amber-500' : 'hover:shadow-md'
                }`}
                style={{ backgroundColor: '#FFFBEB' }}
              >
                <div className="flex items-center space-x-2">
                  <span>🟡</span>
                  <p className="text-sm text-amber-700">Atención</p>
                </div>
                <p className="text-2xl font-bold text-amber-700">{alertsByLevel?.totals.atencion || 0}</p>
                <p className="text-xs text-amber-600">3-4 registros negativos</p>
              </button>
              <button
                onClick={() => setAlertFilter('prioritario')}
                className={`rounded-xl p-4 shadow-sm text-left transition-all ${
                  alertFilter === 'prioritario' ? 'ring-2 ring-red-500' : 'hover:shadow-md'
                }`}
                style={{ backgroundColor: '#FEF2F2' }}
              >
                <div className="flex items-center space-x-2">
                  <span>🔴</span>
                  <p className="text-sm text-red-700">Prioritario</p>
                </div>
                <p className="text-2xl font-bold text-red-700">{alertsByLevel?.totals.prioritario || 0}</p>
                <p className="text-xs text-red-600">5+ registros negativos</p>
              </button>
            </div>

            {/* Lista de alertas filtradas */}
            {(() => {
              let filteredAlerts: AlertWithLevel[] = [];
              if (alertFilter === 'all') {
                filteredAlerts = [
                  ...(alertsByLevel?.prioritario || []),
                  ...(alertsByLevel?.atencion || []),
                  ...(alertsByLevel?.preventivo || []),
                ];
              } else if (alertsByLevel) {
                filteredAlerts = alertsByLevel[alertFilter] || [];
              }

              return filteredAlerts.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-800">
                      {alertFilter === 'all'
                        ? `Todas las alertas (${filteredAlerts.length})`
                        : `Alertas ${alertFilter} (${filteredAlerts.length})`}
                    </h2>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {filteredAlerts.map((alert, index) => (
                      <div key={index}>
                        <div
                          className="p-4 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                          onClick={() => handleToggleAlertExpand(alert.deviceId)}
                        >
                          <div className="flex items-center space-x-4">
                            {/* Indicador de nivel */}
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: alert.levelColor + '20' }}
                            >
                              <span className="text-xl">
                                {alert.level === 'prioritario' ? '🔴' : alert.level === 'atencion' ? '🟡' : '🟢'}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="font-medium text-slate-800">
                                  ID: {alert.anonymousId.substring(0, 8)}...
                                </p>
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: alert.levelColor + '20',
                                    color: alert.levelColor,
                                  }}
                                >
                                  {alert.levelLabel}
                                </span>
                              </div>
                              <p className="text-sm text-slate-500">
                                {alert.negativeCount} registros negativos •
                                Último: {new Date(alert.lastActivity).toLocaleDateString('es-MX', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {alert.hasConsent ? (
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                ✓ Contactable
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-sm">
                                Sin consentimiento
                              </span>
                            )}
                            <span className={`text-slate-400 transition-transform ${
                              expandedAlerts.has(alert.deviceId) ? 'rotate-180' : ''
                            }`}>
                              ▼
                            </span>
                          </div>
                        </div>

                        {/* LÍNEA EMOCIONAL EXPANDIBLE */}
                        {expandedAlerts.has(alert.deviceId) && (
                          <div className="px-4 pb-4 bg-slate-50">
                            <div className="bg-white rounded-xl p-4 border border-slate-200">
                              <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center">
                                <span className="mr-2">📊</span>
                                Línea emocional - Últimos 7 días
                              </h4>
                              {alertTimelines.has(alert.deviceId) ? (
                                <>
                                  <div className="flex items-end justify-between h-24 mb-2">
                                    {alertTimelines.get(alert.deviceId)?.timeline.map((point, i) => (
                                      <div key={i} className="flex flex-col items-center flex-1">
                                        {point.hasIntervention && (
                                          <span className="text-xs mb-1" title="Intervención">📍</span>
                                        )}
                                        {point.emotion ? (
                                          <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110"
                                            style={{
                                              backgroundColor: EMOTION_COLORS[point.emotion] + '30',
                                              marginTop: `${(5 - point.emotionScore) * 12}px`
                                            }}
                                            title={EMOTION_LABELS[point.emotion] || point.emotion}
                                          >
                                            {point.emotion === 'muy-bien' ? '😊' :
                                             point.emotion === 'bien' ? '🙂' :
                                             point.emotion === 'neutral' ? '😐' :
                                             point.emotion === 'mal' ? '😟' : '😢'}
                                          </div>
                                        ) : (
                                          <div
                                            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
                                            style={{ marginTop: '24px' }}
                                          >
                                            <span className="text-slate-300">—</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex justify-between text-xs text-slate-400 border-t pt-2">
                                    {alertTimelines.get(alert.deviceId)?.timeline.map((point, i) => (
                                      <span key={i} className="flex-1 text-center">{point.dayLabel}</span>
                                    ))}
                                  </div>
                                  {alertTimelines.get(alert.deviceId)?.hasRecovery && (
                                    <p className="text-xs text-green-600 mt-2 flex items-center">
                                      <span className="mr-1">✓</span>
                                      {alertTimelines.get(alert.deviceId)?.recoveryNote}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <div className="flex items-center justify-center h-24">
                                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✓</span>
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 mb-2">
                    Sin alertas {alertFilter !== 'all' ? `de nivel ${alertFilter}` : 'activas'}
                  </h3>
                  <p className="text-slate-500">
                    {alertFilter === 'all'
                      ? 'No hay dispositivos con patrones de riesgo en los últimos 7 días.'
                      : `No hay alertas de nivel ${alertFilter} actualmente.`}
                  </p>
                </div>
              );
            })()}

            {/* Leyenda de niveles */}
            <div className="mt-6 bg-slate-50 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Descripción de niveles:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start space-x-2">
                  <span>🟢</span>
                  <div>
                    <p className="font-medium text-green-700">Preventivo</p>
                    <p className="text-slate-500">Seguimiento ligero, posible fluctuación normal</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span>🟡</span>
                  <div>
                    <p className="font-medium text-amber-700">Atención</p>
                    <p className="text-slate-500">Patrón que requiere monitoreo cercano</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span>🔴</span>
                  <div>
                    <p className="font-medium text-red-700">Prioritario</p>
                    <p className="text-slate-500">Situación que puede requerir intervención</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* TAB 3: CONTACTOS (Nivel B - Con consentimiento) */}
        {/* ============================================ */}
        {activeTab === 'contacts' && (
          <>
            {/* Banner de nivel de privacidad */}
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center space-x-2">
              <span className="text-lg">🤝</span>
              <p className="text-sm text-blue-700">
                <strong>Nivel B:</strong> Contactos que dieron consentimiento explícito para ser contactados en caso de necesitar apoyo.
              </p>
            </div>

            {contacts.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-800">
                    Contactos con consentimiento ({contacts.length})
                  </h2>
                  <p className="text-sm text-slate-500">
                    Personas que autorizaron ser contactadas si necesitan apoyo
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Contacto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Consentimiento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Último contacto
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {contacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mr-3">
                                <span className="text-white text-sm font-medium">
                                  {contact.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{contact.name}</p>
                                <p className="text-sm text-slate-500">{contact.phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              contact.currentStatus === 'at_risk'
                                ? 'bg-red-100 text-red-700'
                                : contact.currentStatus === 'monitoring'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {contact.currentStatus === 'at_risk' && '🚨 En riesgo'}
                              {contact.currentStatus === 'monitoring' && '👀 Monitoreo'}
                              {contact.currentStatus === 'stable' && '✓ Estable'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {new Date(contact.consentDate).toLocaleDateString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {contact.lastIntervention
                              ? new Date(contact.lastIntervention).toLocaleDateString('es-MX', {
                                  day: 'numeric',
                                  month: 'short',
                                })
                              : 'Nunca'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleViewHistory(contact.anonymousId, contact.name)}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                              >
                                Historial
                              </button>
                              <button
                                onClick={() => handleContactClick(contact)}
                                className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-700"
                              >
                                Registrar contacto
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🤝</span>
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-2">
                  Sin contactos registrados
                </h3>
                <p className="text-slate-500">
                  Aún no hay usuarios que hayan dado su consentimiento para contacto de apoyo.
                </p>
              </div>
            )}

            {/* Estadísticas de estado */}
            {contacts.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <span>🚨</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">En riesgo</p>
                      <p className="text-2xl font-bold text-red-600">
                        {contacts.filter(c => c.currentStatus === 'at_risk').length}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span>👀</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">En monitoreo</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {contacts.filter(c => c.currentStatus === 'monitoring').length}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span>✓</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Estables</p>
                      <p className="text-2xl font-bold text-green-600">
                        {contacts.filter(c => c.currentStatus === 'stable').length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* IMPACTO DE INTERVENCIONES - PREMIUM */}
            {impactMetrics && impactMetrics.totalInterventions > 0 && (
              <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                  <span className="mr-2">📈</span>
                  Impacto de Intervenciones
                </h2>

                {/* Métricas principales */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-green-600 mb-1">Mejora a las 24h</p>
                    <p className="text-3xl font-bold text-green-700">{impactMetrics.improvementAt24h}%</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-blue-600 mb-1">Mejora a las 72h</p>
                    <p className="text-3xl font-bold text-blue-700">{impactMetrics.improvementAt72h}%</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-purple-600 mb-1">Total intervenciones</p>
                    <p className="text-3xl font-bold text-purple-700">{impactMetrics.totalInterventions}</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-amber-600 mb-1">Días a recuperación</p>
                    <p className="text-3xl font-bold text-amber-700">{impactMetrics.avgDaysToRecovery || '—'}</p>
                  </div>
                </div>

                {/* Antes vs Después */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  <p className="text-sm text-slate-500 mb-2">Promedio emocional antes vs después</p>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="text-center">
                      <span className="text-3xl">
                        {impactMetrics.avgEmotionBefore <= 2 ? '😢' :
                         impactMetrics.avgEmotionBefore <= 3 ? '😟' :
                         impactMetrics.avgEmotionBefore <= 4 ? '😐' : '🙂'}
                      </span>
                      <p className="text-lg font-bold text-slate-700">{impactMetrics.avgEmotionBefore}</p>
                      <p className="text-xs text-slate-400">Antes</p>
                    </div>
                    <span className="text-2xl text-slate-400">→</span>
                    <div className="text-center">
                      <span className="text-3xl">
                        {impactMetrics.avgEmotionAfter <= 2 ? '😢' :
                         impactMetrics.avgEmotionAfter <= 3 ? '😟' :
                         impactMetrics.avgEmotionAfter <= 4 ? '🙂' : '😊'}
                      </span>
                      <p className="text-lg font-bold text-green-600">{impactMetrics.avgEmotionAfter}</p>
                      <p className="text-xs text-slate-400">Después</p>
                    </div>
                  </div>
                </div>

                {/* Efectividad por tipo */}
                {impactMetrics.byType.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-3">Efectividad por tipo de intervención</p>
                    <div className="space-y-2">
                      {impactMetrics.byType.map((type, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <span className="text-sm text-slate-600 w-40 truncate">{type.typeLabel}</span>
                          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${type.effectivenessRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700 w-16 text-right">
                            {type.effectivenessRate}%
                          </span>
                          <span className="text-xs text-slate-400 w-12">
                            ({type.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <InterventionModal
        isOpen={interventionModalOpen}
        onClose={() => {
          setInterventionModalOpen(false);
          setSelectedContact(null);
        }}
        contact={selectedContact}
        onSave={loadData}
      />

      {historyContact && (
        <InterventionHistoryModal
          isOpen={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setHistoryContact(null);
          }}
          anonymousId={historyContact.anonymousId}
          contactName={historyContact.name}
        />
      )}
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Verificar si ya está autenticado
    const authenticated = localStorage.getItem('admin_authenticated');
    if (authenticated === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return <Dashboard onLogout={() => setIsAuthenticated(false)} />;
}
