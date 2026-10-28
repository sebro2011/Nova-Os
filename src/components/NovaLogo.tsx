export function NovaLogo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = { sm: 'h-7 w-7 rounded-lg text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-lg', xl: 'h-20 w-20 rounded-[22px] text-3xl' };
  return (
    <span className={`nova-logo-mark ${sizes[size]} ${className}`} aria-hidden="true">
      N
      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-nova-cyan shadow-[0_0_8px_#55e6e0]" />
    </span>
  );
}
