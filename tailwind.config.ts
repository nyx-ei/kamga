import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--bg-page)',
        brand: 'var(--brand)',
        'brand-strong': 'var(--brand-strong)',
        'brand-subtle': 'var(--brand-subtle)',
        'brand-faint': 'var(--brand-faint)',
        card: 'var(--surface-card)',
        raised: 'var(--surface-raised)',
        sunken: 'var(--surface-sunken)',
        header: 'var(--surface-header)',
        heading: 'var(--text-heading)',
        body: 'var(--text-body)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        disabled: 'var(--text-disabled)',
        'on-brand': 'var(--text-on-brand)',
        link: 'var(--text-link)',
        'link-hover': 'var(--text-link-hover)',
        border: 'var(--border-default)',
        'border-strong': 'var(--border-strong)',
        input: 'var(--border-input)',
        focus: 'var(--border-focus)',
        positive: 'var(--status-positive)',
        'positive-bg': 'var(--status-positive-bg)',
        warning: 'var(--status-warning)',
        'warning-bg': 'var(--status-warning-bg)',
        negative: 'var(--status-negative)',
        'negative-bg': 'var(--status-negative-bg)',
        info: 'var(--status-info)',
        'info-bg': 'var(--status-info-bg)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        overlay: 'var(--shadow-overlay)'
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)'
      }
    }
  },
  plugins: []
};

export default config;