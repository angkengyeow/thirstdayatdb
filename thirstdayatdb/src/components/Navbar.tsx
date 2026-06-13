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
    <nav className="sticky top-0 z-50">
      <div className="bg-gradient-to-r from-[#0a0520]/95 via-[#0d0830]/95 to-[#0a0520]/95 border-b border-[#1a2a5a] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src="/captain-liting.png"
                alt="Captain Liting"
                className="w-9 h-9 rounded-full object-cover ring-1 ring-[#00e5ff]/30 shadow-lg shadow-[#00e5ff]/10"
              />
              <div>
                <h1 className="font-display text-xl tracking-wider text-[#e8e0f4] leading-none">
                  Captain Liting{' '}
                  <span className="text-[#8a7aaa] font-body text-xs font-normal tracking-normal">(Virtual)</span>
                </h1>
                <p className="text-[10px] text-[#5a4a8a] font-body tracking-wide">Darts Team Manager</p>
              </div>
            </div>
            <div className="flex space-x-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 relative ${
                    currentPage === item.id
                      ? 'bg-[#00e5ff]/15 text-[#00e5ff] shadow-lg shadow-[#00e5ff]/10 border border-[#00e5ff]/25'
                      : 'text-[#8a7aaa] hover:text-[#e8e0f4] hover:bg-[#100a30] border border-transparent'
                  }`}
                >
                  {item.label}
                  {currentPage === item.id && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-[#00e5ff] shadow-[0_0_6px_rgba(0,229,255,0.5)]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}