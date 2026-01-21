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

  if (error || !data) return [];

  // Agrupar por día
  const byDay = new Map<string, Record<string, number>>();

  data.forEach(log => {
    const day = new Date(log.created_at).toISOString().split('T')[0];
    if (!byDay.has(day)) {
      byDay.set(day, {});
    }
    const dayData = byDay.get(day)!;
    dayData[log.emotion] = (dayData[log.emotion] || 0) + 1;
  });

  return Array.from(byDay.entries()).map(([date, emotions]) => ({
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
