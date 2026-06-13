interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'awards', label: 'Awards' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'lineup', label: 'Lineup' },
];

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
  return (
    <nav className="bg-gradient-to-r from-[#0d0d1a] via-[#16162a] to-[#0d0d1a] border-b border-[#1c1c34]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f59e0b] to-[#d97706] flex items-center justify-center text-sm font-bold text-[#0d0d1a] shadow-lg shadow-[#f59e0b]/20">
              CL
            </div>
            <div>
              <h1 className="font-display text-xl tracking-wider text-[#eeeef4] leading-none">
                Captain Liting <span className="text-[#94a3b8] font-body text-xs font-normal tracking-normal">(Virtual)</span>
              </h1>
              <p className="text-[10px] text-[#6b6b8a] font-body tracking-wide">Darts Team Manager</p>
            </div>
          </div>
          <div className="flex space-x-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  currentPage === item.id
                    ? 'bg-[#f59e0b] text-[#0d0d1a] shadow-lg shadow-[#f59e0b]/20'
                    : 'text-[#9e9eb4] hover:text-[#eeeef4] hover:bg-[#1c1c34]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}