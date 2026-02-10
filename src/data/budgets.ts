// ============================================
// 1. MAPEO PAÍS (ISO 3166-1 alpha-2) → MONEDA
// ============================================
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // Europa (EUR y otras)
  'ES': 'EUR', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'PT': 'EUR',
  'IE': 'EUR', 'NL': 'EUR', 'BE': 'EUR', 'AT': 'EUR', 'GR': 'EUR',
  'FI': 'EUR', 'SK': 'EUR', 'SI': 'EUR', 'HR': 'EUR', 'EE': 'EUR',
  'LV': 'EUR', 'LT': 'EUR', 'LU': 'EUR', 'MT': 'EUR', 'CY': 'EUR',
  'GB': 'GBP', 'CH': 'CHF', 'SE': 'SEK', 'NO': 'NOK', 'DK': 'DKK',
  'PL': 'PLN', 'CZ': 'CZK', 'HU': 'HUF', 'RO': 'RON', 'BG': 'BGN',
  'UA': 'UAH', 'RU': 'RUB', 'RS': 'RSD', 'BA': 'BAM',
  
  // América del Norte
  'MX': 'MXN', 'US': 'USD', 'CA': 'CAD',
  
  // América Central y Caribe
  'GT': 'GTQ', 'SV': 'USD', 'HN': 'HNL', 'NI': 'NIO', 'CR': 'CRC',
  'PA': 'USD', 'BZ': 'BZD', 'CU': 'CUP', 'DO': 'DOP', 'PR': 'USD',
  'JM': 'JMD', 'HT': 'HTG', 'TT': 'TTD', 'BS': 'BSD', 'BB': 'BBD',
  
  // América del Sur
  'AR': 'ARS', 'BO': 'BOB', 'BR': 'BRL', 'CL': 'CLP', 'CO': 'COP',
  'EC': 'USD', 'GY': 'GYD', 'PY': 'PYG', 'PE': 'PEN', 'SR': 'SRD',
  'UY': 'UYU', 'VE': 'VES', 'FK': 'FKP', 'GF': 'EUR', 'GS': 'FKP',
  
  // Asia
  'CN': 'CNY', 'JP': 'JPY', 'KR': 'KRW', 'IN': 'INR', 'TH': 'THB',
  'VN': 'VND', 'ID': 'IDR', 'MY': 'MYR', 'PH': 'PHP', 'SG': 'SGD',
  'IL': 'ILS', 'TR': 'TRY', 'SA': 'SAR', 'AE': 'AED', 'QA': 'QAR',
  'KW': 'KWD', 'BH': 'BHD', 'OM': 'OMR', 'JO': 'JOD', 'LB': 'LBP',
  'PK': 'PKR', 'BD': 'BDT', 'LK': 'LKR', 'NP': 'NPR', 'MM': 'MMK',
  'KH': 'KHR', 'LA': 'LAK', 'TW': 'TWD', 'HK': 'HKD', 'MO': 'MOP',
  
  // Oceanía
  'AU': 'AUD', 'NZ': 'NZD', 'PG': 'PGK', 'FJ': 'FJD', 'NC': 'XPF',
  'VU': 'VUV', 'SB': 'SBD', 'PF': 'XPF', 'WF': 'XPF', 'TV': 'AUD',
  'NR': 'AUD', 'KI': 'AUD', 'TO': 'TOP', 'WS': 'WST', 'FM': 'USD',
  'MH': 'USD', 'PW': 'USD', 'AS': 'USD', 'CK': 'NZD', 'NU': 'NZD',
  'TK': 'NZD', 'PN': 'NZD',
  
  // África
  'ZA': 'ZAR', 'EG': 'EGP', 'MA': 'MAD', 'DZ': 'DZD', 'TN': 'TND',
  'NG': 'NGN', 'KE': 'KES', 'ET': 'ETB', 'GH': 'GHS', 'UG': 'UGX',
  'TZ': 'TZS', 'RW': 'RWF', 'ZM': 'ZMW', 'ZW': 'ZWL', 'MW': 'MWK',
  'MZ': 'MZN', 'MG': 'MGA', 'MU': 'MUR', 'SC': 'SCR', 'SZ': 'SZL',
  'LS': 'LSL', 'BW': 'BWP', 'NA': 'NAD', 'AO': 'AOA', 'CD': 'CDF',
  'CG': 'XAF', 'GA': 'XAF', 'CM': 'XAF', 'TD': 'XAF', 'CF': 'XAF',
  'GQ': 'XAF', 'BJ': 'XOF', 'BF': 'XOF', 'CI': 'XOF', 'GW': 'XOF',
  'ML': 'XOF', 'NE': 'XOF', 'SN': 'XOF', 'TG': 'XOF', 'SL': 'SLL',
  'LR': 'LRD', 'GN': 'GNF', 'GM': 'GMD', 'CV': 'CVE', 'MR': 'MRU',
  'SD': 'SDG', 'SS': 'SSP', 'DJ': 'DJF', 'ER': 'ERN', 'SO': 'SOS',
  'LY': 'LYD', 'EH': 'MAD', 'KM': 'KMF', 'RE': 'EUR', 'YT': 'EUR',
};

// ============================================
// 2. INTERFACES Y CONFIGURACIÓN
// ============================================
export interface BudgetRange {
  min: number;
  max: number | null;
  label: string;
  value: 'low' | 'medium' | 'high'; // Valores estandarizados para la IA
  description: string;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  name: string;
  ranges: BudgetRange[];
}

export const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  EUR: {
    code: 'EUR', symbol: '€', locale: 'es-ES', name: 'Euro',
    ranges: [
      { min: 0, max: 15, label: 'Económico', value: 'low', description: 'Menos de 15€' },
      { min: 15, max: 40, label: 'Medio', value: 'medium', description: 'Entre 15€ y 40€' },
      { min: 40, max: null, label: 'Premium', value: 'high', description: 'Más de 40€' }
    ]
  },
  MXN: {
    code: 'MXN', symbol: '$', locale: 'es-MX', name: 'Peso Mexicano',
    ranges: [
      { min: 0, max: 200, label: 'Económico', value: 'low', description: 'Menos de $200 MXN' },
      { min: 200, max: 600, label: 'Medio', value: 'medium', description: 'Entre $200 y $600 MXN' },
      { min: 600, max: null, label: 'Premium', value: 'high', description: 'Más de $600 MXN' }
    ]
  },
  USD: {
    code: 'USD', symbol: '$', locale: 'en-US', name: 'Dólar Estadounidense',
    ranges: [
      { min: 0, max: 25, label: 'Budget', value: 'low', description: 'Under $25' },
      { min: 25, max: 70, label: 'Standard', value: 'medium', description: '$25 to $70' },
      { min: 70, max: null, label: 'Fine Dining', value: 'high', description: 'Over $70' }
    ]
  },
  COP: {
    code: 'COP', symbol: '$', locale: 'es-CO', name: 'Peso Colombiano',
    ranges: [
      { min: 0, max: 30000, label: 'Económico', value: 'low', description: 'Menos de 30k COP' },
      { min: 30000, max: 80000, label: 'Medio', value: 'medium', description: 'Entre 30k y 80k COP' },
      { min: 80000, max: null, label: 'Premium', value: 'high', description: 'Más de 80k COP' }
    ]
  },
  // América Latina adicional
  ARS: {
    code: 'ARS', symbol: '$', locale: 'es-AR', name: 'Peso Argentino',
    ranges: [
      { min: 0, max: 5000, label: 'Económico', value: 'low', description: 'Menos de $5.000 ARS' },
      { min: 5000, max: 15000, label: 'Medio', value: 'medium', description: 'Entre $5.000 y $15.000 ARS' },
      { min: 15000, max: null, label: 'Premium', value: 'high', description: 'Más de $15.000 ARS' }
    ]
  },
  BRL: {
    code: 'BRL', symbol: 'R$', locale: 'pt-BR', name: 'Real Brasileño',
    ranges: [
      { min: 0, max: 80, label: 'Econômico', value: 'low', description: 'Menos de R$80' },
      { min: 80, max: 200, label: 'Médio', value: 'medium', description: 'Entre R$80 e R$200' },
      { min: 200, max: null, label: 'Premium', value: 'high', description: 'Mais de R$200' }
    ]
  },
  CLP: {
    code: 'CLP', symbol: '$', locale: 'es-CL', name: 'Peso Chileno',
    ranges: [
      { min: 0, max: 15000, label: 'Económico', value: 'low', description: 'Menos de $15.000 CLP' },
      { min: 15000, max: 40000, label: 'Medio', value: 'medium', description: 'Entre $15.000 y $40.000 CLP' },
      { min: 40000, max: null, label: 'Premium', value: 'high', description: 'Más de $40.000 CLP' }
    ]
  },
  PEN: {
    code: 'PEN', symbol: 'S/', locale: 'es-PE', name: 'Sol Peruano',
    ranges: [
      { min: 0, max: 50, label: 'Económico', value: 'low', description: 'Menos de S/50' },
      { min: 50, max: 120, label: 'Medio', value: 'medium', description: 'Entre S/50 y S/120' },
      { min: 120, max: null, label: 'Premium', value: 'high', description: 'Más de S/120' }
    ]
  },
  UYU: {
    code: 'UYU', symbol: '$', locale: 'es-UY', name: 'Peso Uruguayo',
    ranges: [
      { min: 0, max: 800, label: 'Económico', value: 'low', description: 'Menos de $800 UYU' },
      { min: 800, max: 2000, label: 'Medio', value: 'medium', description: 'Entre $800 y $2.000 UYU' },
      { min: 2000, max: null, label: 'Premium', value: 'high', description: 'Más de $2.000 UYU' }
    ]
  },
  CRC: {
    code: 'CRC', symbol: '₡', locale: 'es-CR', name: 'Colón Costarricense',
    ranges: [
      { min: 0, max: 12000, label: 'Económico', value: 'low', description: 'Menos de ₡12.000' },
      { min: 12000, max: 30000, label: 'Medio', value: 'medium', description: 'Entre ₡12.000 y ₡30.000' },
      { min: 30000, max: null, label: 'Premium', value: 'high', description: 'Más de ₡30.000' }
    ]
  },
  // Europa
  GBP: {
    code: 'GBP', symbol: '£', locale: 'en-GB', name: 'Libra Esterlina',
    ranges: [
      { min: 0, max: 15, label: 'Budget', value: 'low', description: 'Under £15' },
      { min: 15, max: 40, label: 'Standard', value: 'medium', description: '£15 to £40' },
      { min: 40, max: null, label: 'Premium', value: 'high', description: 'Over £40' }
    ]
  },
  CHF: {
    code: 'CHF', symbol: 'CHF', locale: 'de-CH', name: 'Franco Suizo',
    ranges: [
      { min: 0, max: 30, label: 'Wirtschaftlich', value: 'low', description: 'Unter CHF 30' },
      { min: 30, max: 70, label: 'Mittel', value: 'medium', description: 'CHF 30 bis 70' },
      { min: 70, max: null, label: 'Premium', value: 'high', description: 'Über CHF 70' }
    ]
  },
  SEK: {
    code: 'SEK', symbol: 'kr', locale: 'sv-SE', name: 'Corona Sueca',
    ranges: [
      { min: 0, max: 200, label: 'Ekonomiskt', value: 'low', description: 'Under 200 kr' },
      { min: 200, max: 500, label: 'Medel', value: 'medium', description: '200-500 kr' },
      { min: 500, max: null, label: 'Premium', value: 'high', description: 'Över 500 kr' }
    ]
  },
  NOK: {
    code: 'NOK', symbol: 'kr', locale: 'nb-NO', name: 'Corona Noruega',
    ranges: [
      { min: 0, max: 200, label: 'Økonomisk', value: 'low', description: 'Under 200 kr' },
      { min: 200, max: 500, label: 'Middels', value: 'medium', description: '200-500 kr' },
      { min: 500, max: null, label: 'Premium', value: 'high', description: 'Over 500 kr' }
    ]
  },
  DKK: {
    code: 'DKK', symbol: 'kr', locale: 'da-DK', name: 'Corona Danesa',
    ranges: [
      { min: 0, max: 150, label: 'Økonomisk', value: 'low', description: 'Under 150 kr' },
      { min: 150, max: 400, label: 'Middel', value: 'medium', description: '150-400 kr' },
      { min: 400, max: null, label: 'Premium', value: 'high', description: 'Over 400 kr' }
    ]
  },
  PLN: {
    code: 'PLN', symbol: 'zł', locale: 'pl-PL', name: 'Zloty Polaco',
    ranges: [
      { min: 0, max: 60, label: 'Ekonomiczny', value: 'low', description: 'Poniżej 60 zł' },
      { min: 60, max: 150, label: 'Średni', value: 'medium', description: '60-150 zł' },
      { min: 150, max: null, label: 'Premium', value: 'high', description: 'Powyżej 150 zł' }
    ]
  },
  CZK: {
    code: 'CZK', symbol: 'Kč', locale: 'cs-CZ', name: 'Corona Checa',
    ranges: [
      { min: 0, max: 400, label: 'Ekonomický', value: 'low', description: 'Méně než 400 Kč' },
      { min: 400, max: 1000, label: 'Střední', value: 'medium', description: '400-1000 Kč' },
      { min: 1000, max: null, label: 'Premium', value: 'high', description: 'Více než 1000 Kč' }
    ]
  },
  // Norteamérica
  CAD: {
    code: 'CAD', symbol: 'C$', locale: 'en-CA', name: 'Dólar Canadiense',
    ranges: [
      { min: 0, max: 30, label: 'Budget', value: 'low', description: 'Under C$30' },
      { min: 30, max: 75, label: 'Standard', value: 'medium', description: 'C$30 to C$75' },
      { min: 75, max: null, label: 'Premium', value: 'high', description: 'Over C$75' }
    ]
  },
  // Oceanía
  AUD: {
    code: 'AUD', symbol: 'A$', locale: 'en-AU', name: 'Dólar Australiano',
    ranges: [
      { min: 0, max: 35, label: 'Budget', value: 'low', description: 'Under A$35' },
      { min: 35, max: 90, label: 'Standard', value: 'medium', description: 'A$35 to A$90' },
      { min: 90, max: null, label: 'Premium', value: 'high', description: 'Over A$90' }
    ]
  },
  NZD: {
    code: 'NZD', symbol: 'NZ$', locale: 'en-NZ', name: 'Dólar Neozelandés',
    ranges: [
      { min: 0, max: 40, label: 'Budget', value: 'low', description: 'Under NZ$40' },
      { min: 40, max: 100, label: 'Standard', value: 'medium', description: 'NZ$40 to NZ$100' },
      { min: 100, max: null, label: 'Premium', value: 'high', description: 'Over NZ$100' }
    ]
  },
  // Asia
  JPY: {
    code: 'JPY', symbol: '¥', locale: 'ja-JP', name: 'Yen Japonés',
    ranges: [
      { min: 0, max: 3000, label: 'お手頃', value: 'low', description: '3,000円以下' },
      { min: 3000, max: 8000, label: '標準', value: 'medium', description: '3,000円〜8,000円' },
      { min: 8000, max: null, label: 'プレミアム', value: 'high', description: '8,000円以上' }
    ]
  },
  CNY: {
    code: 'CNY', symbol: '¥', locale: 'zh-CN', name: 'Yuan Chino',
    ranges: [
      { min: 0, max: 150, label: '经济型', value: 'low', description: '少于150元' },
      { min: 150, max: 400, label: '中档', value: 'medium', description: '150-400元' },
      { min: 400, max: null, label: '高档', value: 'high', description: '超过400元' }
    ]
  },
  KRW: {
    code: 'KRW', symbol: '₩', locale: 'ko-KR', name: 'Won Surcoreano',
    ranges: [
      { min: 0, max: 30000, label: '경제적', value: 'low', description: '3만원 이하' },
      { min: 30000, max: 80000, label: '중간', value: 'medium', description: '3만원~8만원' },
      { min: 80000, max: null, label: '프리미엄', value: 'high', description: '8만원 이상' }
    ]
  },
  INR: {
    code: 'INR', symbol: '₹', locale: 'hi-IN', name: 'Rupia India',
    ranges: [
      { min: 0, max: 1000, label: 'Economy', value: 'low', description: 'Under ₹1,000' },
      { min: 1000, max: 3000, label: 'Standard', value: 'medium', description: '₹1,000 to ₹3,000' },
      { min: 3000, max: null, label: 'Premium', value: 'high', description: 'Over ₹3,000' }
    ]
  },
  THB: {
    code: 'THB', symbol: '฿', locale: 'th-TH', name: 'Baht Tailandés',
    ranges: [
      { min: 0, max: 500, label: 'ประหยัด', value: 'low', description: 'ต่ำกว่า 500 บาท' },
      { min: 500, max: 1200, label: 'ปานกลาง', value: 'medium', description: '500-1,200 บาท' },
      { min: 1200, max: null, label: 'พรีเมียม', value: 'high', description: 'มากกว่า 1,200 บาท' }
    ]
  },
  SGD: {
    code: 'SGD', symbol: 'S$', locale: 'en-SG', name: 'Dólar de Singapur',
    ranges: [
      { min: 0, max: 30, label: 'Budget', value: 'low', description: 'Under S$30' },
      { min: 30, max: 80, label: 'Standard', value: 'medium', description: 'S$30 to S$80' },
      { min: 80, max: null, label: 'Premium', value: 'high', description: 'Over S$80' }
    ]
  },
  // África
  ZAR: {
    code: 'ZAR', symbol: 'R', locale: 'en-ZA', name: 'Rand Sudafricano',
    ranges: [
      { min: 0, max: 300, label: 'Budget', value: 'low', description: 'Under R300' },
      { min: 300, max: 800, label: 'Standard', value: 'medium', description: 'R300 to R800' },
      { min: 800, max: null, label: 'Premium', value: 'high', description: 'Over R800' }
    ]
  },
  EGP: {
    code: 'EGP', symbol: 'E£', locale: 'ar-EG', name: 'Libra Egipcia',
    ranges: [
      { min: 0, max: 500, label: 'اقتصادي', value: 'low', description: 'أقل من 500 جنيه' },
      { min: 500, max: 1200, label: 'متوسط', value: 'medium', description: '500-1200 جنيه' },
      { min: 1200, max: null, label: 'فاخر', value: 'high', description: 'أكثر من 1200 جنيه' }
    ]
  },
  // Fallback para países no configurados aún
  DEFAULT: {
    code: 'USD', symbol: '$', locale: 'en-US', name: 'Dólar',
    ranges: [
      { min: 0, max: 20, label: 'Económico', value: 'low', description: 'Bajo costo local' },
      { min: 20, max: 60, label: 'Medio', value: 'medium', description: 'Costo promedio local' },
      { min: 60, max: null, label: 'Premium', value: 'high', description: 'Costo alto local' }
    ]
  }
};

// ============================================
// 3. SERVICIO DE MONEDA
// ============================================
export class CurrencyService {
  
  /**
   * Obtiene la configuración de moneda basada en el código de país (MX, ES, etc)
   */
  static fromCountryCode(countryCode: string | undefined): CurrencyConfig {
    if (!countryCode) return CURRENCY_CONFIG.DEFAULT;
    const currencyCode = COUNTRY_TO_CURRENCY[countryCode.toUpperCase()];
    return CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.DEFAULT;
  }

  /**
   * Genera las opciones para el componente de UI
   */
  static getBudgetOptions(countryCode: string) {
    const config = this.fromCountryCode(countryCode);
    return config.ranges.map(range => ({
      label: `${range.label} (${this.formatRange(range, config.symbol)})`,
      value: range.value, // Enviamos 'low', 'medium' o 'high' a la API
      description: range.description
    }));
  }

  private static formatRange(range: BudgetRange, symbol: string): string {
    if (range.max === null) return `> ${symbol}${range.min}`;
    return `${symbol}${range.min} - ${symbol}${range.max}`;
  }

  /**
   * Formatea un número como moneda según el país
   */
  static formatCurrency(amount: number, countryCode: string): string {
    const config = this.fromCountryCode(countryCode);
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      maximumFractionDigits: 0
    }).format(amount);
  }
}