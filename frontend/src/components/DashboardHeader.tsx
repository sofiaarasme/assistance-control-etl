import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import serimarLogo from "@/assets/serimar-logo.png";
import { Clock, RefreshCw, LogOut, Shield, LayoutDashboard, Download } from "lucide-react";
import type { ReactNode } from "react";

interface DashboardHeaderProps {
  lastUpdated?: string;
  onRefresh: () => void;
  isLoading: boolean;
  filterSlot?: ReactNode;
  onExportPdf?: () => void;
  dateRangeLabel?: string;
}

export function DashboardHeader({ lastUpdated, onRefresh, isLoading, filterSlot, onExportPdf, dateRangeLabel }: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"));
      return d.toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" });
    } catch { return dateStr; }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-serimar-dark via-serimar-teal-dark to-serimar-dark px-4 py-2.5 md:px-6 text-white">
      <div className="flex items-center gap-3">
        <img src={serimarLogo} alt="Alimentos Serimar" className="h-7 object-contain" />
        <div>
          <h1 className="text-sm font-extrabold text-white">Control de Asistencia</h1>
          {dateRangeLabel && (
            <p className="text-[10px] font-medium text-white/80">
              Período: {dateRangeLabel}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {lastUpdated && (
          <div className="hidden items-center gap-1 text-[10px] font-medium text-white/80 lg:flex">
            <Clock className="h-3 w-3" />
            <span>{formatDate(lastUpdated)}</span>
          </div>
        )}

        {user?.role === "admin" && (
          <button
            onClick={() => navigate(location.pathname === "/admin" ? "/" : "/admin")}
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-white/5 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/10"
          >
            {location.pathname === "/admin" ? (
              <><LayoutDashboard className="h-3 w-3" /> Dashboard</>
            ) : (
              <><Shield className="h-3 w-3" /> Admin</>
            )}
          </button>
        )}

        <button onClick={onRefresh} disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-white/5 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/10 disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          <span className="hidden md:inline">Actualizar</span>
        </button>

        {onExportPdf && (
          <button
            onClick={onExportPdf}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-white/5 px-1.5 py-1 text-[10px] font-medium text-white hover:bg-white/10"
            title="Descargar PDF"
          >
            <Download className="h-3 w-3" />
          </button>
        )}

        {filterSlot}

        {user && (
          <div className="flex items-center gap-2">
            <div className="hidden text-right md:block">
              <p className="text-[11px] font-bold text-white">{user.nombre}</p>
              <p className="text-[9px] font-medium text-white/80">{user.role === "admin" ? "Administrador" : user.departamento}</p>
            </div>
            <button onClick={handleLogout} className="rounded-lg p-1 text-white/80 hover:bg-destructive/20 hover:text-destructive">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
