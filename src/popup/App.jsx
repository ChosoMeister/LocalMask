import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Globe, MapPin, Power, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';

const locations = [
  { id: "America/New_York", label: "US - New York (EST)" },
  { id: "America/Chicago", label: "US - Chicago (CST)" },
  { id: "America/Denver", label: "US - Denver (MST)" },
  { id: "America/Los_Angeles", label: "US - Los Angeles (PST)" },
  { id: "America/Toronto", label: "CA - Toronto (EST)" },
  { id: "America/Vancouver", label: "CA - Vancouver (PST)" },
  { id: "America/Mexico_City", label: "MX - Mexico City (CST)" },
  { id: "America/Sao_Paulo", label: "BR - Sao Paulo (BRT)" },
  { id: "America/Buenos_Aires", label: "AR - Buenos Aires (ART)" },
  { id: "America/Bogota", label: "CO - Bogota (COT)" },
  { id: "Europe/London", label: "UK - London (GMT)" },
  { id: "Europe/Paris", label: "FR - Paris (CET)" },
  { id: "Europe/Berlin", label: "DE - Frankfurt (CET)" },
  { id: "Europe/Amsterdam", label: "NL - Amsterdam (CET)" },
  { id: "Europe/Istanbul", label: "TR - Istanbul (TRT)" },
  { id: "Asia/Tokyo", label: "JP - Tokyo (JST)" },
  { id: "Asia/Singapore", label: "SG - Singapore (SGT)" },
  { id: "Australia/Sydney", label: "AU - Sydney (AEST)" },
];

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [isAutoSync, setIsAutoSync] = useState(true);
  const [isWebRTCProtected, setIsWebRTCProtected] = useState(true);
  const [currentLocation, setCurrentLocation] = useState("America/New_York");
  const [statusText, setStatusText] = useState("Unmasked");
  const [autoDetectedLabel, setAutoDetectedLabel] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  
  // Blacklist states
  const [blacklist, setBlacklist] = useState(["meet.google.com"]);
  const [newDomain, setNewDomain] = useState("");
  
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['targetTimezone', 'isActive', 'isAutoSync', 'isWebRTCProtected', 'autoLabel', 'blacklist'], (data) => {
        if (data.targetTimezone) setCurrentLocation(data.targetTimezone);
        if (data.isAutoSync !== undefined) setIsAutoSync(data.isAutoSync);
        if (data.isWebRTCProtected !== undefined) setIsWebRTCProtected(data.isWebRTCProtected);
        if (data.autoLabel) setAutoDetectedLabel(data.autoLabel);
        
        if (data.blacklist) {
          setBlacklist(data.blacklist);
        } else {
          // Initialize default blacklist
          chrome.storage.local.set({ blacklist: ["meet.google.com"] });
        }
        
        if (data.isActive) {
          setIsActive(true);
          setStatusText("Masked");
        }
      });
    }
  }, []);

  const handleAutoSyncToggle = (checked) => {
    setIsAutoSync(checked);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ isAutoSync: checked });
    }
  };

  const handleWebRTCToggle = async (checked) => {
    setIsWebRTCProtected(checked);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ isWebRTCProtected: checked });
      // If currently active, immediately update the background setting
      if (isActive) {
        chrome.runtime.sendMessage({ action: "update_webrtc", enabled: checked });
      }
    }
  };
  
  const addDomainToBlacklist = (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    
    let cleanDomain = newDomain.trim().toLowerCase();
    try {
      // Add a dummy protocol if missing so URL constructor parses it correctly
      if (!cleanDomain.startsWith('http://') && !cleanDomain.startsWith('https://')) {
        cleanDomain = 'https://' + cleanDomain;
      }
      const urlObj = new URL(cleanDomain);
      // Decode to handle characters like '*' that get converted to '%2a'
      cleanDomain = decodeURIComponent(urlObj.hostname);
      
      // Strip 'www.' if present
      if (cleanDomain.startsWith('www.')) {
        cleanDomain = cleanDomain.slice(4);
      }
    } catch (e) {
      // Fallback if URL parsing fails completely
      cleanDomain = newDomain.trim().toLowerCase().split('/')[0];
    }
    
    if (cleanDomain && !blacklist.includes(cleanDomain)) {
      const updatedList = [...blacklist, cleanDomain];
      setBlacklist(updatedList);
      setNewDomain("");
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ blacklist: updatedList });
      }
    }
  };
  
  const removeDomainFromBlacklist = (domainToRemove) => {
    const updatedList = blacklist.filter(d => d !== domainToRemove);
    setBlacklist(updatedList);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ blacklist: updatedList });
    }
  };

  const fetchAndApplyAutoIP = async () => {
    setIsFetching(true);
    setStatusText('Locating IP...');
    try {
      const response = await fetch('https://ipwho.is/');
      const data = await response.json();
      
      if (data && data.success) {
        const { locale, acceptLanguage } = getLocaleFromCountry(data.country_code);
        const dynamicProfile = {
          timezone: data.timezone.id,
          locale: locale,
          acceptLanguage: acceptLanguage,
          lat: data.latitude,
          lon: data.longitude
        };
        
        const label = `Auto: ${data.city}, ${data.country_code}`;
        setAutoDetectedLabel(label);

        if (typeof chrome !== 'undefined' && chrome.storage) {
          await chrome.storage.local.set({ 
            targetProfile: dynamicProfile, 
            autoLabel: label,
            isActive: true 
          });
          
          chrome.runtime.sendMessage({ action: "update_profile", profile: dynamicProfile, webrtc: isWebRTCProtected }, () => {
            setStatusText('Masked');
            setIsFetching(false);
          });
        }
      } else {
        throw new Error("API failed");
      }
    } catch (error) {
      console.error(error);
      // Fallback to manual selection
      applyManualProfile();
    }
  };

  const applyManualProfile = async (loc = currentLocation) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // Clear dynamic profile to fallback to timezone key
      await chrome.storage.local.set({ targetProfile: null, targetTimezone: loc, isActive: true });
      chrome.runtime.sendMessage({ action: "update_profile", timezone: loc, webrtc: isWebRTCProtected }, () => {
        setStatusText('Masked');
        setIsFetching(false);
      });
    } else {
      setTimeout(() => {
        setStatusText('Masked');
        setIsFetching(false);
      }, 500); 
    }
  };

  const toggleSpoofer = async () => {
    if (isActive) {
      setIsActive(false);
      setStatusText("Unmasked");
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ isActive: false });
        chrome.runtime.sendMessage({ action: "disable_profile" });
      }
    } else {
      setIsActive(true);
      if (isAutoSync) {
        fetchAndApplyAutoIP();
      } else {
        applyManualProfile();
      }
    }
  };

  // Helper function to map country codes to proper locales
  const getLocaleFromCountry = (countryCode) => {
    const localeMap = {
      'US': { locale: 'en-US', acceptLanguage: 'en-US,en;q=0.9' },
      'CA': { locale: 'en-CA', acceptLanguage: 'en-CA,en;q=0.9' },
      'GB': { locale: 'en-GB', acceptLanguage: 'en-GB,en;q=0.9' },
      'DE': { locale: 'de-DE', acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8' },
      'FR': { locale: 'fr-FR', acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8' },
      'NL': { locale: 'nl-NL', acceptLanguage: 'nl-NL,nl;q=0.9,en;q=0.8' },
      'TR': { locale: 'tr-TR', acceptLanguage: 'tr-TR,tr;q=0.9,en;q=0.8' },
      'IR': { locale: 'fa-IR', acceptLanguage: 'fa-IR,fa;q=0.9,en;q=0.8' },
      'AE': { locale: 'ar-AE', acceptLanguage: 'ar-AE,ar;q=0.9,en;q=0.8' }
    };
    return localeMap[countryCode] || { locale: 'en-US', acceptLanguage: 'en-US,en;q=0.9' };
  };

  return (
    <div className="w-[360px] relative overflow-hidden bg-[#0a0f1c] text-primary-foreground font-sans flex flex-col p-5">
      
      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 z-0 opacity-80 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/40 rounded-full blur-3xl mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute top-1/3 -right-24 w-64 h-64 bg-secondary/30 rounded-full blur-3xl mix-blend-screen animate-pulse" style={{ animationDuration: '7s' }}></div>
        <div className="absolute -bottom-24 left-1/4 w-72 h-72 bg-blue-600/30 rounded-full blur-3xl mix-blend-screen animate-pulse" style={{ animationDuration: '5s' }}></div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-8 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 shadow-inner">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none text-white">LocalMask</h1>
            <p className="text-[10px] text-white/70 font-medium tracking-widest uppercase mt-1">CDP Privacy Engine</p>
          </div>
        </div>
      </div>

      {/* Main Status Toggle */}
      <div className="relative z-10 flex flex-col items-center justify-center mb-6">
        <button
          onClick={toggleSpoofer}
          disabled={isFetching}
          className={cn(
            "group relative flex items-center justify-center w-28 h-28 rounded-full transition-all duration-500 shadow-2xl",
            isActive ? "bg-white text-primary hover:scale-105" : "bg-white/10 text-white hover:bg-white/20 border border-white/20",
            isFetching ? "opacity-70 cursor-not-allowed scale-95" : ""
          )}
        >
          {/* Ripple effect when active */}
          {isActive && (
            <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping"></div>
          )}
          
          <Power className={cn(
            "w-10 h-10 transition-transform duration-500",
            isActive ? "drop-shadow-md" : "opacity-80"
          )} />
        </button>

        <div className="mt-5 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            {isActive ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <Shield className="w-4 h-4 text-slate-400" />}
            <span className={cn(
              "text-lg font-bold tracking-wide uppercase",
              isActive ? "text-emerald-400" : "text-slate-300"
            )}>
              {statusText}
            </span>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="mt-auto mb-1 flex-1 z-10 flex flex-col gap-3">
        
        {/* Auto-Sync Toggle */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div>
            <label className="text-[12px] font-bold text-white block mb-0.5">Auto-Detect IP</label>
            <span className="text-[10px] text-white/60">Syncs GPS/Timezone with VPN</span>
          </div>
          
          <button 
            type="button"
            onClick={() => handleAutoSyncToggle(!isAutoSync)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              isAutoSync ? "bg-emerald-500" : "bg-white/20"
            )}
          >
            <span 
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                isAutoSync ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* WebRTC Protection Toggle */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div>
            <label className="text-[12px] font-bold text-white block mb-0.5">WebRTC Protection</label>
            <span className="text-[10px] text-white/60">Disable for Google Meet / Zoom</span>
          </div>
          
          <button 
            type="button"
            onClick={() => handleWebRTCToggle(!isWebRTCProtected)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              isWebRTCProtected ? "bg-emerald-500" : "bg-white/20"
            )}
          >
            <span 
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                isWebRTCProtected ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
        
        {/* Blacklist Manager */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <label className="text-[11px] font-bold text-white/80 uppercase tracking-widest mb-2 block">
            Ignored Domains (Blacklist)
          </label>
          
          <form onSubmit={addDomainToBlacklist} className="flex gap-2 mb-2.5">
            <input 
              type="text" 
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g. meet.google.com" 
              className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all"
            />
            <button 
              type="submit"
              disabled={!newDomain.trim()}
              className="bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white rounded-lg px-2.5 flex items-center justify-center transition-colors border border-white/10"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
          
          <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto pr-1 custom-scrollbar">
            {blacklist.length === 0 ? (
              <span className="text-[10px] text-white/50 italic">No domains ignored</span>
            ) : (
              blacklist.map((domain) => (
                <div key={domain} className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-full pl-2 pr-1 py-0.5 text-[10px] text-white/90">
                  <span className="truncate max-w-[120px]">{domain}</span>
                  <button 
                    onClick={() => removeDomainFromBlacklist(domain)}
                    className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Location Selector (Disabled if Auto-Sync is ON and Active) */}
        {!isAutoSync && (
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <label className="text-[11px] font-bold text-white/80 uppercase tracking-widest mb-2 block ml-1">
              Manual Location
            </label>
            <div className="relative">
              <select
                value={currentLocation}
                onChange={(e) => {
                  setCurrentLocation(e.target.value);
                  if (isActive) applyManualProfile(e.target.value);
                }}
                disabled={isActive && isAutoSync}
                className={cn(
                  "w-full appearance-none bg-black/20 border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all cursor-pointer",
                  (isActive && isAutoSync) ? "opacity-50 cursor-not-allowed" : "hover:bg-black/30"
                )}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="text-black bg-white">
                    {loc.label}
                  </option>
                ))}
              </select>
              <MapPin className="absolute right-3 top-2.5 w-4 h-4 text-white/50 pointer-events-none" />
            </div>
          </div>
        )}
        
        {/* Status indicator for Auto-Sync */}
        {isActive && isAutoSync && autoDetectedLabel && (
           <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-2.5 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
             <p className="text-[11px] text-emerald-100 font-medium truncate">
               {autoDetectedLabel}
             </p>
           </div>
        )}
      </div>

      {/* Global Shortcut Hint */}
      <div className="relative z-10 text-center mt-3 mb-1 opacity-60">
        <p className="text-[10px] text-white/80 leading-tight">
          Shortcut: <span className="font-mono">Alt+Shift+X</span><br/>
          <span className="text-[8px] opacity-75">(Edit in chrome://extensions/shortcuts)</span>
        </p>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
