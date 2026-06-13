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
      <div
        className="border-b"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(212, 175, 55, 0.15)',
          boxShadow: '0 1px 4px rgba(212, 175, 55, 0.06)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Brand */}
            <div className="flex items-center gap-3">
              <img
                src="/captain-liting.png"
                alt="Captain Liting"
                className="w-9 h-9 rounded-full object-cover"
                style={{
                  boxShadow: '0 0 0 2px rgba(212, 175, 55, 0.2), 0 2px 8px rgba(212, 175, 55, 0.15)',
                }}
              />
              <div>
                <h1 className="font-display text-lg font-semibold text-[#1E293B] leading-none tracking-tight">
                  Captain Liting{' '}
                  <span className="text-[#94A3B8] font-body text-xs font-normal">(Virtual)</span>
                </h1>
                <p className="text-[10px] text-[#94A3B8] font-body tracking-wide">Darts Team Manager</p>
              </div>
            </div>

            {/* Nav Tabs */}
            <div className="flex space-x-0.5">
              {navItems.map(item => {
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className="relative px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(232, 200, 114, 0.08))'
                        : 'transparent',
                      color: isActive ? '#B8942E' : '#94A3B8',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(212, 175, 55, 0.04)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {item.label}
                    {isActive && (
                      <span
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #D4AF37, #E8C872)',
                          boxShadow: '0 0 6px rgba(212, 175, 55, 0.4)',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}