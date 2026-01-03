import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  MapPin,
  ClipboardList,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Utensils,
  Sun,
  Moon,
} from "lucide-react";

const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark" || 
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getPageTitle = () => {
    const path = location.pathname.split("/")[1];
    const item = navItems.find(item => item.to.includes(path));
    return item ? item.label : "Dashboard";
  };

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/beneficiaries", icon: Users, label: "Beneficiaries" },
    { to: "/redemption", icon: Calendar, label: "Redemption" },
    { to: "/nes", icon: FileText, label: "NES" },
    ...(isAdmin
      ? [
          { to: "/users", icon: Users, label: "User Management" },
          { to: "/areas", icon: MapPin, label: "Areas" },
          { to: "/audit-log", icon: ClipboardList, label: "Audit Trail" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Mobile menu button - Only visible when sidebar is closed */}
      {!sidebarOpen && (
        <button
          data-testid="mobile-menu-btn"
          className="fixed top-4 left-4 z-50 p-2.5 bg-slate-900 text-white rounded-md shadow-lg shadow-emerald-900/20 lg:hidden border border-slate-800"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>
      )}

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-950/60 z-30 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/20">
                <Utensils className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight">WGP</h1>
                <p className="text-xs text-slate-400">Walang Gutom Program</p>
              </div>
            </div>
            <button 
              className="p-1 hover:bg-slate-800 rounded-md transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setSidebarOpen(false);
                  }
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/20"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`
                }
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
                <ChevronRight size={16} className={`ml-auto opacity-50 transition-transform ${sidebarOpen ? 'rotate-90' : ''}`} />
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-slate-800/50">
              <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white ring-2 ring-slate-800">
                <span className="text-sm font-bold">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
            <Button
              data-testid="logout-btn"
              variant="outline"
              className="w-full justify-center gap-2 bg-transparent border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-600 transition-all"
              onClick={handleLogout}
            >
              <LogOut size={18} />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "ml-0"}`}>
        {/* Top Header */}
        <header className="h-16 border-b border-stone-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-md"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={20} />
            </Button>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px] sm:max-w-none">
              {getPageTitle()}
            </h2>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="rounded-full w-8 h-8 sm:w-10 sm:h-10 text-slate-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <div className="h-5 sm:h-6 w-[1px] bg-stone-200 dark:bg-slate-800 mx-0.5 sm:mx-1" />
            <div className="flex items-center gap-2 sm:gap-3 pl-1">
              <div className="text-right hidden xs:block">
                <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px] sm:max-w-[120px]">{user?.name}</p>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 capitalize">{user?.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold sm:hidden">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
