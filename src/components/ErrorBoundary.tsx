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
        <div className="min-h-screen bg-[#F4F8FC] dark:bg-[#0B1D3A] text-[#0B1D3A] dark:text-[#F4F8FC] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-xl border border-[#D7E2F0] dark:border-[#1F3B68] bg-white dark:bg-[#11264A] p-6 space-y-4">
            <h1 className="text-lg font-bold text-[#0B1D3A] dark:text-white">
              Aviso de Sincronização
            </h1>
            <p className="text-sm text-[#465B78] dark:text-[#C4D5EB] leading-relaxed">
              Ocorreu um erro ao sincronizar ou apresentar os dados. Os seus
              dados locais continuam guardados com segurança neste dispositivo.
            </p>
            {this.state.errorMessage && (
              <pre className="text-xs font-mono bg-[#EDF4FB] dark:bg-[#08162E] p-3 rounded-lg overflow-x-auto text-[#10284F] dark:text-[#C4D5EB]">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: null });
                window.location.reload();
              }}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#10284F] hover:bg-[#183A6E] dark:bg-[#E4B84F] dark:hover:bg-[#EBC467] text-white dark:text-[#0B1D3A] font-semibold text-sm transition-colors"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
