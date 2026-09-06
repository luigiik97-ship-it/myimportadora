import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface FooterProps {
  onNavigateToInfo?: (sectionId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateToInfo }) => {
  const navigate = useNavigate();

  const handleLinkClick = (sectionId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigateToInfo) {
      onNavigateToInfo(sectionId);
    } else {
      navigate(`/informacion/${sectionId}`);
    }
  };

  return (
    <footer id="main-footer" className="bg-[#f0eded] border-t border-[#e4e2e1] mt-8 sm:mt-16 text-gray-600 text-xs sm:text-sm py-6 sm:py-8">
      <div className="max-w-[1240px] mx-auto px-2 sm:px-4">
        {/* Navigation Links */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 sm:gap-x-6 gap-y-2 mb-4 sm:mb-6 font-medium text-gray-700 text-xs sm:text-sm">
          <a
            id="footer-link-trabaja"
            href="/informacion/trabaja-con-nosotros"
            onClick={handleLinkClick('trabaja-con-nosotros')}
            className="hover:text-[#0058bb] transition-colors cursor-pointer py-1"
          >
            Trabajá con nosotros
          </a>
          <a
            id="footer-link-terminos"
            href="/informacion/terminos-y-condiciones"
            onClick={handleLinkClick('terminos-y-condiciones')}
            className="hover:text-[#0058bb] transition-colors cursor-pointer py-1"
          >
            Términos y condiciones
          </a>
          <a
            id="footer-link-mayorista"
            href="/informacion/venta-mayorista"
            onClick={handleLinkClick('venta-mayorista')}
            className="hover:text-[#0058bb] transition-colors cursor-pointer py-1"
          >
            Venta al por mayor
          </a>
          <a
            id="footer-link-fabrica"
            href="/informacion/fabrica"
            onClick={handleLinkClick('fabrica')}
            className="hover:text-[#0058bb] transition-colors cursor-pointer py-1"
          >
            Fabrica
          </a>
          <a
            id="footer-link-logistica"
            href="/informacion/logistica-envio"
            onClick={handleLinkClick('logistica-envio')}
            className="hover:text-[#0058bb] transition-colors cursor-pointer py-1"
          >
            Logistica de envio
          </a>
          <a
            id="footer-link-minorista"
            href="/informacion/minorista"
            onClick={handleLinkClick('minorista')}
            className="hover:text-[#0058bb] transition-colors cursor-pointer py-1"
          >
            Minorista
          </a>
        </div>

        {/* Copyright & Legal info */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-300/60 text-gray-500 text-[11px] sm:text-xs text-center md:text-left">
          <p>Copyright © 1997-2026 MYImportadora S.R.L. Argentina.</p>
          <p>Av. Corrientes 1675, Piso 7, CABA, Argentina</p>
        </div>
      </div>
    </footer>
  );
};
