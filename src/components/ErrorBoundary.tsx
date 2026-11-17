import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Erro inesperado na aplicação.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Aviso de Sincronização
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Ocorreu um erro ao sincronizar ou exibir os dados. Seus dados
              locais continuam salvos com segurança neste dispositivo.
            </p>
            {this.state.errorMessage && (
              <pre className="text-xs font-mono bg-slate-100 dark:bg-slate-950 p-3 rounded-lg overflow-x-auto text-slate-700 dark:text-slate-300">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: null });
                window.location.reload();
              }}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#B85414] dark:bg-amber-500 text-white dark:text-slate-950 font-semibold text-sm hover:opacity-95"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
