export const colors = {
  background: '#FFFFFF',
  surface: '#F7F9FC',
  primary: '#2253FF',
  primaryMuted: '#E3E8FF',
  accent: '#1EB980',
  danger: '#EF4444',
  warning: '#F59E0B',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
};

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: '600' as const,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  small: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
};

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadow,
};

export type Theme = typeof theme;
