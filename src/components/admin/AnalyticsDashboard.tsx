import React, { useState, useEffect, useMemo } from 'react';
import { AnalyticsMetrics, DayStat, PageStat, SourceStat } from '../../types';
import { getAnalyticsMetrics, resetLocalAnalytics, recordSiteVisit } from '../../services/analytics';
import { isSupabaseConfigured, getSupabase } from '../../services/supabase';
import {
  BarChart3,
  TrendingUp,
  Users,
  UserCheck,
  Calendar,
  Clock,
  Activity,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
  ArrowUpRight,
  Eye,
  Layers,
  ShieldCheck,
  Database,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d' | 'year' | 'all'>('30d');
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChartMetric, setActiveChartMetric] = useState<'all' | 'visits' | 'unique'>('all');
  const [hoveredDay, setHoveredDay] = useState<DayStat | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAnalyticsMetrics(timeRange);
      setMetrics(data);
    } catch (e) {
      console.error('Error cargando métricas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeRange]);

  // Peak and average calculation for chart
  const chartSummary = useMemo(() => {
    if (!metrics || !metrics.dailyEvolution || !metrics.dailyEvolution.length) {
      return { peakVisits: 0, peakDate: '', avgDaily: 0, totalPeriodVisits: 0 };
    }
    const days = metrics.dailyEvolution;
    let peak = 0;
    let peakDate = '';
    let total = 0;

    days.forEach((d) => {
      total += d.visits;
      if (d.visits > peak) {
        peak = d.visits;
        peakDate = d.displayDate;
      }
    });

    const avg = days.length > 0 ? Math.round(total / days.length) : 0;
    return {
      peakVisits: peak,
      peakDate,
      avgDaily: avg,
      totalPeriodVisits: total,
    };
  }, [metrics]);

  const handleResetData = () => {
    if (window.confirm('¿Deseas reiniciar las estadísticas locales de visitas? Se borrará el historial guardado en este navegador.')) {
      resetLocalAnalytics();
      loadData();
    }
  };

  const handleCopySql = () => {
    const sql = `CREATE TABLE IF NOT EXISTS public.site_visits (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  source TEXT NOT NULL,
  device TEXT NOT NULL,
  is_new_visitor BOOLEAN DEFAULT true,
  is_new_session BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura pública de visitas" ON public.site_visits;
DROP POLICY IF EXISTS "Inserción de visitas" ON public.site_visits;
CREATE POLICY "Lectura pública de visitas" ON public.site_visits FOR SELECT USING (true);
CREATE POLICY "Inserción de visitas" ON public.site_visits FOR ALL USING (true);`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Device percentages
  const devicePercentages = useMemo(() => {
    if (!metrics) return { mobile: 70, desktop: 25, tablet: 5 };
    const { mobile, desktop, tablet } = metrics.deviceBreakdown;
    const total = mobile + desktop + tablet;
    if (total === 0) return { mobile: 70, desktop: 25, tablet: 5 };
    return {
      mobile: Math.round((mobile / total) * 100),
      desktop: Math.round((desktop / total) * 100),
      tablet: Math.round((tablet / total) * 100),
    };
  }, [metrics]);

  // SVG Chart Dimensions
  const chartHeight = 220;
  const chartWidth = 700;
  const paddingX = 40;
  const paddingY = 25;

  const chartData = metrics?.dailyEvolution || [];
  const maxChartValue = useMemo(() => {
    if (!chartData.length) return 10;
    const max = Math.max(...chartData.map((d) => Math.max(d.visits, d.uniqueVisitors, 1)));
    // Add 15% headroom
    return Math.ceil(max * 1.15);
  }, [chartData]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 font-['Montserrat'] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#0058bb]" />
              Estadísticas de Visitas & Tráfico
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a650] animate-pulse"></span>
              En Vivo
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Registro automático de visitas con deduplicación de recargas consecutivas y análisis de fuentes de tráfico.
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-semibold text-gray-600">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                timeRange === 'today' ? 'bg-white text-[#0058bb] shadow-xs font-bold' : 'hover:text-gray-900'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                timeRange === '7d' ? 'bg-white text-[#0058bb] shadow-xs font-bold' : 'hover:text-gray-900'
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                timeRange === '30d' ? 'bg-white text-[#0058bb] shadow-xs font-bold' : 'hover:text-gray-900'
              }`}
            >
              30 Días
            </button>
            <button
              onClick={() => setTimeRange('90d')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                timeRange === '90d' ? 'bg-white text-[#0058bb] shadow-xs font-bold' : 'hover:text-gray-900'
              }`}
            >
              90 Días
            </button>
            <button
              onClick={() => setTimeRange('year')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                timeRange === 'year' ? 'bg-white text-[#0058bb] shadow-xs font-bold' : 'hover:text-gray-900'
              }`}
            >
              Año
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold border border-gray-200"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0058bb]' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            onClick={() => setShowSqlModal(!showSqlModal)}
            className="p-2 text-[#0058bb] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold border border-blue-200"
            title="Configuración de Base de Datos"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nube Supabase</span>
          </button>
        </div>
      </div>

      {/* Supabase SQL Integration Banner (Expandable) */}
      {showSqlModal && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#0058bb]" />
              <span className="font-bold text-gray-900 text-sm">Persistencia en Supabase Cloud</span>
            </div>
            <button
              onClick={handleCopySql}
              className="flex items-center gap-1 bg-[#0058bb] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#004bb0] transition-colors cursor-pointer"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copiado ✓' : 'Copiar SQL para Supabase'}</span>
            </button>
          </div>
          <p className="text-gray-600 leading-relaxed">
            Las estadísticas se guardan y contabilizan de forma inmediata y automática en el navegador. Para que los registros se sincronicen globalmente entre todos los dispositivos y usuarios a través de tu proyecto de Supabase, ejecuta esta tabla en el <strong>SQL Editor</strong> de Supabase:
          </p>
          <pre className="bg-white p-3 rounded-lg border border-blue-200 overflow-x-auto text-[11px] font-mono text-gray-800">
            {`CREATE TABLE IF NOT EXISTS public.site_visits (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  source TEXT NOT NULL,
  device TEXT NOT NULL,
  is_new_visitor BOOLEAN DEFAULT true,
  is_new_session BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`}
          </pre>
        </div>
      )}

      {/* Primary KPI Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Visitas */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Total Histórico</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0058bb] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-gray-900 font-['Montserrat']">
              {metrics ? metrics.totalVisits.toLocaleString('es-AR') : '...'}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Sesiones de navegación</p>
          </div>
        </div>

        {/* Visitas de Hoy */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Visitas de Hoy</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00a650] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#00a650] font-['Montserrat']">
              {metrics ? metrics.todayVisits.toLocaleString('es-AR') : '...'}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Desde las 00:00 hs</p>
          </div>
        </div>

        {/* Visitas de la Semana */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Últimos 7 Días</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-indigo-700 font-['Montserrat']">
              {metrics ? metrics.weekVisits.toLocaleString('es-AR') : '...'}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Esta semana</p>
          </div>
        </div>

        {/* Visitas del Mes */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Últimos 30 Días</span>
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-violet-700 font-['Montserrat']">
              {metrics ? metrics.monthVisits.toLocaleString('es-AR') : '...'}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Tráfico mensual</p>
          </div>
        </div>

        {/* Visitas del Año */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Este Año</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-700 font-['Montserrat']">
              {metrics ? metrics.yearVisits.toLocaleString('es-AR') : '...'}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Acumulado anual</p>
          </div>
        </div>
      </div>

      {/* Secondary KPI Cards: Unique Visitors & Returning Visits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unique Visitors */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">Visitantes Únicos</span>
              <span className="bg-sky-100 text-sky-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Nuevos
              </span>
            </div>
            <div className="text-3xl font-black text-gray-900 font-['Montserrat']">
              {metrics ? metrics.uniqueVisitors.toLocaleString('es-AR') : '...'}
            </div>
            <p className="text-xs text-gray-500">
              Dispositivos o usuarios distintos registrados en el período seleccionado.
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-7 h-7" />
          </div>
        </div>

        {/* Returning Visits */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">Visitas Repetidas / Recurrentes</span>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Fidelidad
              </span>
            </div>
            <div className="text-3xl font-black text-purple-700 font-['Montserrat']">
              {metrics ? metrics.returningVisits.toLocaleString('es-AR') : '...'}
            </div>
            <p className="text-xs text-gray-500">
              Visitas adicionales de clientes que regresaron a la tienda en sesiones posteriores.
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Evolution Chart Card */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 font-['Montserrat'] text-base">
                Evolución de Visitas por Fecha
              </h3>
              <span className="text-xs text-gray-400">({chartData.length} días)</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
              <span>
                Promedio diario: <strong className="text-gray-800">{chartSummary.avgDaily} visitas</strong>
              </span>
              <span>•</span>
              <span>
                Pico máximo: <strong className="text-[#0058bb]">{chartSummary.peakVisits} visitas</strong> {chartSummary.peakDate ? `(${chartSummary.peakDate})` : ''}
              </span>
            </div>
          </div>

          {/* Metric series filter buttons */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setActiveChartMetric('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer border ${
                activeChartMetric === 'all'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Visitas y Únicos
            </button>
            <button
              onClick={() => setActiveChartMetric('visits')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                activeChartMetric === 'visits'
                  ? 'bg-[#0058bb] text-white border-[#0058bb]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#0058bb]"></span>
              Visitas
            </button>
            <button
              onClick={() => setActiveChartMetric('unique')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                activeChartMetric === 'unique'
                  ? 'bg-[#00a650] text-white border-[#00a650]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#00a650]"></span>
              Únicos
            </button>
          </div>
        </div>

        {/* Hover detail tooltip bar */}
        {hoveredDay ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 flex flex-wrap items-center justify-between text-xs transition-all">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0058bb]" />
              <span className="font-bold text-gray-800">{hoveredDay.date} ({hoveredDay.displayDate})</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0058bb]"></span>
                Visitas totales: <strong className="text-gray-900">{hoveredDay.visits}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00a650]"></span>
                Visitantes únicos: <strong className="text-gray-900">{hoveredDay.uniqueVisitors}</strong>
              </span>
              <span className="text-gray-500">
                Páginas vistas: <strong>{hoveredDay.pageViews}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-gray-400 italic">
            Coloca el cursor sobre las barras para ver detalles por fecha.
          </div>
        )}

        {/* SVG Responsive Chart */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[640px] h-[240px]">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-full select-none"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="barGradientVisits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0058bb" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
                </linearGradient>
                <linearGradient id="barGradientUnique" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00a650" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.6" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = paddingY + (chartHeight - paddingY * 2) * (1 - ratio);
                const val = Math.round(maxChartValue * ratio);
                return (
                  <g key={`grid-${idx}`}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - 10}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingX - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9"
                      fill="#94a3b8"
                      fontFamily="sans-serif"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Data Bars */}
              {chartData.map((d, index) => {
                const availableWidth = chartWidth - paddingX - 15;
                const slotWidth = availableWidth / chartData.length;
                const barGroupWidth = Math.max(4, Math.min(22, slotWidth * 0.75));
                const xCenter = paddingX + index * slotWidth + slotWidth / 2;

                const visitsHeight = Math.max(2, (d.visits / maxChartValue) * (chartHeight - paddingY * 2));
                const uniqueHeight = Math.max(2, (d.uniqueVisitors / maxChartValue) * (chartHeight - paddingY * 2));
                const yBase = chartHeight - paddingY;

                const isHovered = hoveredDay?.date === d.date;

                // Show label every few bars depending on array length
                const showLabel =
                  chartData.length <= 14
                    ? true
                    : chartData.length <= 31
                    ? index % 3 === 0
                    : index % 7 === 0;

                return (
                  <g
                    key={`bar-group-${d.date}`}
                    onMouseEnter={() => setHoveredDay(d)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="cursor-pointer transition-opacity"
                    opacity={hoveredDay && !isHovered ? 0.45 : 1}
                  >
                    {/* Hover column highlight background */}
                    <rect
                      x={xCenter - slotWidth / 2}
                      y={paddingY}
                      width={slotWidth}
                      height={chartHeight - paddingY * 2}
                      fill={isHovered ? '#f8fafc' : 'transparent'}
                      rx="4"
                    />

                    {activeChartMetric === 'all' ? (
                      // Dual side-by-side or stacked bars
                      <>
                        <rect
                          x={xCenter - barGroupWidth / 2}
                          y={yBase - visitsHeight}
                          width={barGroupWidth / 2 - 1}
                          height={visitsHeight}
                          fill="url(#barGradientVisits)"
                          rx="2"
                        />
                        <rect
                          x={xCenter}
                          y={yBase - uniqueHeight}
                          width={barGroupWidth / 2 - 1}
                          height={uniqueHeight}
                          fill="url(#barGradientUnique)"
                          rx="2"
                        />
                      </>
                    ) : activeChartMetric === 'visits' ? (
                      <rect
                        x={xCenter - barGroupWidth / 2}
                        y={yBase - visitsHeight}
                        width={barGroupWidth}
                        height={visitsHeight}
                        fill="url(#barGradientVisits)"
                        rx="3"
                      />
                    ) : (
                      <rect
                        x={xCenter - barGroupWidth / 2}
                        y={yBase - uniqueHeight}
                        width={barGroupWidth}
                        height={uniqueHeight}
                        fill="url(#barGradientUnique)"
                        rx="3"
                      />
                    )}

                    {/* Date label at bottom */}
                    {showLabel && (
                      <text
                        x={xCenter}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#64748b"
                        fontWeight={isHovered ? 'bold' : 'normal'}
                      >
                        {d.displayDate}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs text-gray-600 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-[#0058bb]"></span>
            <span>Total Visitas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-[#00a650]"></span>
            <span>Visitantes Únicos</span>
          </div>
        </div>
      </div>

      {/* Two-Column Section: Top Pages & Traffic Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Visited Pages */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0058bb] flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 font-['Montserrat'] text-sm">
                    Páginas Más Visitadas
                  </h3>
                  <p className="text-[11px] text-gray-500">Rutas con mayor frecuencia de visualizaciones</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                Total: {metrics?.totalPageViews || 0} vistas
              </span>
            </div>

            <div className="space-y-3">
              {metrics && metrics.topPages.length > 0 ? (
                metrics.topPages.map((page, idx) => (
                  <div key={`page-${idx}`} className="group">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-5 h-5 rounded-md bg-gray-100 text-gray-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-gray-800 group-hover:text-[#0058bb] transition-colors truncate block">
                            {page.title}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono truncate block">
                            {page.path}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="text-gray-900 font-bold">{page.views} vistas</span>
                        <span className="text-[11px] text-gray-400 w-10 text-right">
                          {page.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#0058bb] h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, page.percentage)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-gray-400">
                  No hay datos registrados aún.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 mt-4 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Se registran visitas públicas de catálogo, detalle y checkout</span>
            <span>Top {metrics?.topPages.length || 0} páginas</span>
          </div>
        </div>

        {/* Traffic Sources / Referrers */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#00a650] flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 font-['Montserrat'] text-sm">
                    Origen del Acceso (Canales)
                  </h3>
                  <p className="text-[11px] text-gray-500">De dónde provienen tus clientes y compradores</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {metrics?.trafficSources.length || 0} fuentes
              </span>
            </div>

            <div className="space-y-3">
              {metrics && metrics.trafficSources.length > 0 ? (
                metrics.trafficSources.map((source, idx) => {
                  const getSourceColor = (name: string) => {
                    const lower = name.toLowerCase();
                    if (lower.includes('instagram')) return 'bg-pink-500';
                    if (lower.includes('google')) return 'bg-blue-500';
                    if (lower.includes('whatsapp')) return 'bg-emerald-500';
                    if (lower.includes('facebook')) return 'bg-blue-700';
                    if (lower.includes('tiktok')) return 'bg-black';
                    if (lower.includes('directo')) return 'bg-gray-700';
                    return 'bg-amber-600';
                  };

                  return (
                    <div key={`source-${idx}`} className="group">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${getSourceColor(source.source)}`}
                          ></span>
                          <span className="font-semibold text-gray-800">{source.source}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-900 font-bold">{source.visits} visitas</span>
                          <span className="text-[11px] text-gray-400 w-10 text-right">
                            {source.percentage}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${getSourceColor(
                            source.source
                          )}`}
                          style={{ width: `${Math.max(4, source.percentage)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-gray-400">
                  Sin registros de tráfico aún.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 mt-4 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Detección por enlaces directos, redes sociales y parámetros UTM</span>
            <span>{metrics?.totalVisits || 0} visitas analizadas</span>
          </div>
        </div>
      </div>

      {/* Device Breakdown & De-duplication Logic Explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Ratio */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Smartphone className="w-4 h-4 text-[#0058bb]" />
            <h3 className="font-bold text-gray-900 font-['Montserrat'] text-sm">
              Dispositivos de Acceso
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#0058bb]" />
                <span className="font-semibold text-gray-700">Móviles (Smartphones)</span>
              </div>
              <span className="font-bold text-gray-900">{devicePercentages.mobile}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#0058bb] h-2 rounded-full"
                style={{ width: `${devicePercentages.mobile}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-gray-700" />
                <span className="font-semibold text-gray-700">Computadoras (Escritorio)</span>
              </div>
              <span className="font-bold text-gray-900">{devicePercentages.desktop}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gray-700 h-2 rounded-full"
                style={{ width: `${devicePercentages.desktop}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-2">
                <Tablet className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-gray-700">Tablets</span>
              </div>
              <span className="font-bold text-gray-900">{devicePercentages.tablet}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-600 h-2 rounded-full"
                style={{ width: `${devicePercentages.tablet}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Deduplication & Session Engine Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00a650]" />
              <h3 className="font-bold text-gray-900 font-['Montserrat'] text-sm">
                Filtro Anti-Recargas & Lógica de Sesiones
              </h3>
            </div>
            <button
              onClick={handleResetData}
              className="text-[11px] text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
              title="Restablecer contador"
            >
              <RotateCcw className="w-3 h-3" />
              Reiniciar estadísticas locales
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600 leading-relaxed">
            <div className="space-y-1.5 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <span className="font-bold text-gray-800 flex items-center gap-1">
                ✓ Deduplicación inteligente
              </span>
              <p className="text-[11px] text-gray-500">
                Si un usuario presiona F5 o recarga la misma página repetidamente en menos de 60 segundos, el sistema no computa visitas infladas.
              </p>
            </div>

            <div className="space-y-1.5 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <span className="font-bold text-gray-800 flex items-center gap-1">
                ✓ Ventana de Sesión (30 min)
              </span>
              <p className="text-[11px] text-gray-500">
                Una visita se considera nueva si el cliente entra tras más de 30 minutos de inactividad o abre el navegador nuevamente en un día distinto.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 pt-1 flex items-center justify-between">
            <span>Panel optimizado para dispositivos móviles y computadoras de escritorio.</span>
            <span className="text-[#0058bb] font-semibold">MY Commerce Analytics</span>
          </div>
        </div>
      </div>
    </div>
  );
};
