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
