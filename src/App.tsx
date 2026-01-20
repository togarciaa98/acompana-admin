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
  getAtRiskDevices,
  getPeakHours,
  getRegisteredUsers,
  getUserStats,
  UserData,
  calculateAge,
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

type AtRiskDevice = {
  deviceId: string;
  negativeCount: number;
  lastActivity: string;
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

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [emotionDist, setEmotionDist] = useState<Record<string, number>>({});
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskDevice[]>([]);
  const [peakHours, setPeakHours] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);
  const [users, setUsers] = useState<UserData[]>([]);
  const [userStats, setUserStats] = useState<UserStatsData | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users'>('dashboard');

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, distData, trendsData, riskData, hoursData, usersData, userStatsData] = await Promise.all([
        getOverviewStats(),
        getEmotionDistribution(timeRange),
        getDailyTrends(timeRange),
        getAtRiskDevices(),
        getPeakHours(timeRange),
        getRegisteredUsers(),
        getUserStats(),
      ]);

      setStats(statsData);
      setEmotionDist(distData);
      setDailyTrends(trendsData);
      setAtRisk(riskData);
      setPeakHours(hoursData);
      setUsers(usersData);
      setUserStats(userStatsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    onLogout();
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
              {activeTab === 'dashboard' && (
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
          {/* Tabs */}
          <div className="flex space-x-1 mt-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-primary text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              👥 Usuarios ({userStats?.total || 0})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'users' ? (
          /* Users Tab */
          <div>
            {/* User Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm">Total usuarios</p>
                    <p className="text-3xl font-bold text-slate-800">{userStats?.total || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm">Nuevos esta semana</p>
                    <p className="text-3xl font-bold text-green-600">{userStats?.thisWeek || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📈</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm">Por género</p>
                    <div className="text-sm mt-1">
                      {userStats?.byGender && Object.entries(userStats.byGender).slice(0, 2).map(([g, c]) => (
                        <span key={g} className="mr-2 text-slate-600">
                          {GENDER_LABELS[g] || g}: {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">⚧</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm">Rango de edad más común</p>
                    <p className="text-xl font-bold text-slate-800">
                      {userStats?.byAge && Object.entries(userStats.byAge).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🎂</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800">Usuarios registrados</h2>
                <p className="text-sm text-slate-500">Lista de todos los usuarios de la app</p>
              </div>

              {users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Fecha Nac.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Edad
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Género
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Teléfono
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Registro
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {users.map((user) => {
                        const age = user.birth_date ? calculateAge(user.birth_date) : user.age;
                        return (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
                                <span className="text-white text-sm font-medium">
                                  {user.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium text-slate-800">{user.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                            {user.birth_date ? new Date(user.birth_date).toLocaleDateString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            }) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                            {age ? `${age} años` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                            {user.gender ? GENDER_LABELS[user.gender] || user.gender : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                            {user.phone || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-sm">
                            {new Date(user.created_at).toLocaleDateString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">👥</span>
                  </div>
                  <p className="text-slate-500">No hay usuarios registrados todavía</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Dashboard Tab */
          <>
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
                <p className="text-slate-500 text-sm">Usuarios activos</p>
                <p className="text-3xl font-bold text-slate-800">{stats?.activeUsers || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">👥</span>
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

        {/* Segunda fila */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          {/* Alertas */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Usuarios que podrían necesitar apoyo
            </h2>
            {atRisk.length > 0 ? (
              <div className="space-y-3">
                {atRisk.slice(0, 5).map((device, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        Usuario {device.deviceId}
                      </p>
                      <p className="text-sm text-slate-500">
                        {device.negativeCount} registros negativos en 5 días
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-500 font-semibold">{device.negativeCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl">✓</span>
                  </div>
                  <p className="text-slate-500">
                    No hay usuarios en situación de alerta
                  </p>
                </div>
              </div>
            )}
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
      </main>
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
