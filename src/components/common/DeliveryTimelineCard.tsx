import React, { useMemo } from 'react';
import {
  calculateDeliveryTimeline,
  DeliveryTimelineData,
} from '../../utils/deliveryEstimation';
import { ShippingCutoffTimes } from '../../services/shippingConfig';

export interface DeliveryTimelineCardProps {
  shippingOption: {
    id?: string;
    name?: string;
    deliveryTime?: string;
    price?: number;
  };
  cutoffTimes?: Partial<ShippingCutoffTimes>;
}

export const DeliveryTimelineCard: React.FC<DeliveryTimelineCardProps> = ({
  shippingOption,
  cutoffTimes,
}) => {
  const timeline: DeliveryTimelineData = useMemo(() => {
    return calculateDeliveryTimeline(shippingOption, cutoffTimes);
  }, [shippingOption, cutoffTimes]);

  if (!shippingOption) return null;

  return (
    <div
      id="product-detail-delivery-timeline-card"
      className="mt-2.5 p-3 sm:p-3.5 bg-gradient-to-r from-slate-50 via-gray-50 to-emerald-50/40 border border-gray-200/90 rounded-xl shadow-2xs space-y-2.5 animate-fadeIn"
      aria-label="Cronograma estimado de entrega"
    >
      {/* Barra superior con resumen destacado */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <span className="font-bold text-gray-900 truncate">
            {timeline.headlineSummary}
          </span>
        </div>
        <span className="text-[10px] sm:text-[11px] text-gray-500 shrink-0 font-medium">
          {timeline.methodLabel}
        </span>
      </div>

      {/* Línea de tiempo horizontal de 3 etapas (Estilo Rappi / PedidosYa) */}
      <div className="pt-1">
        <div className="flex items-start justify-between relative">
          {timeline.steps.map((step, idx) => {
            const isLast = idx === timeline.steps.length - 1;
            const isDelivery = step.label === 'Entrega';

            return (
              <React.Fragment key={step.label}>
                {/* Etapa */}
                <div className="flex flex-col items-center text-center z-10 flex-1 min-w-0 px-1">
                  {/* Círculo con emoji */}
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm border shadow-2xs transition-transform ${
                      isDelivery
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                        : 'bg-white border-gray-200 text-gray-800'
                    }`}
                  >
                    <span>{step.iconEmoji}</span>
                  </div>

                  {/* Nombre de la etapa */}
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-1.5">
                    {step.label}
                  </span>

                  {/* Fecha o estado */}
                  <span
                    className={`text-[11px] sm:text-xs leading-tight font-bold mt-0.5 text-center ${
                      isDelivery ? 'text-emerald-700 font-extrabold' : 'text-gray-900'
                    }`}
                    title={step.statusText}
                  >
                    {step.statusText}
                  </span>
                </div>

                {/* Línea fina conectora */}
                {!isLast && (
                  <div
                    className="flex-1 h-[2px] bg-gray-200 self-center -mt-6 sm:-mt-7 mx-1"
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
