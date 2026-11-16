import { Prescription } from '../types/index.ts';
import { getStoredToken } from '../services/api.ts';

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const BANGLA_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

export function toBanglaDigits(str: string): string {
  return str.replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] || d);
}

export function formatBanglaDate(isoDate?: string | null): string {
  if (!isoDate) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return isoDate;
  const year = toBanglaDigits(match[1]);
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = toBanglaDigits(String(parseInt(match[3], 10)));
  const monthName = BANGLA_MONTHS[monthIdx] || match[2];
  return `${day} ${monthName} ${year}`;
}

export const BANGLA_CARE_CATEGORIES = [
  {
    key: 'oralHygieneInstructions' as const,
    titleBn: 'মুখের যত্নের নির্দেশনা',
    helperBn: 'মুখ পরিষ্কার ও সুস্থ রাখতে সাধারণ পরামর্শ',
    placeholder: 'যেমন: প্রতিবার খাবারের পর কুসুম গরম লবণ পানি দিয়ে কুলকুচি করুন...',
  },
  {
    key: 'toothBrushingInstructions' as const,
    titleBn: 'দাঁত ব্রাশ করার নির্দেশনা',
    helperBn: 'ব্রাশ করার সঠিক সময়, পদ্ধতি ও টুথব্রাশের ধরন',
    placeholder: 'যেমন: নরম ব্রাশ দিয়ে দিনে দুবার (সকাল ও রাতে খাবারের পর) হালকাভাবে ব্রাশ করুন...',
  },
  {
    key: 'mouthwashRecommendations' as const,
    titleBn: 'মাউথওয়াশ ব্যবহারের নির্দেশনা',
    helperBn: 'মাউথওয়াশ ব্যবহারের পরিমাণ, সময়কাল ও নিয়ম',
    placeholder: 'যেমন: ক্লোরহেক্সিডিন মাউথওয়াশ ১০ মি.লি. নিয়ে ৩০ সেকেন্ড কুলকুচি করে ফেলে দিন...',
  },
  {
    key: 'postExtractionInstructions' as const,
    titleBn: 'দাঁত তোলার পর করণীয়',
    helperBn: 'দাঁত তোলার পর রক্ত বন্ধ ও ক্ষতস্থানের যত্ন',
    placeholder: 'যেমন: তুলা বা গজ ৪৫ মিনিট কামড়ে ধরে রাখুন, ২৪ ঘণ্টা থুথু বা জোরে কুলকুচি করবেন না...',
  },
  {
    key: 'postTreatmentPrecautions' as const,
    titleBn: 'চিকিৎসার পর সতর্কতা',
    helperBn: 'চিকিৎসা পরবর্তী সাবধানতা ও জরুরি যোগাযোগের পরামর্শ',
    placeholder: 'যেমন: অবশ ভাব থাকা অবস্থায় গরম খাবার বা গাল কামড়ানো থেকে বিরত থাকুন...',
  },
  {
    key: 'dietaryRecommendations' as const,
    titleBn: 'খাবার সংক্রান্ত নির্দেশনা',
    helperBn: 'কী খাবেন এবং কী ধরনের খাবার এড়িয়ে চলবেন',
    placeholder: 'যেমন: প্রথম ২৪-৪৮ ঘণ্টা নরম ও ঠান্ডা/স্বাভাবিক তাপমাত্রার খাবার খান; শক্ত ও ঝাল খাবার পরিহার করুন...',
  },
  {
    key: 'additionalClinicalAdvice' as const,
    titleBn: 'পরবর্তী সাক্ষাতের নির্দেশনা ও অন্যান্য নির্দেশনা',
    helperBn: 'পরবর্তী অ্যাপয়েন্টমেন্ট ও অতিরিক্ত পরামর্শ',
    placeholder: 'যেমন: অ্যান্টিবায়োটিকের সম্পূর্ণ কোর্স শেষ করুন এবং নির্ধারিত তারিখে ফলো-আপের জন্য আসুন...',
  },
];

export async function downloadPrescriptionPdf(rx: Prescription): Promise<void> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api/prescriptions/${rx.id}/pdf`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate A4 PDF';
    let errorCode: string | undefined;
    try {
      const errData = await response.json();
      errorMsg = errData.error || errorMsg;
      errorCode = errData.code;
    } catch {
      errorMsg = response.statusText || errorMsg;
    }
    if (errorCode === 'FEATURE_DISABLED' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('prescription-feature-disabled', { detail: errorMsg }));
    }
    throw new Error(errorMsg);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const cleanPatient = (rx.patientName || 'Patient').replace(/[^a-zA-Z0-9_-]+/g, '_');
  a.href = url;
  a.download = `${rx.prescriptionNumber}_${cleanPatient}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
