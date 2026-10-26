import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary robusto para evitar que excepciones no controladas
 * dejen la pantalla permanentemente en blanco (especialmente tras
 * restauraciones de pestañas o reanudación de ciclo de vida en Chrome móvil).
 */
export class ErrorBoundary extends Component<Props, State> {
  private pageshowHandler: ((e: PageTransitionEvent) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error capturado en árbol de componentes:', error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidMount() {
    // Si la pestaña se restaura desde BFCache o vuelve a primer plano tras haber fallado,
    // intentar auto-recuperar el estado de forma segura sin forzar recargas
    this.pageshowHandler = (event: PageTransitionEvent) => {
      if (this.state.hasError && event.persisted) {
        console.log('[ErrorBoundary] Restauración BFCache detectada, reintentando renderizado...');
        this.resetError();
      }
    };

    this.visibilityHandler = () => {
      if (this.state.hasError && document.visibilityState === 'visible') {
        // Si el usuario regresa a la pestaña tras un error temporal, reintentar una vez
        this.resetError();
      }
    };

    window.addEventListener('pageshow', this.pageshowHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  componentWillUnmount() {
    if (this.pageshowHandler) {
      window.removeEventListener('pageshow', this.pageshowHandler);
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  handleGoHome = () => {
    try {
      this.resetError();
      window.location.href = '/';
    } catch {
      this.resetError();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#fbf9f8] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6 md:p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-200/60">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 font-['Montserrat']">
                Algo no cargó correctamente
              </h2>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                La página se suspendió o interrumpió su proceso. Podés reanudarla fácilmente sin perder tus datos.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={this.resetError}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#0058bb] hover:bg-[#004bb0] text-white font-bold text-xs md:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[42px]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs md:text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
              >
                <Home className="w-4 h-4" />
                <span>Volver al inicio</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
