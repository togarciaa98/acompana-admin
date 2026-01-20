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

// Obtener estadísticas de usuarios
export async function getUserStats() {
  const { data, error } = await supabase
    .from('users')
    .select('gender, birth_date, age, created_at');

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

    // Por edad (rangos) - usar birth_date si existe, sino usar age
    let age = user.age;
    if (user.birth_date) {
      age = calculateAge(user.birth_date);
    }

    if (age) {
      let ageRange = '31+';
      if (age <= 15) ageRange = '13-15';
      else if (age <= 18) ageRange = '16-18';
      else if (age <= 24) ageRange = '19-24';
      else if (age <= 30) ageRange = '25-30';
      byAge[ageRange] = (byAge[ageRange] || 0) + 1;
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
