'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type Language = 'en' | 'gu' | 'hi'

interface Translations {
  [key: string]: {
    en: string
    gu: string
    hi: string
  }
}

export const translations: Translations = {
  // Navigation
  dashboard: { en: 'Overview', gu: 'ડેશબોર્ડ', hi: 'डैशबोर्ड' },
  lots: { en: 'Lots Directory', gu: 'લોટ રજિસ્ટર (Lots)', hi: 'लॉट रजिस्टर' },
  factories: { en: 'Factories & Floor', gu: 'કારખાના અને મશીન', hi: 'कारखाना और मशीन' },
  workers: { en: 'Workers & Payroll', gu: 'કારીગર અને હાજરી', hi: 'कारीगर और वेतन' },
  veparis: { en: 'Veparis (Traders)', gu: 'વેપારી ખાતા (Traders)', hi: 'व्यापारी खाता' },
  materials: { en: 'Material & Spares', gu: 'માલ-સામાન અને દોરો', hi: 'सामग्री और धागा' },
  reports: { en: 'Reports & Hisaab', gu: 'હિસાબ અને રિપોર્ટ', hi: 'हिसाब-किताब' },
  linking: { en: 'Business Linking', gu: 'નેટવર્ક લિંકિંગ', hi: 'नेटवर्क लिंकिंग' },
  reminders: { en: 'Active Reminders', gu: 'ડિલિવરી રિમાઇન્ડર', hi: 'डिलीवरी रिमाइंडर' },
  settings: { en: 'Settings & Masters', gu: 'સેટિંગ્સ અને માસ્ટર્સ', hi: 'सेटिंग्स और मास्टर' },

  // Top Bar & Global
  searchPlaceholder: { en: 'Search lots, clients, factories... ⌘K', gu: 'લોટ, વેપારી, કારખાનું શોધો... ⌘K', hi: 'लॉट, व्यापारी, कारखाना खोजें... ⌘K' },
  inwardLot: { en: '+ Inward Lot', gu: '+ નવો લોટ', hi: '+ नया लॉट' },
  shiftActive: { en: 'Shift Active', gu: 'શિફ્ટ ચાલુ છે', hi: 'शिफ्ट चालू है' },

  // Dashboard Metrics
  receivables: { en: 'Receivables (Vepari)', gu: 'વેપારી પાસેથી લેવાના', hi: 'व्यापारी से लेना' },
  payables: { en: 'Partner Payables', gu: 'કારખાનાને ચૂકવવાના', hi: 'कारखाने को देना' },
  runningLots: { en: 'Running Lots', gu: 'ચાલુ લોટ (Floor)', hi: 'चालू लॉट' },
  deliveryAlerts: { en: 'Delivery Alerts', gu: 'ડિલિવરી બાકી (Alerts)', hi: 'डिलीवरी अलर्ट' },
  productionPipeline: { en: 'Production Stage Telemetry', gu: 'પ્રોડક્શન પાઇપલાઇન ટ્રેકિંગ', hi: 'उत्पादन पाइपलाइन' },
  intakeStage: { en: '01. Inward Intake', gu: '૦૧. આવક લોટ', hi: '०१. आवक लॉट' },
  runningStage: { en: '02. On Machines (Running)', gu: '૦૨. મશીન પર ચાલુ', hi: '०२. मशीन पर चालू' },
  completedStage: { en: '03. Finished & Billed', gu: '૦૩. તૈયાર માલ (બિલ)', hi: '०३. तैयार माल' },

  // Common Business Terms
  lotNumber: { en: 'Lot #', gu: 'લોટ નંબર', hi: 'लॉट नं.' },
  challanNumber: { en: 'Challan #', gu: 'ચલણ નંબર', hi: 'चालान नं.' },
  vepariName: { en: 'Trader / Vepari', gu: 'વેપારીનું નામ', hi: 'व्यापारी का नाम' },
  totalPieces: { en: 'Total Pieces', gu: 'કુલ પીસ (Taag)', hi: 'कुल पीस' },
  allottedPieces: { en: 'Allotted Pieces', gu: 'સોંપેલ પીસ (Floor)', hi: 'आवंटित पीस' },
  remainingPieces: { en: 'Available to Allot', gu: 'બાકી પીસ', hi: 'बाकी पीस' },
  ratePerPiece: { en: 'Rate / Piece', gu: 'ભાવ / પીસ (Rate)', hi: 'दर / पीस' },
  totalAmount: { en: 'Total Amount', gu: 'કુલ રકમ (₹)', hi: 'कुल राशि' },
  status: { en: 'Status', gu: 'સ્થિતિ', hi: 'स्थिति' },
  actions: { en: 'Actions', gu: 'ક્રિયાઓ', hi: 'कार्य' },

  // Workers
  hajiri: { en: 'Hajiri (Shifts)', gu: 'હાજરી (શિફ્ટ)', hi: 'हाजिरी (शिफ्ट)' },
  grossEarned: { en: 'Gross Earned', gu: 'કુલ કમાણી', hi: 'कुल कमाई' },
  upaad: { en: 'Advances (Upaad)', gu: 'ઉપાડ (ખર્ચા)', hi: 'उपाड़ (अग्रिम)' },
  netPayable: { en: 'Net Payable', gu: 'ચુકવવાપાત્ર બાકી', hi: 'देय राशि' },
  recordAdvance: { en: '+ Record Advance', gu: '+ ઉપાડ આપો', hi: '+ उपाड़ दर्ज करें' },

  // Demo Banner
  demoBanner: {
    en: 'Interactive Demo Mode Active — Radhe Embroidery (Surat)',
    gu: 'ઇન્ટરેક્ટિવ ડેમો મોડ ચાલુ છે — રાધે એમ્બ્રોઇડરી (સુરત)',
    hi: 'इंटरैक्टिव डेमो मोड सक्रिय — राधे एम्ब्रॉयडरी (सूरत)',
  },
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const saved = localStorage.getItem('preferred_language') as Language
    if (saved && (saved === 'en' || saved === 'gu' || saved === 'hi')) {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('preferred_language', lang)
  }

  const t = (key: string): string => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language]
    }
    return key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
