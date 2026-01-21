import { useEffect, useState } from 'react';
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
  AlertWithConsent,
  ContactWithConsent,
  Intervention,
  IndiceAcompana,
  AutomaticInsight,
  AlertsByLevel,
  AlertWithLevel,
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

  // Modal states
  const [interventionModalOpen, setInterventionModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactWithConsent | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<{ anonymousId: string; name: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, distData, trendsData, hoursData, userStatsData, alertsData, contactsData, counts, indiceData, insightsData, alertsLevelData] = await Promise.all([
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
                      <div
                        key={index}
                        className="p-4 hover:bg-slate-50 flex items-center justify-between"
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
                        </div>
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
