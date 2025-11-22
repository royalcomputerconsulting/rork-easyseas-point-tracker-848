export const COLORS = {
  // Navy and Beige Theme
  primaryDark: '#001F3F',
  primaryGradientStart: '#003D5C',
  primaryGradientEnd: '#005A7A',
  highlightAqua: '#D4A574',
  textPrimary: '#FFFAF0',
  textSecondary: '#E8D5C4',
  accentMagenta: '#D4A574',
  violetGlow: '#005A7A',
  royalBlueDeep: '#003D5C',
  electricAqua: '#D4A574',
  iceWhite: '#FFFAF0',
  mutedLavender: '#E8D5C4',
  neonMagenta: '#D4A574',
  
  // Navy and Beige Theme - Primary Palette
  navyDeep: '#001F3F',
  navyMedium: '#003D5C',
  navyLight: '#005A7A',
  navyBorder: '#006B8F',
  oceanicBlue: '#001F3F',
  oceanicBlueMedium: '#003D5C',
  oceanicBlueLight: '#005A7A',
  aquaAccent: '#D4A574',
  purpleAccent: '#B8956A',
  purpleLight: '#D4A574',
  
  // Gold & Premium Accents
  goldPremium: '#D4AF37',
  goldLight: '#FFD700',
  silverPremium: '#C0C0C0',
  bronzePremium: '#CD7F32',
  
  // Text Colors for Dark Backgrounds
  textLight: '#E5E7FF',
  textLightSecondary: '#C7D2FE',
  textLightTertiary: '#CBD5FF',
  textLightMuted: '#D1D5FF',
  
  // Legacy colors (keeping for compatibility)
  primaryBlue: '#001F3F',
  royalBlue: '#003D5C',
  oceanBlue: '#005A7A',
  sunsetOrange: '#FF6B35',
  brightPink: '#FF2D55',
  brightYellow: '#FFD200',
  white: '#FFFFFF',
  lightGray: '#F5F7FA',
  darkText: '#1A1A1A',
  emeraldGreen: '#10B981',
  
  // Semantic colors
  primary: '#001F3F',
  primaryLight: 'rgba(0, 31, 63, 0.1)',
  secondary: '#D4A574',
  accent: '#FFD200',
  background: '#F5F1E8',
  backgroundDark: '#001F3F',
  surface: '#FFFAF0',
  surfaceDark: '#003D5C',
  text: '#1A1A1A',
  textSecondarySemantic: 'rgba(26, 26, 26, 0.7)',
  muted: '#6B7280',
  border: '#E5E7EB',
  borderDark: '#005A7A',
  divider: '#E5E7EB',
  error: '#DC2626',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#005A7A',
} as const;

export const GRADIENTS = {
  // Navy and Beige Gradients
  royalPrimary: ['#003D5C', '#005A7A'] as const,
  royalCard: ['#001F3F', '#003D5C'] as const,
  royalButton: ['#003D5C', '#D4A574'] as const,
  royalGlow: ['#005A7A', '#D4A574'] as const,
  royalProgress: ['#D4A574', '#005A7A'] as const,
  royalCardBg: ['rgba(0, 31, 63, 0.95)', 'rgba(0, 61, 92, 0.95)'] as const,
  royalCardLight: ['rgba(0, 61, 92, 0.1)', 'rgba(212, 165, 116, 0.1)'] as const,
  
  // Navy and Beige Theme Gradients
  oceanicPrimary: ['#001F3F', '#005A7A', '#D4A574'] as const,
  oceanicDeep: ['#001F3F', '#003D5C', '#005A7A'] as const,
  oceanicPurple: ['#003D5C', '#B8956A', '#D4A574'] as const,
  navyToBlue: ['#001F3F', '#003D5C', '#005A7A'] as const,
  blueToAqua: ['#005A7A', '#D4A574'] as const,
  
  // Card Backgrounds
  cardOceanic: ['rgba(0, 31, 63, 0.95)', 'rgba(0, 61, 92, 0.95)'] as const,
  cardOceanicLight: ['rgba(0, 31, 63, 0.05)', 'rgba(212, 165, 116, 0.05)'] as const,
  
  // Legacy gradients (keeping for compatibility)
  ocean: ['#001F3F', '#005A7A', '#D4A574'] as const,
  oceanPrimary: ['#001F3F', '#005A7A'] as const,
  oceanSecondary: ['#005A7A', '#D4A574'] as const,
  sunset: ['#FF6B35', '#FFA07A'] as const,
  gold: ['#D4AF37', '#FFD700'] as const,
  emerald: ['#10B981', '#34D399'] as const,
  royal: ['#001F3F', '#D4A574'] as const,
  pinkSolid: ['#FF2D55', '#FF2D55'] as const,
  royalOutline: ['#FFFFFF', '#FFFFFF'] as const,
} as const;

export const TYPOGRAPHY = {
  fontFamily: {
    primary: 'Inter' as const,
    secondary: 'SF Pro Display' as const,
    mono: 'Roboto Mono' as const,
  },
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 32,
    xxxl: 36,
    heading: 32,
    subheading: 20,
    body: 14,
    numeric: 18,
    price: 28,
  },
  weights: {
    regular: '400' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  tracking: {
    caps: 1,
    wide: 0.6,
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  card: 24,
  button: 24,
  pill: 999,
} as const;

export const SHADOW = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  } as const,
  elevated: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  } as const,
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  } as const,
  subtle: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  } as const,
  // Navy and Beige theme shadows
  royalCard: {
    shadowColor: '#001F3F',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  } as const,
  royalGlow: {
    shadowColor: '#D4A574',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  } as const,
  royalSubtle: {
    shadowColor: '#001F3F',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  } as const,
  // Navy theme shadows
  oceanicCard: {
    shadowColor: '#001F3F',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  } as const,
  oceanicElevated: {
    shadowColor: '#001F3F',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  } as const,
  glow: {
    shadowColor: '#D4A574',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  } as const,
};

export const ANIMATION = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;
