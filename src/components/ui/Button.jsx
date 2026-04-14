import { cn } from '../../lib/utils';

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/85 border border-border',
  ghost: 'hover:bg-secondary/60 text-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-border bg-transparent hover:bg-secondary/60'
};

const sizes = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  icon: 'h-10 w-10'
};

export default function Button({ className, variant = 'default', size = 'default', ...props }) {
  return (
    <button
      className={cn(
        'ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        `ui-button--${variant}`,
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
