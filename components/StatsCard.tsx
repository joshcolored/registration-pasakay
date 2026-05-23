interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'orange';
  subtitle?: string;
  trend?: string;
}

const colorClasses = {
  blue: {
    icon: 'bg-[#f3f7f6] text-[#1f6f68] border-[#dfe5e1]',
    accent: 'bg-[#1f6f68]',
  },
  green: {
    icon: 'bg-[#f3f7f6] text-[#1f6f68] border-[#dfe5e1]',
    accent: 'bg-[#1f6f68]',
  },
  purple: {
    icon: 'bg-[#f5f3ef] text-[#6d5d3d] border-[#e5e2d8]',
    accent: 'bg-[#8b7a55]',
  },
  yellow: {
    icon: 'bg-[#f5f3ef] text-[#8a5a12] border-[#e5e2d8]',
    accent: 'bg-[#a46312]',
  },
  red: {
    icon: 'bg-[#fbf3f1] text-[#b42318] border-[#efd8d4]',
    accent: 'bg-[#b42318]',
  },
  orange: {
    icon: 'bg-[#f7f1e8] text-[#a46312] border-[#eadcc8]',
    accent: 'bg-[#a46312]',
  },
};

export default function StatsCard({ title, value, icon, color, subtitle, trend }: StatsCardProps) {
  const colors = colorClasses[color];

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[#dfe5e1] bg-white p-5 shadow-sm transition duration-200 hover:border-[#cfd8d3] hover:shadow-[0_8px_22px_rgba(24,33,31,0.06)]">
      <div className={`absolute left-0 top-0 h-full w-0.5 ${colors.accent}`} />
      <div className="flex items-start justify-between gap-4 pl-1">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#66736f]">
            {title}
          </h3>
          <p className="mt-3 truncate text-3xl font-semibold tracking-tight text-[#18211f]">
            {value}
          </p>
        </div>
        <div className={`rounded-md border p-2 ${colors.icon}`}>
          {icon}
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#edf0eb] pt-3">
          {subtitle && <p className="truncate text-sm font-medium text-[#66736f]">{subtitle}</p>}
          {trend && (
            <span className="rounded-md bg-[#f3f6f2] px-2 py-1 text-xs font-semibold text-[#49534f]">
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
