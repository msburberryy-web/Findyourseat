/// <reference types="vite/client" />
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, User, RefreshCw, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Guest } from './types';
import { sampleGuests } from './data/sampleGuests';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Language = 'en' | 'ja' | 'my';

const translations = {
  en: {
    presentedBy: "Presented By",
    findSeat: "Please Find Your Seat",
    searchPlaceholder: "Search your name...",
    emptyState: "Enter your name to see your table assignment",
    tableNumber: "Table Number",
    guestNotFound: "Guest Not Found",
    noMatch: "We couldn't find a match for \"{query}\". Please check the spelling or consult our welcome staff.",
    professionalService: "Professional Event Planning & Design",
    visitPortfolio: "Visit our Portfolio",
    contactSocial: "Contact & Social",
    updatingData: "Updating Live Data...",
    syncList: "Sync Guest List",
  },
  ja: {
    presentedBy: "プロデュース",
    findSeat: "お席をご確認ください",
    searchPlaceholder: "お名前を検索...",
    emptyState: "お名前を入力して、テーブル番号をご確認ください",
    tableNumber: "テーブル番号",
    guestNotFound: "ゲストが見つかりません",
    noMatch: "「{query}」に一致するお名前が見つかりませんでした。綴りを確認するか、受付スタッフにお尋ねください。",
    professionalService: "プロフェッショナルなイベント企画・デザイン",
    visitPortfolio: "ポートフォリオを見る",
    contactSocial: "連絡先 & ソーシャル",
    updatingData: "データを更新中...",
    syncList: "ゲストリストを同期",
  },
  my: {
    presentedBy: "စီစဉ်တင်ဆက်သူ",
    findSeat: "သင်၏ထိုင်ခုံကို ရှာဖွေပါ",
    searchPlaceholder: "သင်၏အမည်ကို ရှာဖွေပါ...",
    emptyState: "သင်၏စားပွဲအမှတ်ကို သိရှိရန် အမည်ရိုက်ထည့်ပါ",
    tableNumber: "စားပွဲအမှတ်",
    guestNotFound: "ဧည့်သည်အမည် မတွေ့ရှိပါ",
    noMatch: "「{query}」နှင့် ကိုက်ညီသော အမည်မတွေ့ရှိပါ။ စာလုံးပေါင်း ပြန်စစ်ပါ သို့မဟုတ် ဝန်ထမ်းများကို မေးမြန်းပါ။",
    professionalService: "ပရော်ဖက်ရှင်နယ် ပွဲစီစဉ်ခြင်းနှင့် ဒီဇိုင်း",
    visitPortfolio: "ကျွန်ုပ်တို့၏ လုပ်ဆောင်ချက်များကို ကြည့်ရှုရန်",
    contactSocial: "ဆက်သွယ်ရန်",
    updatingData: "ဒေတာများ အပ်ဒိတ်လုပ်နေသည်...",
    syncList: "ဧည့်စာရင်းကို ထပ်မံရယူရန်",
  }
};

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const t = translations[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [guests, setGuests] = useState<Guest[]>(sampleGuests);
  const [isLoading, setIsLoading] = useState(false);

  const [googleSheetId, setGoogleSheetId] = useState('');
  const [eventName, setEventName] = useState('Event Seating');

  const extractSheetId = (input: string) => {
    if (!input) return '';
    if (input.includes('/d/')) {
      return input.split('/d/')[1].split('/')[0];
    }
    return input;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event');
    
    if (eventId) {
      loadEventConfig(eventId);
    } else {
      // Default to demo_event if no event ID is provided
      loadEventConfig('demo_event');
    }
  }, []);

  const loadEventConfig = async (eventId: string) => {
    setIsLoading(true);
    try {
      // use Vite's BASE_URL so paths work both in dev ("/") and production ("/Findyourseat/")
    const configRes = await fetch(`${import.meta.env.BASE_URL}event_info/${eventId}.json`);
      if (!configRes.ok) throw new Error('Config file not found');
      const config = await configRes.json();
      
      if (config.googleSheetId && extractSheetId(config.googleSheetId)) {
        setGoogleSheetId(config.googleSheetId);
        if (config.eventName) setEventName(config.eventName);
        fetchGoogleSheetData(config.googleSheetId);
      } else if (config.guests && Array.isArray(config.guests)) {
        if (config.eventName) setEventName(config.eventName);
        setGuests(config.guests);
        setGoogleSheetId(''); // Clear sheet ID if using local data
      }
    } catch (error) {
      console.error('Error loading event config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const [debugInfo, setDebugInfo] = useState<{sheetName: string, columns: string[]}[]>([]);

  const fetchGoogleSheetData = async (sheetId: string) => {
    const id = extractSheetId(sheetId);
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
      if (!response.ok) throw new Error('Failed to fetch sheet');
      
      const buffer = await response.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      
      let allGuests: Guest[] = [];
      let foundTableColumn = false;
      const debug: {sheetName: string, columns: string[]}[] = [];
      
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        if (data.length === 0) continue;

        const firstRow = data[0];
        const keys = Object.keys(firstRow);
        debug.push({ sheetName: name, columns: keys });
        
        const hasTable = keys.some(k => k.toLowerCase() === 'table' || k.toLowerCase() === 'table number');
        const hasName = keys.some(k => k.toLowerCase().includes('name'));

        if (hasName) {
          const sheetGuests: Guest[] = [];
          data.forEach((row) => {
            const attendance = String(row['Attendance'] || row['attendance'] || 'attend').toLowerCase();
            if (attendance !== 'attend' && row['Attendance'] !== undefined) return;

            const tableNumber = row['Table'] || row['table'] || row['Table Number'] || row['table number'] || row['Seat'] || row['seat'] || '?';
            if (tableNumber !== '?' && tableNumber !== undefined) foundTableColumn = true;

            const fullName = row['Full Name'] || row['full name'] || row['Name'] || row['name'] || '';
            if (fullName && String(fullName).trim()) {
              sheetGuests.push({
                name: String(fullName).trim(),
                tableNumber: String(tableNumber),
              });
            }

            const guestInfo = row['Guest Info'] || row['guest info'] || '';
            if (guestInfo && String(guestInfo).trim()) {
              const additionalNames = String(guestInfo)
                .split(/[,&]|\band\b/i)
                .map(n => n.trim())
                .filter(n => n && n.length > 1);

              additionalNames.forEach(name => {
                sheetGuests.push({
                  name: name,
                  tableNumber: String(tableNumber),
                });
              });
            }
          });

          if (sheetGuests.length > 0) {
            allGuests = sheetGuests;
            if (foundTableColumn) {
              // If we found a sheet with a Table column, we prefer it
            }
          }
        }
      }

      setDebugInfo(debug);
      if (allGuests.length > 0) {
        setGuests(allGuests);
      }
    } catch (error) {
      console.error('Error fetching Google Sheet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredGuests = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return guests.filter((guest) =>
      guest.name.toLowerCase().includes(query)
    );
  }, [searchQuery, guests]);

  return (
    <div className="min-h-screen bg-[#FDFCF0] relative overflow-hidden flex flex-col items-center px-6 py-12 md:py-20 transition-colors duration-700 font-sans text-stone-900">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-gold/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gold/5 blur-[120px]" />
      </div>

      {/* Language Switcher */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-white/80 backdrop-blur-md p-1.5 rounded-full border border-stone-200 shadow-sm">
        <div className="p-1.5 text-stone-400">
          <Globe size={14} />
        </div>
        {(['en', 'ja', 'my'] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={cn(
              "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all",
              language === lang 
                ? "bg-gold text-white shadow-md shadow-gold/20" 
                : "text-stone-400 hover:text-stone-600 hover:bg-stone-50"
            )}
          >
            {lang === 'en' ? 'EN' : lang === 'ja' ? 'JA' : 'MY'}
          </button>
        ))}
      </div>

      {/* Service Header - Amoré Wedding Tokyo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl flex flex-col items-center mb-16 border-b border-stone-200 pb-8"
      >
        <a 
          href="https://www.facebook.com/p/Amor%C3%A9wedding-Tokyo-61575756988945/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-gold text-[10px] uppercase tracking-[0.6em] font-semibold mb-1">{t.presentedBy}</span>
          <h2 className="font-serif text-2xl md:text-4xl text-stone-800 tracking-tighter italic">
            Amoré Wedding <span className="not-italic text-gold">Tokyo</span>
          </h2>
          <div className="h-px w-24 bg-gold/40 group-hover:w-48 transition-all duration-500" />
        </a>
      </motion.div>

      {/* Event Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-4xl text-center mb-16"
      >
        <h1 className="font-serif text-4xl md:text-6xl font-light tracking-tight text-stone-800 mb-4 leading-none">
          {eventName}
        </h1>
        <div className="flex items-center justify-center gap-6">
          <div className="h-[1px] w-12 bg-stone-300" />
          <p className="text-stone-600 font-medium tracking-[0.4em] uppercase text-[11px]">
            {t.findSeat}
          </p>
          <div className="h-[1px] w-12 bg-stone-300" />
        </div>
      </motion.div>

      {/* Search Section */}
      <div className="w-full max-w-2xl relative mb-24">
        <div className="relative group">
          <div className="absolute inset-0 bg-white/40 backdrop-blur-md rounded-2xl border border-stone-200 group-focus-within:border-gold group-focus-within:bg-white group-focus-within:shadow-xl group-focus-within:shadow-gold/5 transition-all duration-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="relative w-full bg-transparent py-6 px-8 text-xl md:text-3xl font-serif focus:outline-none transition-all placeholder:text-stone-400 placeholder:font-light text-center"
            id="guest-search"
          />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-4 z-10">
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-stone-400 hover:text-stone-800 transition-colors p-2"
              >
                <X size={20} />
              </button>
            )}
            <Search className="text-stone-400 group-focus-within:text-gold transition-colors" size={24} />
          </div>
        </div>

        {/* Results */}
        <div className="mt-12 min-h-[300px]">
          <AnimatePresence mode="wait">
            {searchQuery.trim() === '' ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-20"
              >
                <div className="inline-block p-6 border border-stone-200 rounded-full mb-4">
                  <User size={32} className="text-stone-300" />
                </div>
                <p className="text-stone-500 font-medium italic text-lg tracking-wide">{t.emptyState}</p>
              </motion.div>
            ) : filteredGuests.length > 0 ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {filteredGuests.map((guest, index) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={`${guest.name}-${index}`}
                    className="bg-white/50 backdrop-blur-sm p-6 md:p-10 rounded-3xl border border-stone-100 flex flex-col md:flex-row justify-between items-center group hover:bg-white hover:shadow-2xl hover:shadow-gold/5 transition-all duration-500"
                  >
                    <div className="flex items-center gap-6 mb-4 md:mb-0">
                      <div className="w-12 h-12 rounded-full border border-gold/20 flex items-center justify-center text-stone-400 group-hover:bg-gold group-hover:text-white group-hover:border-gold transition-all duration-500 shadow-sm">
                        <User size={20} />
                      </div>
                      <span className="font-serif text-xl md:text-2xl text-stone-700 group-hover:text-stone-900 transition-colors">
                        {guest.name}
                      </span>
                    </div>
                    <div className="flex flex-col items-center md:items-end">
                      <span className="text-gold text-[10px] font-bold uppercase tracking-[0.3em] mb-1">{t.tableNumber}</span>
                      <span className="font-serif text-4xl md:text-6xl text-stone-800 group-hover:scale-110 transition-transform duration-500">
                        {guest.tableNumber}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="no-match"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16 bg-stone-50/50 rounded-3xl border border-dashed border-stone-200"
              >
                <p className="text-stone-600 font-serif text-xl mb-2">{t.guestNotFound}</p>
                <p className="text-stone-500 text-sm max-w-xs mx-auto leading-relaxed">
                  {t.noMatch.replace('{query}', searchQuery)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Service Footer - Amoré Wedding Tokyo */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="w-full max-w-4xl mt-auto pt-20 border-t border-stone-200 flex flex-col items-center text-center"
      >
        <div className="mb-12">
          <p className="text-stone-600 text-[11px] uppercase tracking-[0.5em] mb-8 font-medium">{t.professionalService}</p>
          <a 
            href="https://www.facebook.com/p/Amor%C3%A9wedding-Tokyo-61575756988945/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block group"
          >
            <h3 className="font-serif text-3xl md:text-5xl text-stone-800 mb-4 group-hover:text-gold transition-colors">
              Amoré Wedding Tokyo
            </h3>
            <div className="flex items-center justify-center gap-4 text-gold text-[10px] font-medium uppercase tracking-[0.3em] group-hover:gap-8 transition-all duration-500">
              <span>{t.visitPortfolio}</span>
              <div className="h-px w-8 bg-gold" />
            </div>
          </a>
        </div>

        <div className="flex flex-col items-center gap-4 w-full mb-16">
          <p className="text-stone-600 text-[10px] uppercase tracking-widest font-bold">{t.contactSocial}</p>
          <a 
            href="https://www.facebook.com/p/Amor%C3%A9wedding-Tokyo-61575756988945/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-stone-600 hover:text-gold transition-colors text-[11px] tracking-wider break-all max-w-xs md:max-w-none font-medium"
          >
            facebook.com/p/Amoréwedding-Tokyo-61575756988945/
          </a>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 mb-8">
            <RefreshCw size={16} className="text-gold animate-spin" />
            <p className="text-stone-600 text-[10px] uppercase tracking-widest font-medium">{t.updatingData}</p>
          </div>
        ) : (googleSheetId && extractSheetId(googleSheetId)) ? (
          <button 
            onClick={() => fetchGoogleSheetData(googleSheetId)}
            className="mb-8 px-6 py-3 rounded-full border border-gold/30 text-gold hover:bg-gold hover:text-white transition-all text-[10px] uppercase tracking-widest flex items-center gap-2 font-bold"
          >
            <RefreshCw size={12} />
            {t.syncList}
          </button>
        ) : null}

        <div className="h-px w-24 bg-gold/20 mb-8" />
        
        <p className="text-stone-400 text-[9px] uppercase tracking-[0.4em] font-medium">
          &copy; {new Date().getFullYear()} Amoré Wedding Tokyo. All Rights Reserved.
        </p>
      </motion.div>
    </div>
  );
}
