import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ShoppingCart, User, ChevronDown, ChevronRight, Layers, ArrowLeft, Zap } from 'lucide-react';
import { CartItem, Category, UserProfile } from '../types';

interface NavbarProps {
  currentCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  cartItems: CartItem[];
  onOpenCart: () => void;
  onGoHome: () => void;
  onOpenQuickBuy?: () => void;
  isQuickBuyActive?: boolean;
  showTopBar?: boolean;
  categories?: Category[];
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onOpenAccount?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  cartItems,
  onOpenCart,
  onGoHome,
  onOpenQuickBuy,
  isQuickBuyActive = false,
  showTopBar = true,
  categories: customCategories,
  currentUser,
  onOpenAuth,
  onOpenAccount,
}) => {
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number } | null>(null);
  const categoriesButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isMobileSearchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  const allVisibleCategories = useMemo(() => {
    if (customCategories && customCategories.length > 0) {
      return customCategories
        .filter((c) => c.isVisible !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
    return [
      { id: '1', name: 'Bijuteria', isVisible: true },
      { id: '2', name: 'Juguetes', isVisible: true },
      { id: '3', name: 'Perfumes', isVisible: true },
      { id: '4', name: 'Tecnología', isVisible: true },
    ];
  }, [customCategories]);

  const displayCategoryNames = useMemo(() => {
    return allVisibleCategories.map((c) => c.name);
  }, [allVisibleCategories]);

  const updateDropdownPosition = () => {
    if (categoriesButtonRef.current) {
      const rect = categoriesButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 280;
      const leftPos = Math.max(12, Math.min(rect.left, window.innerWidth - dropdownWidth - 12));
      setDropdownCoords({
        top: rect.bottom + 6,
        left: leftPos,
      });
    }
  };

  const handleCategoriesToggle = () => {
    if (!isCategoriesOpen) {
      updateDropdownPosition();
      setIsCategoriesOpen(true);
    } else {
      setIsCategoriesOpen(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        categoriesButtonRef.current &&
        categoriesButtonRef.current.contains(target)
      ) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsCategoriesOpen(false);
      }
    };

    if (isCategoriesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isCategoriesOpen]);

  // Keep dropdown aligned on scroll or window resize
  useEffect(() => {
    if (!isCategoriesOpen) return;
    const handleScrollOrResize = () => {
      updateDropdownPosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isCategoriesOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCategoriesOpen(false);
      }
    };
    if (isCategoriesOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCategoriesOpen]);

  return (
    <header
      id="main-header"
      className={isQuickBuyActive ? 'relative z-30 shadow-md' : 'sticky top-0 z-50 shadow-md'}
    >
      {/* Top micro announcement bar */}
      {showTopBar && (
        <div className="bg-black text-white text-xs sm:text-sm py-2 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2">
          <span>Envíos a todo el país</span>
          <span className="opacity-60">|</span>
          <span className="font-semibold text-white">Precio mayorista</span>
        </div>
      )}

      {/* Main Royal Blue Navigation */}
      <div className="bg-[#0058bb] text-white">
        <div className="max-w-[1240px] mx-auto px-2 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-4 md:gap-8">
          {isMobileSearchOpen ? (
            /* Active Search Bar for Mobile */
            <div className="md:hidden flex items-center gap-2 w-full animate-in fade-in duration-200">
              <button
                type="button"
                id="close-mobile-search-btn"
                onClick={() => {
                  setIsMobileSearchOpen(false);
                  onSearchChange('');
                }}
                aria-label="Cerrar buscador"
                className="p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 relative flex items-center">
                <input
                  ref={mobileSearchInputRef}
                  id="header-mobile-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Buscar productos, marcas y más..."
                  className="w-full bg-white text-gray-800 placeholder-gray-400 text-sm rounded-full py-2.5 pl-9 pr-9 shadow-inner focus:outline-none focus:ring-2 focus:ring-yellow-300 transition-all"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                {searchQuery ? (
                  <button
                    type="button"
                    id="clear-mobile-search-btn"
                    onClick={() => onSearchChange('')}
                    className="absolute right-3 text-xs text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {/* Logo "MY" */}
              <button
                type="button"
                id="brand-logo-btn"
                onClick={onGoHome}
                aria-label="Ir a la página principal"
                title="Ir a la página principal"
                className="flex items-center gap-1.5 focus:outline-none group cursor-pointer select-none shrink-0"
              >
                <span className="font-black text-3xl md:text-4xl tracking-tighter text-white drop-shadow-sm font-['Montserrat']">
                  MY
                </span>
              </button>

              {/* ⚡ Compra Rápida Button (Visible on all pages) */}
              <button
                type="button"
                id="header-quick-buy-btn"
                onClick={onOpenQuickBuy}
                className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 md:py-2 rounded-full font-black text-xs md:text-sm transition-all cursor-pointer select-none shrink-0 shadow-sm border border-yellow-300/40 min-h-[38px] ${
                  isQuickBuyActive
                    ? 'bg-yellow-400 text-gray-950 ring-2 ring-white shadow-md'
                    : 'bg-yellow-400 hover:bg-yellow-300 text-gray-950 hover:shadow-md active:scale-95'
                }`}
                title="Ir a Compra Rápida por Mayor"
              >
                <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current text-gray-950 shrink-0" />
                <span className="font-extrabold tracking-tight whitespace-nowrap">
                  <span className="hidden">⚡ </span>Compra Rápida
                </span>
              </button>

              {/* Desktop Search Bar (Hidden on Mobile) */}
              <div className="hidden md:block flex-1 max-w-2xl relative">
                <div className="relative flex items-center">
                  <input
                    id="header-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Buscar productos, marcas y más..."
                    className="w-full bg-white text-gray-800 placeholder-gray-400 text-sm md:text-base rounded-full py-2 md:py-2.5 pl-10 pr-10 shadow-inner focus:outline-none focus:ring-2 focus:ring-yellow-300 transition-all"
                  />
                  <Search className="w-4 h-4 md:w-5 md:h-5 text-gray-400 absolute left-3.5 pointer-events-none" />
                  {searchQuery && (
                    <button
                      id="clear-search-btn"
                      onClick={() => onSearchChange('')}
                      className="absolute right-3.5 text-xs text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Right Actions: Search Icon (Mobile Only) + Auth / Account + Cart */}
              <div className="flex items-center gap-1 sm:gap-3">
                {/* Mobile Search Icon Button */}
                <button
                  type="button"
                  id="mobile-search-toggle-btn"
                  onClick={() => setIsMobileSearchOpen(true)}
                  aria-label="Abrir buscador"
                  title="Buscar productos"
                  className="md:hidden p-2 min-w-[40px] min-h-[40px] justify-center text-white hover:bg-white/10 rounded-full transition-colors flex items-center cursor-pointer"
                >
                  <Search className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                </button>

                {/* Iniciar sesión / Mi cuenta Button */}
                {currentUser ? (
                  <button
                    id="header-account-btn"
                    onClick={onOpenAccount}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[38px] bg-white/10 hover:bg-white/20 border border-white/25 rounded-full transition-all text-xs md:text-sm font-semibold cursor-pointer"
                    title="Mi Cuenta"
                  >
                    <div className="w-6 h-6 rounded-full bg-white text-[#0058bb] flex items-center justify-center font-bold text-xs">
                      {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="hidden md:inline max-w-[100px] truncate">
                      {currentUser.fullName ? currentUser.fullName.split(' ')[0] : 'Mi Cuenta'}
                    </span>
                  </button>
                ) : (
                  <button
                    id="header-login-btn"
                    onClick={onOpenAuth}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[38px] bg-white/10 hover:bg-white/20 border border-white/25 rounded-full transition-all text-xs md:text-sm font-medium cursor-pointer"
                    title="Iniciar Sesión"
                  >
                    <User className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    <span className="hidden sm:inline font-medium">Iniciar sesión</span>
                  </button>
                )}

                {/* Cart Button */}
                <button
                  id="header-cart-btn"
                  onClick={onOpenCart}
                  className="relative p-2 min-w-[40px] min-h-[40px] justify-center text-white hover:bg-white/10 rounded-full transition-colors flex items-center cursor-pointer"
                  title="Ver Carrito de Compras"
                >
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 stroke-[2.2]" />
                  {totalCartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white font-bold text-xs rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 shadow-md border-2 border-[#0058bb] animate-in zoom-in">
                      {totalCartCount}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Sub-bar Category Pills */}
        <div className="max-w-[1240px] mx-auto px-2 sm:px-4 pb-2 pt-0.5 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          {/* Todo */}
          <button
            id="category-tab-todo"
            onClick={() => {
              setIsCategoriesOpen(false);
              onSelectCategory('Todo');
            }}
            className={`px-3 sm:px-3.5 py-1.5 sm:py-1 text-xs md:text-sm font-medium rounded-full transition-all whitespace-nowrap cursor-pointer ${
              currentCategory === 'Todo'
                ? 'bg-white text-[#0058bb] shadow-sm font-semibold'
                : 'text-white/90 hover:bg-white/15'
            }`}
          >
            Todo
          </button>

          {/* Categorías (with dropdown toggle) */}
          <button
            ref={categoriesButtonRef}
            id="category-tab-categorias"
            onClick={handleCategoriesToggle}
            aria-expanded={isCategoriesOpen}
            aria-haspopup="true"
            className={`px-3 sm:px-3.5 py-1.5 sm:py-1 text-xs md:text-sm font-medium rounded-full transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              isCategoriesOpen
                ? 'bg-white text-[#0058bb] shadow-sm font-semibold'
                : 'text-white/90 hover:bg-white/15'
            }`}
          >
            <span>Categorías</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isCategoriesOpen ? 'rotate-180 text-[#0058bb]' : 'text-white/80'
              }`}
            />
          </button>

          {/* Remaining categories (Bijuteria, etc.) */}
          {displayCategoryNames.map((cat) => {
            const isSelected = currentCategory === cat;
            return (
              <button
                key={cat}
                id={`category-tab-${cat.toLowerCase()}`}
                onClick={() => {
                  setIsCategoriesOpen(false);
                  onSelectCategory(cat);
                }}
                className={`px-3 sm:px-3.5 py-1.5 sm:py-1 text-xs md:text-sm font-medium rounded-full transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-white text-[#0058bb] shadow-sm font-semibold'
                    : 'text-white/90 hover:bg-white/15'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Categories Dropdown */}
      {isCategoriesOpen && dropdownCoords && (
        <div
          ref={dropdownRef}
          style={{
            top: `${dropdownCoords.top}px`,
            left: `${dropdownCoords.left}px`,
          }}
          className="fixed z-50 w-72 max-w-[calc(100vw-24px)] bg-white text-gray-800 rounded-2xl shadow-2xl border border-gray-100 py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
            <div className="flex items-center gap-1.5 text-[#0058bb]">
              <Layers className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Todas las categorías
              </span>
            </div>
          </div>

          {/* Categories List */}
          <div className="max-h-[60vh] md:max-h-[340px] overflow-y-auto overscroll-contain py-1 divide-y divide-gray-50">
            {allVisibleCategories.map((cat) => {
              const isSelected = currentCategory === cat.name;
              return (
                <button
                  key={cat.id || cat.name}
                  onClick={() => {
                    onSelectCategory(cat.name);
                    setIsCategoriesOpen(false);
                  }}
                  className={`w-full min-h-[44px] px-4 py-2.5 text-left text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-50/90 text-[#0058bb] font-bold'
                      : 'text-gray-700 hover:bg-blue-50/50 hover:text-[#0058bb]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {cat.image ? (
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="w-6 h-6 rounded-md object-cover shrink-0 border border-gray-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#0058bb] text-white'
                            : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-[#0058bb]'
                        }`}
                      >
                        <span className="text-xs font-bold">
                          {cat.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="truncate">{cat.name}</span>
                  </div>

                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      isSelected
                        ? 'text-[#0058bb]'
                        : 'text-gray-300 group-hover:text-[#0058bb] group-hover:translate-x-0.5'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};

