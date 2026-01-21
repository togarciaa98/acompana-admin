import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fmycdinzildpdronalqk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWNkaW56aWxkcGRyb25hbHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjY5NTcsImV4cCI6MjA4NDUwMjk1N30.x4iNyzbBHGRlI9DYCn0gEzfR_CPpqxNdCFhxWqhdMZA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type EmotionStats = {
  date: string;
  emotion: string;
  count: number;
  age_range?: string;
  zone?: string;
};

export type WeeklyTrend = {
  week_start: string;
  emotion: string;
  count: number;
  percentage: number;
};

// Obtener estadísticas generales
export async function getOverviewStats() {
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setDate(lastMonth.getDate() - 30);

  const [totalResult, weekResult, monthResult] = await Promise.all([
    supabase.from('emotion_logs').select('*', { count: 'exact', head: true }),
    supabase
      .from('emotion_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', lastWeek.toISOString()),
    supabase
      .from('emotion_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', lastMonth.toISOString()),
  ]);

  // Contar dispositivos únicos
  const { data: devices } = await supabase
    .from('emotion_logs')
    .select('device_id')
    .gte('created_at', lastMonth.toISOString());

  const uniqueDevices = new Set(devices?.map(d => d.device_id)).size;

  return {
    totalLogs: totalResult.count || 0,
    weekLogs: weekResult.count || 0,
    monthLogs: monthResult.count || 0,
    activeUsers: uniqueDevices,
  };
}

// Obtener distribución de emociones
export async function getEmotionDistribution(days: number = 7) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data, error } = await supabase
    .from('emotion_logs')
    .select('emotion')
    .gte('created_at', fromDate.toISOString());

  if (error || !data) return {};

  const distribution: Record<string, number> = {};
  data.forEach(log => {
    distribution[log.emotion] = (distribution[log.emotion] || 0) + 1;
  });

  return distribution;
}

// Obtener tendencias por día
export async function getDailyTrends(days: number = 14) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data, error } = await supabase
    .from('emotion_logs')
    .select('emotion, created_at')
    .gte('created_at', fromDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) return [];

  // Crear mapa con todos los días del rango (incluyendo días sin datos)
  const byDay = new Map<string, Record<string, number>>();

  // Inicializar todos los días del rango con valores en cero
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayKey = date.toISOString().split('T')[0];
    byDay.set(dayKey, {
      'muy-mal': 0,
      'mal': 0,
      'neutral': 0,
      'bien': 0,
      'muy-bien': 0,
    });
  }

  // Rellenar con datos reales donde existan
  if (data) {
    data.forEach(log => {
      const day = new Date(log.created_at).toISOString().split('T')[0];
      if (byDay.has(day)) {
        const dayData = byDay.get(day)!;
        dayData[log.emotion] = (dayData[log.emotion] || 0) + 1;
      }
    });
  }

  // Ordenar por fecha y retornar
  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, emotions]) => ({
      date,
      ...emotions,
    }));
}

// Obtener logs con riesgo potencial
export async function getAtRiskDevices() {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const { data, error } = await supabase
    .from('emotion_logs')
    .select('device_id, emotion, created_at')
    .in('emotion', ['muy-mal', 'mal'])
    .gte('created_at', fiveDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // Contar por dispositivo
  const deviceCounts = new Map<string, { count: number; lastLog: string }>();

  data.forEach(log => {
    const current = deviceCounts.get(log.device_id);
    if (!current) {
      deviceCounts.set(log.device_id, { count: 1, lastLog: log.created_at });
    } else {
      current.count++;
    }
  });

  // Filtrar dispositivos con 3+ registros negativos
  return Array.from(deviceCounts.entries())
    .filter(([_, stats]) => stats.count >= 3)
    .map(([deviceId, stats]) => ({
      deviceId: deviceId.substring(0, 8) + '...', // Anonimizar
      negativeCount: stats.count,
      lastActivity: stats.lastLog,
    }));
}

// Obtener distribución por rango de edad
export async function getAgeDistribution(days: number = 30) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data, error } = await supabase
    .from('emotion_logs')
    .select('age_range')
    .gte('created_at', fromDate.toISOString())
    .not('age_range', 'is', null);

  if (error || !data) return {};

  const distribution: Record<string, number> = {};
  data.forEach(log => {
    if (log.age_range) {
      distribution[log.age_range] = (distribution[log.age_range] || 0) + 1;
    }
  });

  return distribution;
}

// Obtener horas pico de uso
export async function getPeakHours(days: number = 7) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data, error } = await supabase
    .from('emotion_logs')
    .select('created_at')
    .gte('created_at', fromDate.toISOString());

  if (error || !data) return {};

  const hourCounts: Record<number, number> = {};

  data.forEach(log => {
    const hour = new Date(log.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  return hourCounts;
}

// Tipos para usuarios
export type UserData = {
  id: string;
  device_id: string;
  name: string;
  birth_date: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  created_at: string;
};

// Función para calcular edad a partir de fecha de nacimiento
export const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// Obtener todos los usuarios registrados
export async function getRegisteredUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data || [];
}

// Obtener estadísticas de usuarios desde anonymous_demographics
export async function getUserStats() {
  const { data, error } = await supabase
    .from('anonymous_demographics')
    .select('gender, age_range, created_at');

  if (error || !data) return { total: 0, byGender: {}, byAge: {}, thisWeek: 0 };

  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const byGender: Record<string, number> = {};
  const byAge: Record<string, number> = {};
  let thisWeek = 0;

  data.forEach(user => {
    // Por género
    const gender = user.gender || 'no-especificado';
    byGender[gender] = (byGender[gender] || 0) + 1;

    // Por edad (rangos)
    if (user.age_range) {
      byAge[user.age_range] = (byAge[user.age_range] || 0) + 1;
    }

    // Esta semana
    if (new Date(user.created_at) >= lastWeek) {
      thisWeek++;
    }
  });

  return {
    total: data.length,
    byGender,
    byAge,
    thisWeek,
  };
}

// ============================================
// NIVEL B: Funciones para contactos con consentimiento
// ============================================

export type AlertWithConsent = {
  anonymousId: string;
  deviceId: string;
  negativeCount: number;
  lastActivity: string;
  alertType: string;
  hasConsent: boolean;
};

export type ContactWithConsent = {
  id: string;
  anonymousId: string;
  name: string;
  phone: string;
  consentDate: string;
  currentStatus: 'at_risk' | 'monitoring' | 'stable';
  lastIntervention?: string;
};

export type Intervention = {
  id: string;
  anonymousId: string;
  alertType: string;
  contactAttempted: boolean;
  contactOutcome?: string;
  adminNotes?: string;
  resolved: boolean;
  createdAt: string;
};

// Obtener alertas con estado de consentimiento
export async function getAlertsWithConsentStatus(): Promise<AlertWithConsent[]> {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  // 1. Obtener dispositivos en riesgo
  const { data: riskData, error } = await supabase
    .from('emotion_logs')
    .select('device_id, emotion, created_at')
    .in('emotion', ['muy-mal', 'mal'])
    .gte('created_at', fiveDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error || !riskData) return [];

  // Contar por dispositivo
  const deviceCounts = new Map<string, { count: number; lastLog: string }>();

  riskData.forEach(log => {
    const current = deviceCounts.get(log.device_id);
    if (!current) {
      deviceCounts.set(log.device_id, { count: 1, lastLog: log.created_at });
    } else {
      current.count++;
    }
  });

  // Filtrar dispositivos con 3+ registros negativos
  const atRiskDevices = Array.from(deviceCounts.entries())
    .filter(([_, stats]) => stats.count >= 3)
    .map(([deviceId, stats]) => ({ deviceId, ...stats }));

  if (atRiskDevices.length === 0) return [];

  // 2. Verificar consentimiento para cada uno
  const deviceIds = atRiskDevices.map(d => d.deviceId);
  const { data: consents } = await supabase
    .from('contact_consent')
    .select('device_id, anonymous_id, consent_given, consent_withdrawn_date')
    .in('device_id', deviceIds);

  const consentMap = new Map(consents?.map(c => [c.device_id, c]) || []);

  return atRiskDevices.map(device => {
    const consent = consentMap.get(device.deviceId);
    const hasConsent = consent?.consent_given && !consent?.consent_withdrawn_date;

    return {
      anonymousId: consent?.anonymous_id || device.deviceId.substring(0, 16),
      deviceId: device.deviceId,
      negativeCount: device.count,
      lastActivity: device.lastLog,
      alertType: 'consecutive_negative',
      hasConsent: !!hasConsent,
    };
  });
}

// Obtener contactos con consentimiento activo
export async function getContactsWithConsent(): Promise<ContactWithConsent[]> {
  const { data, error } = await supabase
    .from('contact_consent')
    .select(`
      id,
      device_id,
      anonymous_id,
      consent_date
    `)
    .eq('consent_given', true)
    .is('consent_withdrawn_date', null);

  if (error || !data) return [];

  // Obtener datos de contacto
  const consentIds = data.map(c => c.id);
  const { data: contactData } = await supabase
    .from('contact_data')
    .select('consent_id, name, phone')
    .in('consent_id', consentIds);

  const contactMap = new Map(contactData?.map(c => [c.consent_id, c]) || []);

  // Enriquecer con estado emocional actual
  const enriched = await Promise.all(data.map(async (consent) => {
    const contact = contactMap.get(consent.id);
    if (!contact) return null;

    // Obtener emociones recientes
    const { data: recentLogs } = await supabase
      .from('emotion_logs')
      .select('emotion')
      .eq('device_id', consent.device_id)
      .order('created_at', { ascending: false })
      .limit(5);

    const negativeCount = recentLogs?.filter(l =>
      ['muy-mal', 'mal'].includes(l.emotion)
    ).length || 0;

    // Obtener última intervención
    const { data: lastIntervention } = await supabase
      .from('interventions')
      .select('created_at')
      .eq('anonymous_id', consent.anonymous_id)
      .order('created_at', { ascending: false })
      .limit(1);

    let currentStatus: 'at_risk' | 'monitoring' | 'stable' = 'stable';
    if (negativeCount >= 3) currentStatus = 'at_risk';
    else if (negativeCount >= 1) currentStatus = 'monitoring';

    return {
      id: consent.id,
      anonymousId: consent.anonymous_id,
      name: contact.name,
      phone: contact.phone,
      consentDate: consent.consent_date,
      currentStatus,
      lastIntervention: lastIntervention?.[0]?.created_at,
    };
  }));

  return enriched.filter((c): c is ContactWithConsent => c !== null);
}

// Registrar una intervención
export async function logIntervention(data: {
  anonymousId: string;
  alertType: string;
  contactOutcome: string;
  adminNotes?: string;
}): Promise<void> {
  const { error } = await supabase.from('interventions').insert({
    anonymous_id: data.anonymousId,
    alert_type: data.alertType,
    contact_attempted: true,
    contact_attempted_at: new Date().toISOString(),
    contact_outcome: data.contactOutcome,
    admin_notes: data.adminNotes || null,
    resolved: ['successful', 'referred'].includes(data.contactOutcome),
    resolved_at: ['successful', 'referred'].includes(data.contactOutcome)
      ? new Date().toISOString()
      : null,
  });

  if (error) {
    console.error('Error logging intervention:', error);
    throw error;
  }
}

// Obtener historial de intervenciones
export async function getInterventions(anonymousId?: string): Promise<Intervention[]> {
  let query = supabase
    .from('interventions')
    .select('*')
    .order('created_at', { ascending: false });

  if (anonymousId) {
    query = query.eq('anonymous_id', anonymousId);
  }

  const { data, error } = await query.limit(50);

  if (error || !data) return [];

  return data.map(i => ({
    id: i.id,
    anonymousId: i.anonymous_id,
    alertType: i.alert_type,
    contactAttempted: i.contact_attempted,
    contactOutcome: i.contact_outcome,
    adminNotes: i.admin_notes,
    resolved: i.resolved,
    createdAt: i.created_at,
  }));
}

// Obtener conteos para los tabs
export async function getTabCounts(): Promise<{ alerts: number; contacts: number }> {
  // Contar alertas activas
  const alerts = await getAlertsWithConsentStatus();

  // Contar contactos con consentimiento
  const { count: contactCount } = await supabase
    .from('contact_consent')
    .select('*', { count: 'exact', head: true })
    .eq('consent_given', true)
    .is('consent_withdrawn_date', null);

  return {
    alerts: alerts.length,
    contacts: contactCount || 0,
  };
}

// ============================================
// ÍNDICE ACOMPAÑA - KPI Principal (0-100)
// ============================================

export type IndiceAcompana = {
  total: number;
  frecuencia: number;
  balance: number;
  recuperacion: number;
  cambioSemanal: number;
};

// Emociones clasificadas
const EMOCIONES_POSITIVAS = ['muy-bien', 'bien'];
const EMOCIONES_NEUTRAS = ['neutral', 'regular'];
const EMOCIONES_NEGATIVAS = ['mal', 'muy-mal'];

export async function getIndiceAcompana(): Promise<IndiceAcompana> {
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // 1. Obtener logs de las últimas 2 semanas
  const { data: allLogs } = await supabase
    .from('emotion_logs')
    .select('device_id, emotion, created_at')
    .gte('created_at', twoWeeksAgo.toISOString())
    .order('created_at', { ascending: true });

  if (!allLogs || allLogs.length === 0) {
    return { total: 0, frecuencia: 0, balance: 0, recuperacion: 0, cambioSemanal: 0 };
  }

  // Separar por semana
  const thisWeekLogs = allLogs.filter(l => new Date(l.created_at) >= oneWeekAgo);
  const lastWeekLogs = allLogs.filter(l => new Date(l.created_at) < oneWeekAgo);

  // 2. FRECUENCIA: Comparar usuarios activos esta semana vs semana pasada
  const thisWeekDevices = new Set(thisWeekLogs.map(l => l.device_id)).size;
  const lastWeekDevices = new Set(lastWeekLogs.map(l => l.device_id)).size;

  let frecuencia = 50; // Base
  if (lastWeekDevices > 0) {
    const ratio = thisWeekDevices / lastWeekDevices;
    frecuencia = Math.min(100, Math.max(0, ratio * 50 + 25)); // Escalar entre 25-100
  } else if (thisWeekDevices > 0) {
    frecuencia = 75; // Nuevos usuarios, señal positiva
  }

  // 3. BALANCE: % de emociones positivas/neutras vs negativas
  const thisWeekEmotions = thisWeekLogs.map(l => l.emotion);
  const positiveNeutral = thisWeekEmotions.filter(e =>
    EMOCIONES_POSITIVAS.includes(e) || EMOCIONES_NEUTRAS.includes(e)
  ).length;
  const total = thisWeekEmotions.length;
  const balance = total > 0 ? (positiveNeutral / total) * 100 : 50;

  // 4. RECUPERACIÓN: % de usuarios que mejoraron después de días malos
  const deviceEmotions = new Map<string, { hadBad: boolean; improved: boolean }>();

  // Agrupar logs por dispositivo ordenados por fecha
  const byDevice = new Map<string, typeof allLogs>();
  thisWeekLogs.forEach(log => {
    if (!byDevice.has(log.device_id)) {
      byDevice.set(log.device_id, []);
    }
    byDevice.get(log.device_id)!.push(log);
  });

  byDevice.forEach((logs, deviceId) => {
    const emotions = logs.map(l => l.emotion);
    let hadBad = false;
    let improved = false;

    for (let i = 0; i < emotions.length; i++) {
      if (EMOCIONES_NEGATIVAS.includes(emotions[i])) {
        hadBad = true;
      } else if (hadBad && (EMOCIONES_POSITIVAS.includes(emotions[i]) || EMOCIONES_NEUTRAS.includes(emotions[i]))) {
        improved = true;
        break;
      }
    }

    deviceEmotions.set(deviceId, { hadBad, improved });
  });

  const usersWithBadDays = Array.from(deviceEmotions.values()).filter(d => d.hadBad);
  const usersImproved = usersWithBadDays.filter(d => d.improved);
  const recuperacion = usersWithBadDays.length > 0
    ? (usersImproved.length / usersWithBadDays.length) * 100
    : 70; // Default si no hay días malos

  // 5. ÍNDICE TOTAL: Promedio ponderado
  const totalIndex = Math.round(
    (frecuencia * 0.4) + (balance * 0.4) + (recuperacion * 0.2)
  );

  // 6. CAMBIO SEMANAL: Comparar balance con semana pasada
  const lastWeekEmotions = lastWeekLogs.map(l => l.emotion);
  const lastWeekPositiveNeutral = lastWeekEmotions.filter(e =>
    EMOCIONES_POSITIVAS.includes(e) || EMOCIONES_NEUTRAS.includes(e)
  ).length;
  const lastWeekBalance = lastWeekEmotions.length > 0
    ? (lastWeekPositiveNeutral / lastWeekEmotions.length) * 100
    : 50;

  const cambioSemanal = Math.round(balance - lastWeekBalance);

  return {
    total: totalIndex,
    frecuencia: Math.round(frecuencia),
    balance: Math.round(balance),
    recuperacion: Math.round(recuperacion),
    cambioSemanal,
  };
}

// ============================================
// INSIGHTS AUTOMÁTICOS
// ============================================

export type AutomaticInsight = {
  type: 'trend' | 'pattern' | 'peak' | 'streak' | 'alert';
  icon: string;
  title: string;
  message: string;
  severity: 'positive' | 'neutral' | 'warning';
};

export async function getAutomaticInsights(): Promise<AutomaticInsight[]> {
  const insights: AutomaticInsight[] = [];
  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data: logs } = await supabase
    .from('emotion_logs')
    .select('emotion, created_at')
    .gte('created_at', twoWeeksAgo.toISOString());

  if (!logs || logs.length < 5) {
    insights.push({
      type: 'alert',
      icon: '📊',
      title: 'Datos insuficientes',
      message: 'Se necesitan más registros para generar insights detallados',
      severity: 'neutral',
    });
    return insights;
  }

  // 1. PATRÓN POR DÍA DE LA SEMANA
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const byDayOfWeek: Record<number, { negative: number; total: number }> = {};

  logs.forEach(log => {
    const day = new Date(log.created_at).getDay();
    if (!byDayOfWeek[day]) {
      byDayOfWeek[day] = { negative: 0, total: 0 };
    }
    byDayOfWeek[day].total++;
    if (EMOCIONES_NEGATIVAS.includes(log.emotion)) {
      byDayOfWeek[day].negative++;
    }
  });

  // Encontrar día con más estrés
  let worstDay = -1;
  let worstRatio = 0;
  let avgRatio = 0;
  let daysCount = 0;

  Object.entries(byDayOfWeek).forEach(([day, stats]) => {
    if (stats.total >= 2) { // Mínimo de registros
      const ratio = stats.negative / stats.total;
      avgRatio += ratio;
      daysCount++;
      if (ratio > worstRatio) {
        worstRatio = ratio;
        worstDay = parseInt(day);
      }
    }
  });

  avgRatio = daysCount > 0 ? avgRatio / daysCount : 0;

  if (worstDay >= 0 && worstRatio > avgRatio * 1.2 && worstRatio > 0.2) {
    const pctAboveAvg = Math.round((worstRatio / avgRatio - 1) * 100);
    insights.push({
      type: 'pattern',
      icon: '📅',
      title: 'Patrón semanal detectado',
      message: `Los ${dayNames[worstDay]} muestran ${pctAboveAvg}% más emociones de estrés que el promedio`,
      severity: 'warning',
    });
  }

  // 2. TENDENCIA SEMANAL
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const thisWeek = logs.filter(l => new Date(l.created_at) >= oneWeekAgo);
  const lastWeek = logs.filter(l => new Date(l.created_at) < oneWeekAgo);

  if (thisWeek.length >= 3 && lastWeek.length >= 3) {
    const thisWeekPositive = thisWeek.filter(l => EMOCIONES_POSITIVAS.includes(l.emotion)).length / thisWeek.length;
    const lastWeekPositive = lastWeek.filter(l => EMOCIONES_POSITIVAS.includes(l.emotion)).length / lastWeek.length;

    const change = Math.round((thisWeekPositive - lastWeekPositive) * 100);

    if (change > 10) {
      insights.push({
        type: 'trend',
        icon: '📈',
        title: 'Tendencia positiva',
        message: `El bienestar emocional mejoró ${change}% respecto a la semana pasada`,
        severity: 'positive',
      });
    } else if (change < -10) {
      insights.push({
        type: 'trend',
        icon: '📉',
        title: 'Tendencia a observar',
        message: `Se detectó una disminución del ${Math.abs(change)}% en bienestar esta semana`,
        severity: 'warning',
      });
    }
  }

  // 3. HORA PICO DE ESTRÉS
  const byHour: Record<number, { negative: number; total: number }> = {};

  logs.forEach(log => {
    const hour = new Date(log.created_at).getHours();
    if (!byHour[hour]) {
      byHour[hour] = { negative: 0, total: 0 };
    }
    byHour[hour].total++;
    if (EMOCIONES_NEGATIVAS.includes(log.emotion)) {
      byHour[hour].negative++;
    }
  });

  let peakHour = -1;
  let peakNegativeCount = 0;

  Object.entries(byHour).forEach(([hour, stats]) => {
    if (stats.negative > peakNegativeCount && stats.total >= 3) {
      peakNegativeCount = stats.negative;
      peakHour = parseInt(hour);
    }
  });

  if (peakHour >= 0 && peakNegativeCount >= 3) {
    const hourStr = peakHour === 0 ? '12AM' : peakHour < 12 ? `${peakHour}AM` : peakHour === 12 ? '12PM' : `${peakHour - 12}PM`;
    insights.push({
      type: 'peak',
      icon: '⏰',
      title: 'Horario crítico identificado',
      message: `Alrededor de las ${hourStr} hay mayor concentración de emociones difíciles`,
      severity: 'neutral',
    });
  }

  // 4. RACHA POSITIVA (últimos días)
  const recentLogs = logs
    .filter(l => new Date(l.created_at) >= new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (recentLogs.length >= 3) {
    const allPositive = recentLogs.every(l =>
      EMOCIONES_POSITIVAS.includes(l.emotion) || EMOCIONES_NEUTRAS.includes(l.emotion)
    );

    if (allPositive) {
      insights.push({
        type: 'streak',
        icon: '🌟',
        title: 'Racha positiva',
        message: `Los últimos ${recentLogs.length} registros muestran emociones positivas o neutras`,
        severity: 'positive',
      });
    }
  }

  return insights;
}

// ============================================
// ALERTAS POR NIVEL (3 niveles)
// ============================================

export type AlertLevel = 'preventivo' | 'atencion' | 'prioritario';

export type AlertWithLevel = AlertWithConsent & {
  level: AlertLevel;
  levelLabel: string;
  levelColor: string;
};

export type AlertsByLevel = {
  preventivo: AlertWithLevel[];
  atencion: AlertWithLevel[];
  prioritario: AlertWithLevel[];
  totals: { preventivo: number; atencion: number; prioritario: number };
};

export async function getAlertsByLevel(): Promise<AlertsByLevel> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Obtener todos los logs negativos de los últimos 7 días
  const { data: riskData, error } = await supabase
    .from('emotion_logs')
    .select('device_id, emotion, created_at')
    .in('emotion', ['muy-mal', 'mal'])
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error || !riskData) {
    return {
      preventivo: [],
      atencion: [],
      prioritario: [],
      totals: { preventivo: 0, atencion: 0, prioritario: 0 },
    };
  }

  // Contar por dispositivo
  const deviceCounts = new Map<string, { count: number; lastLog: string }>();

  riskData.forEach(log => {
    const current = deviceCounts.get(log.device_id);
    if (!current) {
      deviceCounts.set(log.device_id, { count: 1, lastLog: log.created_at });
    } else {
      current.count++;
    }
  });

  // Obtener consentimientos
  const deviceIds = Array.from(deviceCounts.keys());
  const { data: consents } = await supabase
    .from('contact_consent')
    .select('device_id, anonymous_id, consent_given, consent_withdrawn_date')
    .in('device_id', deviceIds);

  const consentMap = new Map(consents?.map(c => [c.device_id, c]) || []);

  // Clasificar por nivel
  const result: AlertsByLevel = {
    preventivo: [],
    atencion: [],
    prioritario: [],
    totals: { preventivo: 0, atencion: 0, prioritario: 0 },
  };

  deviceCounts.forEach((stats, deviceId) => {
    const consent = consentMap.get(deviceId);
    const hasConsent = consent?.consent_given && !consent?.consent_withdrawn_date;

    let level: AlertLevel;
    let levelLabel: string;
    let levelColor: string;

    if (stats.count >= 5) {
      level = 'prioritario';
      levelLabel = 'Prioritario';
      levelColor = '#EF4444'; // Rojo
    } else if (stats.count >= 3) {
      level = 'atencion';
      levelLabel = 'Atención';
      levelColor = '#F59E0B'; // Amarillo
    } else {
      level = 'preventivo';
      levelLabel = 'Preventivo';
      levelColor = '#10B981'; // Verde
    }

    const alert: AlertWithLevel = {
      anonymousId: consent?.anonymous_id || deviceId.substring(0, 16),
      deviceId,
      negativeCount: stats.count,
      lastActivity: stats.lastLog,
      alertType: 'emotional_pattern',
      hasConsent: !!hasConsent,
      level,
      levelLabel,
      levelColor,
    };

    result[level].push(alert);
    result.totals[level]++;
  });

  // Ordenar cada nivel por cantidad de registros negativos (descendente)
  result.preventivo.sort((a, b) => b.negativeCount - a.negativeCount);
  result.atencion.sort((a, b) => b.negativeCount - a.negativeCount);
  result.prioritario.sort((a, b) => b.negativeCount - a.negativeCount);

  return result;
}

// ============================================
// CARACTERÍSTICAS PREMIUM - NUEVOS TIPOS
// ============================================

// 2.1 Recomendaciones Accionables
export type RecommendationPriority = 'urgente' | 'sugerido' | 'oportunidad';

export type ActionableRecommendation = {
  id: string;
  priority: RecommendationPriority;
  priorityIcon: string;
  priorityColor: string;
  title: string;
  action: string;
  dataSupport: string;
  category: 'peak_hours' | 'inactive_users' | 'positive_patterns' | 'intervention_timing';
};

// 2.2 Predicción de Riesgo (72h)
export type RiskTrend = 'declining_fast' | 'declining' | 'stable' | 'improving';

export type UserRiskPrediction = {
  deviceId: string;
  anonymousId: string;
  riskScore: number;
  trend: RiskTrend;
  trendArrows: string;
  hasConsent: boolean;
  daysSincePositive: number;
  recentEmotions: string[];
};

export type EarlyWarningData = {
  users: UserRiskPrediction[];
  totalAtRisk: number;
  totalWithConsent: number;
};

// 2.3 Línea Emocional por Usuario
export type EmotionTimelinePoint = {
  date: string;
  dayLabel: string;
  emotion: string | null;
  emotionScore: number;
  hasIntervention: boolean;
  interventionType?: string;
};

export type UserEmotionalTimeline = {
  deviceId: string;
  anonymousId: string;
  timeline: EmotionTimelinePoint[];
  hasRecovery: boolean;
  recoveryNote?: string;
};

// 2.4 Impacto de Intervenciones
export type InterventionImpactMetrics = {
  improvementAt24h: number;
  improvementAt72h: number;
  totalInterventions: number;
  usersWithFollowUp: number;
  byType: {
    type: string;
    typeLabel: string;
    count: number;
    effectivenessRate: number;
  }[];
  avgEmotionBefore: number;
  avgEmotionAfter: number;
  avgDaysToRecovery: number;
};

// 2.5 Comparativas Temporales
export type PeriodComparison = {
  label: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  isPositive: boolean;
};

export type TemporalComparisonData = {
  weekComparison: {
    period: string;
    metrics: PeriodComparison[];
  };
  thirtyDayTrend: {
    date: string;
    indiceAcompana: number;
    positivePercentage: number;
    activeUsers: number;
  }[];
};

// ============================================
// HELPER: Convertir emoción a score numérico
// ============================================

const EMOTION_SCORES: Record<string, number> = {
  'muy-mal': 1,
  'mal': 2,
  'neutral': 3,
  'bien': 4,
  'muy-bien': 5,
};

const DAY_LABELS_ES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function emotionToScore(emotion: string): number {
  return EMOTION_SCORES[emotion] || 3;
}

// ============================================
// 2.5 COMPARATIVAS TEMPORALES
// ============================================

export async function getTemporalComparisons(): Promise<TemporalComparisonData> {
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Obtener todos los logs de los últimos 30 días
  const { data: allLogs } = await supabase
    .from('emotion_logs')
    .select('device_id, emotion, created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  if (!allLogs || allLogs.length === 0) {
    return {
      weekComparison: { period: 'Esta semana vs Semana pasada', metrics: [] },
      thirtyDayTrend: [],
    };
  }

  // Separar logs por semana
  const thisWeekLogs = allLogs.filter(l => new Date(l.created_at) >= oneWeekAgo);
  const lastWeekLogs = allLogs.filter(l => {
    const date = new Date(l.created_at);
    return date >= twoWeeksAgo && date < oneWeekAgo;
  });

  // Calcular métricas para esta semana
  const thisWeekPositive = thisWeekLogs.filter(l =>
    EMOCIONES_POSITIVAS.includes(l.emotion)
  ).length;
  const thisWeekDevices = new Set(thisWeekLogs.map(l => l.device_id)).size;
  const thisWeekNegative = thisWeekLogs.filter(l =>
    EMOCIONES_NEGATIVAS.includes(l.emotion)
  ).length;

  // Calcular métricas para semana pasada
  const lastWeekPositive = lastWeekLogs.filter(l =>
    EMOCIONES_POSITIVAS.includes(l.emotion)
  ).length;
  const lastWeekDevices = new Set(lastWeekLogs.map(l => l.device_id)).size;
  const lastWeekNegative = lastWeekLogs.filter(l =>
    EMOCIONES_NEGATIVAS.includes(l.emotion)
  ).length;

  // Calcular porcentajes
  const thisWeekPositivePct = thisWeekLogs.length > 0
    ? Math.round((thisWeekPositive / thisWeekLogs.length) * 100)
    : 0;
  const lastWeekPositivePct = lastWeekLogs.length > 0
    ? Math.round((lastWeekPositive / lastWeekLogs.length) * 100)
    : 0;

  // Construir métricas de comparación
  const metrics: PeriodComparison[] = [
    {
      label: 'Emociones positivas',
      current: thisWeekPositivePct,
      previous: lastWeekPositivePct,
      change: thisWeekPositivePct - lastWeekPositivePct,
      changePercent: lastWeekPositivePct > 0
        ? Math.round(((thisWeekPositivePct - lastWeekPositivePct) / lastWeekPositivePct) * 100)
        : 0,
      trend: thisWeekPositivePct > lastWeekPositivePct ? 'up' : thisWeekPositivePct < lastWeekPositivePct ? 'down' : 'stable',
      isPositive: thisWeekPositivePct >= lastWeekPositivePct,
    },
    {
      label: 'Usuarios activos',
      current: thisWeekDevices,
      previous: lastWeekDevices,
      change: thisWeekDevices - lastWeekDevices,
      changePercent: lastWeekDevices > 0
        ? Math.round(((thisWeekDevices - lastWeekDevices) / lastWeekDevices) * 100)
        : 0,
      trend: thisWeekDevices > lastWeekDevices ? 'up' : thisWeekDevices < lastWeekDevices ? 'down' : 'stable',
      isPositive: thisWeekDevices >= lastWeekDevices,
    },
    {
      label: 'Emociones negativas',
      current: thisWeekNegative,
      previous: lastWeekNegative,
      change: thisWeekNegative - lastWeekNegative,
      changePercent: lastWeekNegative > 0
        ? Math.round(((thisWeekNegative - lastWeekNegative) / lastWeekNegative) * 100)
        : 0,
      trend: thisWeekNegative > lastWeekNegative ? 'up' : thisWeekNegative < lastWeekNegative ? 'down' : 'stable',
      isPositive: thisWeekNegative <= lastWeekNegative, // Menos negativas es mejor
    },
  ];

  // Tendencia de 30 días (agrupar por día)
  const byDay = new Map<string, { positive: number; total: number; devices: Set<string> }>();

  allLogs.forEach(log => {
    const day = new Date(log.created_at).toISOString().split('T')[0];
    if (!byDay.has(day)) {
      byDay.set(day, { positive: 0, total: 0, devices: new Set() });
    }
    const dayData = byDay.get(day)!;
    dayData.total++;
    dayData.devices.add(log.device_id);
    if (EMOCIONES_POSITIVAS.includes(log.emotion) || log.emotion === 'neutral') {
      dayData.positive++;
    }
  });

  const thirtyDayTrend = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      indiceAcompana: data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0,
      positivePercentage: data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0,
      activeUsers: data.devices.size,
    }));

  return {
    weekComparison: {
      period: 'Esta semana vs Semana pasada',
      metrics,
    },
    thirtyDayTrend,
  };
}

// ============================================
// 2.4 IMPACTO DE INTERVENCIONES
// ============================================

const OUTCOME_LABELS: Record<string, string> = {
  'successful': 'Contacto exitoso',
  'referred': 'Referido a profesional',
  'follow_up': 'Seguimiento pendiente',
  'no_answer': 'Sin respuesta',
  'declined': 'Rechazó ayuda',
};

export async function getInterventionImpactMetrics(): Promise<InterventionImpactMetrics> {
  // Obtener todas las intervenciones de los últimos 90 días
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: interventions } = await supabase
    .from('interventions')
    .select('*')
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (!interventions || interventions.length === 0) {
    return {
      improvementAt24h: 0,
      improvementAt72h: 0,
      totalInterventions: 0,
      usersWithFollowUp: 0,
      byType: [],
      avgEmotionBefore: 0,
      avgEmotionAfter: 0,
      avgDaysToRecovery: 0,
    };
  }

  // Obtener todos los consent para mapear anonymous_id a device_id
  const anonymousIds = [...new Set(interventions.map(i => i.anonymous_id))];
  const { data: consents } = await supabase
    .from('contact_consent')
    .select('device_id, anonymous_id')
    .in('anonymous_id', anonymousIds);

  const anonToDevice = new Map(consents?.map(c => [c.anonymous_id, c.device_id]) || []);

  // Para cada intervención, buscar emociones antes y después
  let improved24h = 0;
  let improved72h = 0;
  let total24h = 0;
  let total72h = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  let sumBefore = 0;
  let sumAfter = 0;
  let recoveryDays: number[] = [];

  for (const intervention of interventions) {
    const deviceId = anonToDevice.get(intervention.anonymous_id);
    if (!deviceId) continue;

    const interventionDate = new Date(intervention.created_at);
    const before24h = new Date(interventionDate.getTime() - 24 * 60 * 60 * 1000);
    const after24h = new Date(interventionDate.getTime() + 24 * 60 * 60 * 1000);
    const after72h = new Date(interventionDate.getTime() + 72 * 60 * 60 * 1000);

    // Obtener emoción ANTES de la intervención (última emoción previa)
    const { data: beforeLogs } = await supabase
      .from('emotion_logs')
      .select('emotion, created_at')
      .eq('device_id', deviceId)
      .lt('created_at', interventionDate.toISOString())
      .gte('created_at', before24h.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    // Obtener emociones DESPUÉS de la intervención
    const { data: afterLogs } = await supabase
      .from('emotion_logs')
      .select('emotion, created_at')
      .eq('device_id', deviceId)
      .gt('created_at', interventionDate.toISOString())
      .lte('created_at', after72h.toISOString())
      .order('created_at', { ascending: true });

    if (beforeLogs && beforeLogs.length > 0) {
      const beforeScore = emotionToScore(beforeLogs[0].emotion);
      sumBefore += beforeScore;
      totalBefore++;

      if (afterLogs && afterLogs.length > 0) {
        // Verificar mejora a 24h
        const logsAt24h = afterLogs.filter(l =>
          new Date(l.created_at) <= after24h
        );
        if (logsAt24h.length > 0) {
          const afterScore24h = emotionToScore(logsAt24h[logsAt24h.length - 1].emotion);
          total24h++;
          if (afterScore24h > beforeScore) improved24h++;
        }

        // Verificar mejora a 72h
        const afterScore72h = emotionToScore(afterLogs[afterLogs.length - 1].emotion);
        total72h++;
        if (afterScore72h > beforeScore) improved72h++;

        sumAfter += afterScore72h;
        totalAfter++;

        // Calcular días hasta recuperación (primera emoción positiva)
        const firstPositive = afterLogs.find(l =>
          EMOCIONES_POSITIVAS.includes(l.emotion)
        );
        if (firstPositive) {
          const daysToRecovery = Math.ceil(
            (new Date(firstPositive.created_at).getTime() - interventionDate.getTime()) /
            (24 * 60 * 60 * 1000)
          );
          recoveryDays.push(daysToRecovery);
        }
      }
    }
  }

  // Agrupar por tipo de resultado
  const byOutcome = new Map<string, { count: number; successful: number }>();
  interventions.forEach(i => {
    const outcome = i.contact_outcome || 'unknown';
    if (!byOutcome.has(outcome)) {
      byOutcome.set(outcome, { count: 0, successful: 0 });
    }
    byOutcome.get(outcome)!.count++;
    if (i.resolved) {
      byOutcome.get(outcome)!.successful++;
    }
  });

  const byType = Array.from(byOutcome.entries())
    .filter(([type]) => type !== 'unknown')
    .map(([type, stats]) => ({
      type,
      typeLabel: OUTCOME_LABELS[type] || type,
      count: stats.count,
      effectivenessRate: stats.count > 0
        ? Math.round((stats.successful / stats.count) * 100)
        : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    improvementAt24h: total24h > 0 ? Math.round((improved24h / total24h) * 100) : 0,
    improvementAt72h: total72h > 0 ? Math.round((improved72h / total72h) * 100) : 0,
    totalInterventions: interventions.length,
    usersWithFollowUp: total72h,
    byType,
    avgEmotionBefore: totalBefore > 0 ? Math.round((sumBefore / totalBefore) * 10) / 10 : 0,
    avgEmotionAfter: totalAfter > 0 ? Math.round((sumAfter / totalAfter) * 10) / 10 : 0,
    avgDaysToRecovery: recoveryDays.length > 0
      ? Math.round((recoveryDays.reduce((a, b) => a + b, 0) / recoveryDays.length) * 10) / 10
      : 0,
  };
}

// ============================================
// 2.1 RECOMENDACIONES ACCIONABLES
// ============================================

export async function getActionableRecommendations(): Promise<ActionableRecommendation[]> {
  const recommendations: ActionableRecommendation[] = [];
  const today = new Date();
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fortyEightHoursAgo = new Date(today);
  fortyEightHoursAgo.setTime(fortyEightHoursAgo.getTime() - 48 * 60 * 60 * 1000);

  // Obtener logs de las últimas 2 semanas
  const { data: logs } = await supabase
    .from('emotion_logs')
    .select('device_id, emotion, created_at')
    .gte('created_at', fourteenDaysAgo.toISOString());

  if (!logs || logs.length < 10) {
    return recommendations;
  }

  // 1. DETECTAR HORAS PICO DE EMOCIONES NEGATIVAS
  const byHour: Record<number, { negative: number; total: number }> = {};
  let totalNegative = 0;
  let totalLogs = 0;

  logs.forEach(log => {
    const hour = new Date(log.created_at).getHours();
    if (!byHour[hour]) {
      byHour[hour] = { negative: 0, total: 0 };
    }
    byHour[hour].total++;
    totalLogs++;
    if (EMOCIONES_NEGATIVAS.includes(log.emotion)) {
      byHour[hour].negative++;
      totalNegative++;
    }
  });

  const avgNegativeRate = totalLogs > 0 ? totalNegative / totalLogs : 0;

  // Encontrar horas con >40% más emociones negativas que el promedio
  const peakNegativeHours: { hour: number; rate: number; pctAbove: number }[] = [];
  Object.entries(byHour).forEach(([hour, stats]) => {
    if (stats.total >= 5) { // Mínimo de muestras
      const rate = stats.negative / stats.total;
      if (rate > avgNegativeRate * 1.4) {
        peakNegativeHours.push({
          hour: parseInt(hour),
          rate,
          pctAbove: Math.round((rate / avgNegativeRate - 1) * 100),
        });
      }
    }
  });

  if (peakNegativeHours.length > 0) {
    const worst = peakNegativeHours.sort((a, b) => b.pctAbove - a.pctAbove)[0];
    const hourStr = worst.hour === 0 ? '12:00 AM' :
                    worst.hour < 12 ? `${worst.hour}:00 AM` :
                    worst.hour === 12 ? '12:00 PM' :
                    `${worst.hour - 12}:00 PM`;
    const nextHour = (worst.hour + 2) % 24;
    const nextHourStr = nextHour === 0 ? '12:00 AM' :
                        nextHour < 12 ? `${nextHour}:00 AM` :
                        nextHour === 12 ? '12:00 PM' :
                        `${nextHour - 12}:00 PM`;

    recommendations.push({
      id: 'peak_hours_1',
      priority: 'urgente',
      priorityIcon: '🔴',
      priorityColor: '#EF4444',
      title: 'Horario crítico detectado',
      action: `Aumentar mensajes preventivos entre ${hourStr} y ${nextHourStr}`,
      dataSupport: `Detectamos ${worst.pctAbove}% más emociones negativas en este horario`,
      category: 'peak_hours',
    });
  }

  // 2. DETECTAR USUARIOS INACTIVOS >48h
  const allDevices = new Set(logs.map(l => l.device_id));
  const recentDevices = new Set(
    logs.filter(l => new Date(l.created_at) >= fortyEightHoursAgo)
      .map(l => l.device_id)
  );
  const inactiveCount = allDevices.size - recentDevices.size;

  if (inactiveCount >= 3) {
    recommendations.push({
      id: 'inactive_users_1',
      priority: 'sugerido',
      priorityIcon: '🟡',
      priorityColor: '#F59E0B',
      title: 'Usuarios sin actividad',
      action: `Revisar ${inactiveCount} usuarios sin actividad en las últimas 48h`,
      dataSupport: `${inactiveCount} dispositivos no han registrado emociones recientemente`,
      category: 'inactive_users',
    });
  }

  // 3. DETECTAR PATRONES POSITIVOS PARA REFORZAR
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const byDayOfWeek: Record<number, { positive: number; total: number }> = {};

  logs.forEach(log => {
    const day = new Date(log.created_at).getDay();
    if (!byDayOfWeek[day]) {
      byDayOfWeek[day] = { positive: 0, total: 0 };
    }
    byDayOfWeek[day].total++;
    if (EMOCIONES_POSITIVAS.includes(log.emotion)) {
      byDayOfWeek[day].positive++;
    }
  });

  let bestDay = -1;
  let bestPositiveRate = 0;
  let avgPositiveRate = 0;
  let daysCount = 0;

  Object.entries(byDayOfWeek).forEach(([day, stats]) => {
    if (stats.total >= 3) {
      const rate = stats.positive / stats.total;
      avgPositiveRate += rate;
      daysCount++;
      if (rate > bestPositiveRate) {
        bestPositiveRate = rate;
        bestDay = parseInt(day);
      }
    }
  });

  avgPositiveRate = daysCount > 0 ? avgPositiveRate / daysCount : 0;

  if (bestDay >= 0 && bestPositiveRate > avgPositiveRate * 1.2) {
    const pctAbove = Math.round((bestPositiveRate / avgPositiveRate - 1) * 100);
    recommendations.push({
      id: 'positive_pattern_1',
      priority: 'oportunidad',
      priorityIcon: '🟢',
      priorityColor: '#10B981',
      title: 'Patrón positivo detectado',
      action: `Reforzar mensajes positivos los ${dayNames[bestDay]}`,
      dataSupport: `Los ${dayNames[bestDay]} tienen ${pctAbove}% más emociones positivas`,
      category: 'positive_patterns',
    });
  }

  // 4. SUGERENCIA DE TIMING DE INTERVENCIÓN (basado en éxito histórico)
  const { data: interventions } = await supabase
    .from('interventions')
    .select('created_at, resolved')
    .eq('contact_attempted', true);

  if (interventions && interventions.length >= 5) {
    const byInterventionHour: Record<number, { resolved: number; total: number }> = {};

    interventions.forEach(i => {
      const hour = new Date(i.created_at).getHours();
      if (!byInterventionHour[hour]) {
        byInterventionHour[hour] = { resolved: 0, total: 0 };
      }
      byInterventionHour[hour].total++;
      if (i.resolved) {
        byInterventionHour[hour].resolved++;
      }
    });

    let bestInterventionHour = -1;
    let bestSuccessRate = 0;

    Object.entries(byInterventionHour).forEach(([hour, stats]) => {
      if (stats.total >= 2) {
        const rate = stats.resolved / stats.total;
        if (rate > bestSuccessRate) {
          bestSuccessRate = rate;
          bestInterventionHour = parseInt(hour);
        }
      }
    });

    if (bestInterventionHour >= 0 && bestSuccessRate >= 0.6) {
      const hourStr = bestInterventionHour === 0 ? '12:00 AM' :
                      bestInterventionHour < 12 ? `${bestInterventionHour}:00 AM` :
                      bestInterventionHour === 12 ? '12:00 PM' :
                      `${bestInterventionHour - 12}:00 PM`;

      recommendations.push({
        id: 'intervention_timing_1',
        priority: 'sugerido',
        priorityIcon: '🟡',
        priorityColor: '#F59E0B',
        title: 'Horario óptimo de contacto',
        action: `Realizar intervenciones alrededor de las ${hourStr}`,
        dataSupport: `${Math.round(bestSuccessRate * 100)}% de éxito histórico en este horario`,
        category: 'intervention_timing',
      });
    }
  }

  // Ordenar por prioridad
  const priorityOrder: Record<RecommendationPriority, number> = {
    'urgente': 0,
    'sugerido': 1,
    'oportunidad': 2,
  };

  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ============================================
// 2.3 LÍNEA EMOCIONAL POR USUARIO
// ============================================

export async function getUserEmotionalTimeline(
  deviceId: string,
  days: number = 7
): Promise<UserEmotionalTimeline | null> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  // Obtener logs del dispositivo
  const { data: logs } = await supabase
    .from('emotion_logs')
    .select('emotion, created_at')
    .eq('device_id', deviceId)
    .gte('created_at', fromDate.toISOString())
    .order('created_at', { ascending: true });

  // Obtener anonymous_id para buscar intervenciones
  const { data: consent } = await supabase
    .from('contact_consent')
    .select('anonymous_id')
    .eq('device_id', deviceId)
    .single();

  const anonymousId = consent?.anonymous_id || deviceId.substring(0, 16);

  // Obtener intervenciones
  const { data: interventions } = await supabase
    .from('interventions')
    .select('created_at, contact_outcome')
    .eq('anonymous_id', anonymousId)
    .gte('created_at', fromDate.toISOString());

  // Crear mapa de intervenciones por fecha
  const interventionsByDate = new Map<string, string>();
  interventions?.forEach(i => {
    const date = new Date(i.created_at).toISOString().split('T')[0];
    interventionsByDate.set(date, i.contact_outcome || 'contacto');
  });

  // Crear mapa de emociones por fecha (usar la última del día)
  const emotionsByDate = new Map<string, string>();
  logs?.forEach(log => {
    const date = new Date(log.created_at).toISOString().split('T')[0];
    emotionsByDate.set(date, log.emotion);
  });

  // Construir timeline de los últimos N días
  const timeline: EmotionTimelinePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    const emotion = emotionsByDate.get(dateStr) || null;
    const hasIntervention = interventionsByDate.has(dateStr);

    timeline.push({
      date: dateStr,
      dayLabel: DAY_LABELS_ES[dayOfWeek],
      emotion,
      emotionScore: emotion ? emotionToScore(emotion) : 0,
      hasIntervention,
      interventionType: hasIntervention ? interventionsByDate.get(dateStr) : undefined,
    });
  }

  // Detectar patrón de recuperación
  let hasRecovery = false;
  let recoveryNote: string | undefined;

  if (interventions && interventions.length > 0 && logs && logs.length > 0) {
    // Buscar si hubo mejora después de la última intervención
    const lastIntervention = interventions[interventions.length - 1];
    const logsAfterIntervention = logs.filter(l =>
      new Date(l.created_at) > new Date(lastIntervention.created_at)
    );

    if (logsAfterIntervention.length > 0) {
      const lastLogBeforeIntervention = logs.find(l =>
        new Date(l.created_at) < new Date(lastIntervention.created_at)
      );

      if (lastLogBeforeIntervention) {
        const beforeScore = emotionToScore(lastLogBeforeIntervention.emotion);
        const afterScore = emotionToScore(logsAfterIntervention[logsAfterIntervention.length - 1].emotion);

        if (afterScore > beforeScore) {
          hasRecovery = true;
          const dayOfIntervention = DAY_LABELS_ES[new Date(lastIntervention.created_at).getDay()];
          recoveryNote = `Intervención el ${dayOfIntervention} → Mejoró después`;
        }
      }
    }
  }

  return {
    deviceId: deviceId.substring(0, 8) + '...',
    anonymousId,
    timeline,
    hasRecovery,
    recoveryNote,
  };
}

// ============================================
// 2.2 PREDICCIÓN DE ALERTA TEMPRANA (72h)
// ============================================

export async function getEarlyWarningPredictions(): Promise<EarlyWarningData> {
  const today = new Date();
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Obtener todos los logs de las últimas 2 semanas
  const { data: allLogs } = await supabase
    .from('emotion_logs')
    .select('device_id, emotion, created_at')
    .gte('created_at', fourteenDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  if (!allLogs || allLogs.length === 0) {
    return { users: [], totalAtRisk: 0, totalWithConsent: 0 };
  }

  // Agrupar por dispositivo
  const byDevice = new Map<string, typeof allLogs>();
  allLogs.forEach(log => {
    if (!byDevice.has(log.device_id)) {
      byDevice.set(log.device_id, []);
    }
    byDevice.get(log.device_id)!.push(log);
  });

  // Obtener consentimientos
  const deviceIds = Array.from(byDevice.keys());
  const { data: consents } = await supabase
    .from('contact_consent')
    .select('device_id, anonymous_id, consent_given, consent_withdrawn_date')
    .in('device_id', deviceIds);

  const consentMap = new Map(consents?.map(c => [c.device_id, c]) || []);

  // Calcular riesgo para cada dispositivo
  const predictions: UserRiskPrediction[] = [];

  byDevice.forEach((logs, deviceId) => {
    // Solo analizar dispositivos con actividad reciente (última semana)
    const recentLogs = logs.filter(l => new Date(l.created_at) >= sevenDaysAgo);
    if (recentLogs.length === 0) return;

    // 1. TRAYECTORIA EMOCIONAL (40% del score)
    // Comparar últimos 3 días vs días 4-7
    const last3Days = logs.filter(l => new Date(l.created_at) >= threeDaysAgo);
    const days4to7 = logs.filter(l => {
      const date = new Date(l.created_at);
      return date >= sevenDaysAgo && date < threeDaysAgo;
    });

    let trajectoryScore = 50; // Base
    if (last3Days.length > 0 && days4to7.length > 0) {
      const recent3Avg = last3Days.reduce((sum, l) => sum + emotionToScore(l.emotion), 0) / last3Days.length;
      const older4to7Avg = days4to7.reduce((sum, l) => sum + emotionToScore(l.emotion), 0) / days4to7.length;

      // Si está empeorando, aumentar riesgo
      const decline = older4to7Avg - recent3Avg;
      trajectoryScore = Math.min(100, Math.max(0, 50 + (decline * 20)));
    } else if (last3Days.length > 0) {
      // Solo tenemos datos recientes
      const recentAvg = last3Days.reduce((sum, l) => sum + emotionToScore(l.emotion), 0) / last3Days.length;
      trajectoryScore = Math.min(100, Math.max(0, (5 - recentAvg) * 25));
    }

    // 2. CAÍDA EN FRECUENCIA (25% del score)
    const thisWeekCount = recentLogs.length;
    const lastWeekLogs = logs.filter(l => {
      const date = new Date(l.created_at);
      return date < sevenDaysAgo;
    });
    const lastWeekCount = lastWeekLogs.length;

    let frequencyScore = 0;
    if (lastWeekCount > 0) {
      const dropRate = 1 - (thisWeekCount / lastWeekCount);
      frequencyScore = Math.min(100, Math.max(0, dropRate * 100));
    }

    // 3. DÍAS SIN EMOCIÓN POSITIVA (25% del score)
    const sortedLogs = logs.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    let daysSincePositive = 14; // Default máximo
    for (const log of sortedLogs) {
      if (EMOCIONES_POSITIVAS.includes(log.emotion)) {
        daysSincePositive = Math.ceil(
          (today.getTime() - new Date(log.created_at).getTime()) / (24 * 60 * 60 * 1000)
        );
        break;
      }
    }

    const daysSincePositiveScore = Math.min(100, (daysSincePositive / 7) * 100);

    // 4. PATRÓN CONSISTENTE DE NEGATIVOS (10% del score)
    const negativeCount = recentLogs.filter(l => EMOCIONES_NEGATIVAS.includes(l.emotion)).length;
    const patternScore = recentLogs.length > 0
      ? (negativeCount / recentLogs.length) * 100
      : 0;

    // CALCULAR SCORE TOTAL
    const riskScore = Math.round(
      (trajectoryScore * 0.40) +
      (frequencyScore * 0.25) +
      (daysSincePositiveScore * 0.25) +
      (patternScore * 0.10)
    );

    // Determinar tendencia y flechas
    let trend: RiskTrend;
    let trendArrows: string;

    if (trajectoryScore >= 70) {
      trend = 'declining_fast';
      trendArrows = '↘↘↘';
    } else if (trajectoryScore >= 55) {
      trend = 'declining';
      trendArrows = '↘↘';
    } else if (trajectoryScore >= 45) {
      trend = 'stable';
      trendArrows = '→';
    } else {
      trend = 'improving';
      trendArrows = '↗';
    }

    // Solo incluir usuarios con riesgo significativo (>= 50%)
    if (riskScore >= 50) {
      const consent = consentMap.get(deviceId);
      const hasConsent = consent?.consent_given && !consent?.consent_withdrawn_date;

      predictions.push({
        deviceId: deviceId.substring(0, 8) + '...',
        anonymousId: consent?.anonymous_id || deviceId.substring(0, 16),
        riskScore,
        trend,
        trendArrows,
        hasConsent: !!hasConsent,
        daysSincePositive,
        recentEmotions: last3Days.slice(-5).map(l => l.emotion),
      });
    }
  });

  // Ordenar por riesgo descendente
  predictions.sort((a, b) => b.riskScore - a.riskScore);

  return {
    users: predictions.slice(0, 20), // Limitar a top 20
    totalAtRisk: predictions.length,
    totalWithConsent: predictions.filter(p => p.hasConsent).length,
  };
}
