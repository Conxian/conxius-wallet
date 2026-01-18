
/**
 * Conxius I18n Service
 * Deterministic localization engine for sovereign interfaces.
 */

export type Language = 'en' | 'es' | 'de' | 'zh' | 'cypher';

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.payments': 'Payments',
    'nav.bridge': 'NTT Bridge',
    'nav.security': 'Security',
    'status.stable': 'Production Stable',
    'status.sovereign': 'Sovereign Mode',
    'status.simulation': 'Simulation Mode',
    'balance.title': 'Aggregate Sovereign Wealth',
    'balance.privacy': 'Privacy Enclave Toggle',
    'action.transmit': 'Transmit',
    'action.ingest': 'Ingest',
    'assets.verified': 'Verified Assets',
    'assets.search': 'Search Ledger...',
    'qr.root': 'Verified Root',
    'qr.share': 'Share BIP-compliant address',
  },
  es: {
    'nav.dashboard': 'Panel',
    'nav.payments': 'Pagos',
    'nav.bridge': 'Puente NTT',
    'nav.security': 'Seguridad',
    'status.stable': 'Producción Estable',
    'status.sovereign': 'Modo Soberano',
    'status.simulation': 'Modo Simulación',
    'balance.title': 'Riqueza Soberana Agregada',
    'balance.privacy': 'Privacidad del Enclave',
    'action.transmit': 'Transmitir',
    'action.ingest': 'Ingresar',
    'assets.verified': 'Activos Verificados',
    'assets.search': 'Buscar en el Libro...',
    'qr.root': 'Raíz Verificada',
    'qr.share': 'Compartir dirección BIP',
  },
  de: {
    'nav.dashboard': 'Übersicht',
    'nav.payments': 'Zahlungen',
    'nav.bridge': 'NTT Brücke',
    'nav.security': 'Sicherheit',
    'status.stable': 'Produktionsstabil',
    'status.sovereign': 'Souveräner Modus',
    'status.simulation': 'Simulationsmodus',
    'balance.title': 'Aggregiertes Souveränes Vermögen',
    'balance.privacy': 'Privatsphäre-Umschalter',
    'action.transmit': 'Übermitteln',
    'action.ingest': 'Aufnehmen',
    'assets.verified': 'Verifizierte Bestände',
    'assets.search': 'Ledger durchsuchen...',
    'qr.root': 'Verifizierter Root',
    'qr.share': 'BIP-konforme Adresse teilen',
  },
  zh: {
    'nav.dashboard': '控制面板',
    'nav.payments': '支付',
    'nav.bridge': 'NTT 桥接',
    'nav.security': '安全',
    'status.stable': '生产稳定版',
    'status.sovereign': '主权模式',
    'status.simulation': '模拟模式',
    'balance.title': '综合主权财富',
    'balance.privacy': '隐私开关',
    'action.transmit': '发送',
    'action.ingest': '接收',
    'assets.verified': '已验证资产',
    'assets.search': '搜索账本...',
    'qr.root': '已验证根地址',
    'qr.share': '分享符合 BIP 标准的地址',
  },
  cypher: {
    'nav.dashboard': 'DASH_B',
    'nav.payments': 'TX_IO',
    'nav.bridge': 'NTT_X',
    'nav.security': 'SEC_E',
    'status.stable': 'PROD_STABLE',
    'status.sovereign': 'SOV_MODE',
    'status.simulation': 'SIM_MODE',
    'balance.title': 'AGGR_SOV_WEALTH',
    'balance.privacy': 'ENCLAVE_MASK',
    'action.transmit': 'EXEC_TX',
    'action.ingest': 'INGEST_V',
    'assets.verified': 'VER_UTXO',
    'assets.search': 'GREP_LEDGER',
    'qr.root': 'ROOT_ID',
    'qr.share': 'EXP_PUBKEY',
  }
};

export const getTranslation = (lang: Language, key: string): string => {
  return TRANSLATIONS[lang]?.[key] || key;
};
