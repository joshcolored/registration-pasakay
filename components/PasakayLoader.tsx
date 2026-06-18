type PasakayLoaderProps = {
  label?: string;
  size?: 'button' | 'panel' | 'page';
  className?: string;
};

const sizeClasses = {
  button: {
    wrapper: 'gap-1',
    image: 'h-7 w-7',
    dots: 'h-1 w-1',
    label: 'sr-only',
  },
  panel: {
    wrapper: 'gap-2',
    image: 'h-24 w-24 sm:h-28 sm:w-28',
    dots: 'h-1.5 w-1.5',
    label: 'text-xs font-bold text-[#66736f]',
  },
  page: {
    wrapper: 'gap-3',
    image: 'h-32 w-32 sm:h-40 sm:w-40',
    dots: 'h-2 w-2',
    label: 'text-sm font-bold text-[#66736f]',
  },
};

export default function PasakayLoader({
  label = 'Loading',
  size = 'panel',
  className = '',
}: PasakayLoaderProps) {
  const styles = sizeClasses[size];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`inline-flex flex-col items-center justify-center ${styles.wrapper} ${className}`}
    >
      <img
        src="/pasakay-loading.gif"
        alt=""
        aria-hidden="true"
        className={`${styles.image} object-contain`}
      />
      <span className="flex items-center justify-center gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((dot) => (
          <span
            key={dot}
            className={`${styles.dots} rounded-full bg-[#1f6f68] animate-pasakay-dot`}
            style={{ animationDelay: `${dot * 140}ms` }}
          />
        ))}
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
