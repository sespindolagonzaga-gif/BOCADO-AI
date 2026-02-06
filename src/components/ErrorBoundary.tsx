import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-bocado-cream text-center">
          <div className="bg-white p-8 rounded-3xl shadow-bocado max-w-sm">
            <span className="text-4xl mb-4 block">🥗</span>
            <h2 className="text-xl font-bold text-bocado-dark-green mb-2">¡Algo se nos quemó en la cocina!</h2>
            <p className="text-sm text-bocado-gray mb-6">Hubo un error inesperado al cargar esta parte.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-bocado-green text-white font-bold py-3 rounded-full shadow-bocado hover:bg-bocado-dark-green transition-all"
            >
              Recargar Bocado
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;