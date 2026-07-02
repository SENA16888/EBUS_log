import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  CalendarClock,
  FileAudio,
  Headphones,
  Link,
  Mic2,
  Music2,
  PauseCircle,
  PlayCircle,
  Plus,
  Radio,
  Trash2,
  Upload,
  Volume2,
  Wand2
} from 'lucide-react';
import {
  BroadcastAudioAsset,
  BroadcastEventRule,
  BroadcastPlaybackLog,
  BroadcastSchedule,
  BroadcastYoutubeTrack,
  BroadcastEventMusicSetting,
  Event,
  HouseOperationTimelineBlock,
  InteractiveDeviceProfile
} from '../types';

interface InteractiveDeviceManagerProps {
  devices: InteractiveDeviceProfile[];
  events: Event[];
  canEdit?: boolean;
  onUpdateDevices: (devices: InteractiveDeviceProfile[]) => void;
}

type PendingAnnouncement = {
  id: string;
  title: string;
  time: Date;
  source: BroadcastPlaybackLog['source'];
  text?: string;
  asset?: BroadcastAudioAsset;
  detail?: string;
  priority: number;
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const timeToMinutes = (time?: string) => {
  if (!time) return 0;
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
};

const dateAtTime = (dateKey: string, time: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
};

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

const formatTime = (date: Date) => date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const formatDate = (value?: string) => {
  if (!value) return 'Chưa có ngày';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getEventDateKeys = (event: Event) => {
  const keys = new Set<string>();
  (event.schedule || []).forEach(item => item.date && keys.add(item.date));
  if (event.startDate) keys.add(event.startDate);
  if (event.endDate) keys.add(event.endDate);
  if (!keys.size && event.startDate && event.endDate) keys.add(event.startDate);
  return Array.from(keys);
};

const isEventActiveOnDate = (event: Event, dateKey: string) => {
  const explicitDates = getEventDateKeys(event);
  if (explicitDates.includes(dateKey)) return true;
  if (event.startDate && event.endDate) return event.startDate <= dateKey && dateKey <= event.endDate;
  return false;
};

const getProgramStart = (event: Event) =>
  event.eventProfile?.programTimeStart ||
  event.houseOperation?.timeline?.[0]?.startTime ||
  '09:00';

const getBlockTriggerTime = (dateKey: string, block: HouseOperationTimelineBlock, rule: BroadcastEventRule) => {
  if (rule.trigger === 'BLOCK_END' || rule.trigger === 'BEFORE_BLOCK_END') {
    return addMinutes(dateAtTime(dateKey, block.endTime), rule.offsetMinutes);
  }
  return addMinutes(dateAtTime(dateKey, block.startTime), rule.offsetMinutes);
};

const applyTemplate = (template: string, event: Event, block?: HouseOperationTimelineBlock) =>
  template
    .replace(/\{\{eventName\}\}/g, event.name || 'đoàn trải nghiệm')
    .replace(/\{\{client\}\}/g, event.client || event.eventProfile?.organization || 'đối tác')
    .replace(/\{\{blockTitle\}\}/g, block?.title || 'hoạt động')
    .replace(/\{\{blockRoom\}\}/g, block?.room || 'khu trải nghiệm');

const withYoutubeApiParams = (embedUrl: string) => {
  try {
    const parsed = new URL(embedUrl);
    parsed.searchParams.set('autoplay', '1');
    parsed.searchParams.set('enablejsapi', '1');
    if (typeof window !== 'undefined' && window.location.origin) {
      parsed.searchParams.set('origin', window.location.origin);
    }
    return parsed.toString();
  } catch {
    return embedUrl;
  }
};

const extractYoutubeVideoId = (url?: string) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.replace('/', '').split('/')[0] || '';
    if (parsed.pathname.includes('/embed/')) return parsed.pathname.split('/embed/')[1]?.split(/[/?#]/)[0] || '';
    if (parsed.pathname.includes('/shorts/')) return parsed.pathname.split('/shorts/')[1]?.split(/[/?#]/)[0] || '';
    return parsed.searchParams.get('v') || '';
  } catch {
    return '';
  }
};

const getYoutubeTrackEmbed = (track?: BroadcastYoutubeTrack) => {
  if (!track?.url) return '';
  const videoId = extractYoutubeVideoId(track.url);
  if (videoId) return withYoutubeApiParams(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
  return normalizeYoutubeEmbed(track.url);
};

const getYoutubePlaylistEmbed = (tracks: BroadcastYoutubeTrack[]) => {
  const videoIds = tracks.map(track => extractYoutubeVideoId(track.url)).filter(Boolean);
  if (videoIds.length > 0) {
    const [firstVideoId] = videoIds;
    const playlist = videoIds.join(',');
    return withYoutubeApiParams(`https://www.youtube.com/embed/${encodeURIComponent(firstVideoId)}?playlist=${encodeURIComponent(playlist)}&loop=1`);
  }
  return normalizeYoutubeEmbed(tracks[0]?.url);
};

const normalizeYoutubeEmbed = (url?: string) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const list = parsed.searchParams.get('list');
    if (list) return withYoutubeApiParams(`https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`);
    const videoId = parsed.hostname.includes('youtu.be')
      ? parsed.pathname.replace('/', '')
      : parsed.searchParams.get('v');
    if (videoId) return withYoutubeApiParams(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
    if (parsed.pathname.includes('/embed/')) return withYoutubeApiParams(url);
  } catch {
    return url;
  }
  return url;
};

const createDefaultDevice = (): InteractiveDeviceProfile => ({
  id: 'eh-broadcast-center',
  name: 'Phát thanh trung tâm Einstein House',
  type: 'BROADCAST_CENTER',
  location: 'Einstein House',
  isAutomationEnabled: true,
  volume: 0.82,
  preAnnouncementAssetId: '',
  voiceURI: '',
  backgroundMode: 'LOOP_ALL',
  backgroundTrackId: '',
  youtubeFallbackUrl: 'https://www.youtube.com/embed/videoseries?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
  youtubePlaylist: [
    {
      id: 'yt-default-chill',
      title: 'Nhạc nền Einstein House',
      url: 'https://www.youtube.com/embed/videoseries?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'
    }
  ],
  operatingHours: [
    { id: 'oh-weekday', title: 'Thứ 2 - Thứ 5', daysOfWeek: [1, 2, 3, 4], openTime: '08:00', closeTime: '19:00', enabled: true },
    { id: 'oh-weekend', title: 'Thứ 6 - Chủ nhật', daysOfWeek: [5, 6, 0], openTime: '08:00', closeTime: '21:00', enabled: true }
  ],
  silenceWindows: [
    { id: 'silent-center-lunch', title: 'Nghỉ trưa trung tâm', startTime: '12:00', endTime: '13:00', enabled: true }
  ],
  eventMusicSettings: [],
  audioAssets: [],
  schedules: [],
  eventRules: [],
  playbackLogs: []
});

const buildDailyAnnouncements = (device: InteractiveDeviceProfile, dateKey: string): PendingAnnouncement[] => {
  const today = new Date(dateAtTime(dateKey, '00:00')).getDay();
  return (device.schedules || [])
    .filter(schedule => schedule.enabled)
    .filter(schedule => !schedule.daysOfWeek?.length || schedule.daysOfWeek.includes(today))
    .map(schedule => {
      const asset = (device.audioAssets || []).find(item => item.id === schedule.assetId);
      return {
        id: `schedule-${schedule.id}-${dateKey}`,
        title: schedule.title,
        time: dateAtTime(dateKey, schedule.time),
        source: 'SCHEDULE' as const,
        text: schedule.voiceText || asset?.transcript,
        asset,
        detail: 'Lịch cố định hằng ngày',
        priority: schedule.priority || 0
      };
    });
};

const buildEventAnnouncements = (device: InteractiveDeviceProfile, events: Event[], dateKey: string): PendingAnnouncement[] => {
  const activeEvents = events.filter(event => isEventActiveOnDate(event, dateKey));
  return activeEvents.flatMap(event => (device.eventRules || []).filter(rule => rule.enabled).flatMap(rule => {
    const asset = (device.audioAssets || []).find(item => item.id === rule.assetId);
    if (rule.trigger === 'EVENT_START') {
      const time = addMinutes(dateAtTime(dateKey, getProgramStart(event)), rule.offsetMinutes);
      return [{
        id: `event-${event.id}-${rule.id}-${dateKey}`,
        title: rule.title,
        time,
        source: 'EVENT' as const,
        text: asset ? asset.transcript : applyTemplate(rule.messageTemplate, event),
        asset,
        detail: `${event.name} • ${formatDate(dateKey)}`,
        priority: rule.priority || 0
      }];
    }

    return (event.houseOperation?.timeline || [])
      .filter(block => !rule.blockKind || block.kind === rule.blockKind)
      .map(block => ({
        id: `event-${event.id}-${rule.id}-${block.id}-${dateKey}`,
        title: rule.title,
        time: getBlockTriggerTime(dateKey, block, rule),
        source: 'EVENT' as const,
        text: asset ? asset.transcript : applyTemplate(rule.messageTemplate, event, block),
        asset,
        detail: `${event.name} • ${block.title}`,
        priority: rule.priority || 0
      }));
  }));
};

const normalizeBroadcastDevice = (input?: InteractiveDeviceProfile): InteractiveDeviceProfile => {
  const defaults = createDefaultDevice();
  if (!input) return defaults;

  const existingSchedules = input.schedules || [];
  const hasUpdatedClosingSchedules = existingSchedules.some(schedule =>
    ['bc-end-shift-weekday', 'bc-closing-weekday', 'bc-end-shift-weekend', 'bc-closing-weekend'].includes(schedule.id)
  );
  const schedules = hasUpdatedClosingSchedules
    ? existingSchedules
    : [
        ...existingSchedules.filter(schedule => !['bc-end-shift', 'bc-closing'].includes(schedule.id)),
        ...defaults.schedules.filter(defaultSchedule =>
          !existingSchedules.some(schedule => schedule.id === defaultSchedule.id) &&
          ['bc-end-shift-weekday', 'bc-closing-weekday', 'bc-end-shift-weekend', 'bc-closing-weekend'].includes(defaultSchedule.id)
        )
      ];

  return {
    ...defaults,
    ...input,
    backgroundMode: input.backgroundMode || defaults.backgroundMode,
    backgroundTrackId: input.backgroundTrackId || defaults.backgroundTrackId,
    youtubePlaylist: input.youtubePlaylist && input.youtubePlaylist.length > 0
      ? input.youtubePlaylist
      : (input.youtubeFallbackUrl ? [{ id: 'yt-legacy-fallback', title: 'Nhạc nền đang lưu', url: input.youtubeFallbackUrl }] : defaults.youtubePlaylist),
    operatingHours: input.operatingHours && input.operatingHours.length > 0 ? input.operatingHours : defaults.operatingHours,
    silenceWindows: input.silenceWindows && input.silenceWindows.length > 0 ? input.silenceWindows : defaults.silenceWindows,
    eventMusicSettings: input.eventMusicSettings || [],
    schedules: schedules.length > 0 ? schedules : defaults.schedules,
    audioAssets: input.audioAssets || [],
    eventRules: input.eventRules && input.eventRules.length > 0 ? input.eventRules : defaults.eventRules,
    playbackLogs: input.playbackLogs || []
  };
};

export const InteractiveDeviceManager: React.FC<InteractiveDeviceManagerProps> = ({
  devices,
  events,
  canEdit = true,
  onUpdateDevices
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const playedKeysRef = useRef<Set<string>>(new Set());
  const [now, setNow] = useState(new Date());
  const [isRunning, setIsRunning] = useState(false);
  const [isTabletMode, setIsTabletMode] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('Thông báo mới');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleText, setScheduleText] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetTitle, setAssetTitle] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [voiceTitle, setVoiceTitle] = useState('Voice AI thông báo');
  const [voiceText, setVoiceText] = useState('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const storedDevice = devices.find(item => item.type === 'BROADCAST_CENTER') || devices[0];
  const device = normalizeBroadcastDevice(storedDevice);
  const todayKey = getLocalDateKey(now);
  const backgroundTracks = useMemo<BroadcastYoutubeTrack[]>(() => {
    if (device.youtubePlaylist && device.youtubePlaylist.length > 0) return device.youtubePlaylist;
    if (device.youtubeFallbackUrl) {
      return [{ id: 'yt-legacy-fallback', title: 'Nhạc nền đang lưu', url: device.youtubeFallbackUrl }];
    }
    return [];
  }, [device.youtubeFallbackUrl, device.youtubePlaylist]);

  const todayEvents = useMemo(
    () => events.filter(event => isEventActiveOnDate(event, todayKey)),
    [events, todayKey]
  );

  const activeEventMusic = useMemo(() => {
    const settings = device.eventMusicSettings || [];
    return todayEvents
      .map(event => settings.find(setting => setting.enabled && setting.eventId === event.id && setting.trackIds.length > 0))
      .find((setting): setting is BroadcastEventMusicSetting => !!setting);
  }, [device.eventMusicSettings, todayEvents]);

  const effectiveBackgroundTracks = useMemo(() => {
    if (!activeEventMusic) return backgroundTracks;
    const selectedIds = new Set(activeEventMusic.trackIds);
    const selectedTracks = backgroundTracks.filter(track => selectedIds.has(track.id));
    return selectedTracks.length > 0 ? selectedTracks : backgroundTracks;
  }, [activeEventMusic, backgroundTracks]);

  const effectiveBackgroundMode = activeEventMusic?.mode || device.backgroundMode || 'LOOP_ALL';
  const activeBackgroundTrack = effectiveBackgroundTracks.find(track =>
    track.id === (activeEventMusic?.trackIds[0] || device.backgroundTrackId)
  ) || effectiveBackgroundTracks[0];

  const announcements = useMemo(() => {
    const list = [
      ...buildDailyAnnouncements(device, todayKey),
      ...buildEventAnnouncements(device, events, todayKey)
    ];
    return list.sort((a, b) => a.time.getTime() - b.time.getTime() || b.priority - a.priority);
  }, [device, events, todayKey]);

  const nextAnnouncements = useMemo(
    () => announcements.filter(item => item.time.getTime() >= now.getTime() - 60 * 1000).slice(0, 8),
    [announcements, now]
  );

  const youtubeEmbed = effectiveBackgroundMode === 'SINGLE'
    ? getYoutubeTrackEmbed(activeBackgroundTrack)
    : getYoutubePlaylistEmbed(effectiveBackgroundTracks);
  const preAnnouncementAsset = useMemo(
    () => (device.audioAssets || []).find(asset => asset.id === device.preAnnouncementAssetId),
    [device.audioAssets, device.preAnnouncementAssetId]
  );
  const sortedVoices = useMemo(
    () => [...availableVoices].sort((left, right) => {
      const leftVi = left.lang.toLowerCase().startsWith('vi') ? 0 : 1;
      const rightVi = right.lang.toLowerCase().startsWith('vi') ? 0 : 1;
      return leftVi - rightVi || left.name.localeCompare(right.name);
    }),
    [availableVoices]
  );
  const broadcastState = useMemo(() => {
    const today = now.getDay();
    const minuteNow = now.getHours() * 60 + now.getMinutes();
    const operatingRule = (device.operatingHours || []).find(rule =>
      rule.enabled && rule.daysOfWeek.includes(today)
    );
    const isOpen = operatingRule
      ? minuteNow >= timeToMinutes(operatingRule.openTime) && minuteNow < timeToMinutes(operatingRule.closeTime)
      : true;

    const eventLunchWindows = todayEvents.flatMap(event =>
      (event.houseOperation?.timeline || [])
        .filter(block => block.kind === 'LUNCH')
        .map(block => ({
          title: `${event.name} - nghỉ trưa đoàn`,
          startTime: block.startTime,
          endTime: block.endTime
        }))
    );
    const centerSilenceWindows = (device.silenceWindows || [])
      .filter(windowItem => windowItem.enabled)
      .filter(windowItem => !windowItem.daysOfWeek?.length || windowItem.daysOfWeek.includes(today))
      .map(windowItem => ({
        title: windowItem.title,
        startTime: windowItem.startTime,
        endTime: windowItem.endTime
      }));
    const silenceWindows = eventLunchWindows.length > 0 ? eventLunchWindows : centerSilenceWindows;
    const activeSilence = silenceWindows.find(windowItem =>
      minuteNow >= timeToMinutes(windowItem.startTime) && minuteNow < timeToMinutes(windowItem.endTime)
    );

    if (!isOpen) {
      return {
        shouldPlayBackground: false,
        label: operatingRule
          ? `Ngoài giờ hoạt động (${operatingRule.openTime} - ${operatingRule.closeTime})`
          : 'Ngoài giờ hoạt động'
      };
    }
    if (activeSilence) {
      return {
        shouldPlayBackground: false,
        label: `Tạm ngưng: ${activeSilence.title} (${activeSilence.startTime} - ${activeSilence.endTime})`
      };
    }
    return {
      shouldPlayBackground: true,
      label: operatingRule
        ? `Đang phát nền trong giờ mở cửa (${operatingRule.openTime} - ${operatingRule.closeTime})`
        : 'Đang phát nền'
    };
  }, [device.operatingHours, device.silenceWindows, now, todayEvents]);

  const sendYoutubeCommand = (func: string, args: unknown[] = []) => {
    youtubeIframeRef.current?.contentWindow?.postMessage(JSON.stringify({
      event: 'command',
      func,
      args
    }), '*');
  };

  const setYoutubeBackgroundVolume = (volume: number) => {
    sendYoutubeCommand('setVolume', [volume]);
    if (volume > 0) sendYoutubeCommand('unMute');
  };

  const duckBackgroundMusic = () => setYoutubeBackgroundVolume(12);

  const restoreBackgroundMusic = () => setYoutubeBackgroundVolume(65);

  const pauseBackgroundMusic = () => sendYoutubeCommand('pauseVideo');

  const playBackgroundMusic = () => sendYoutubeCommand('playVideo');

  const requestWakeLock = async () => {
    try {
      const wakeLock = (navigator as any).wakeLock;
      if (!wakeLock?.request) return false;
      wakeLockRef.current = await wakeLock.request('screen');
      wakeLockRef.current?.addEventListener?.('release', () => {
        wakeLockRef.current = null;
      });
      return true;
    } catch (error) {
      console.warn('Wake Lock is not available for tablet broadcast mode', error);
      return false;
    }
  };

  const releaseWakeLock = async () => {
    try {
      await wakeLockRef.current?.release?.();
    } catch (error) {
      console.warn('Failed to release Wake Lock', error);
    } finally {
      wakeLockRef.current = null;
    }
  };

  const toggleTabletMode = async () => {
    if (isTabletMode) {
      setIsTabletMode(false);
      await releaseWakeLock();
      return;
    }
    const locked = await requestWakeLock();
    if (!locked) {
      alert('Tablet/trình duyệt này không hỗ trợ giữ web chạy khi tắt màn hình. Hãy dùng chế độ màn hình luôn bật hoặc cài web như PWA/kiosk.');
    }
    setIsTabletMode(true);
    setIsRunning(true);
  };

  const commitDevice = (patch: Partial<InteractiveDeviceProfile>) => {
    if (!canEdit) return;
    const nextDevice: InteractiveDeviceProfile = {
      ...device,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    const exists = devices.some(item => item.id === nextDevice.id);
    onUpdateDevices(exists ? devices.map(item => item.id === nextDevice.id ? nextDevice : item) : [nextDevice, ...devices]);
  };

  const appendPlaybackLog = (entry: Omit<BroadcastPlaybackLog, 'id' | 'playedAt'>) => {
    const log: BroadcastPlaybackLog = {
      ...entry,
      id: makeId('bc-log'),
      playedAt: new Date().toISOString()
    };
    commitDevice({ playbackLogs: [log, ...(device.playbackLogs || [])].slice(0, 80) });
  };

  const getPreferredVoice = () => {
    const voices = availableVoices.length > 0
      ? availableVoices
      : ('speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);
    return voices.find(voice => voice.voiceURI === device.voiceURI) ||
      voices.find(voice => voice.lang.toLowerCase().startsWith('vi') && /female|woman|nữ|nu|linh|mai|hoai|an/i.test(voice.name)) ||
      voices.find(voice => voice.lang.toLowerCase().startsWith('vi')) ||
      voices[0];
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt này chưa hỗ trợ Voice AI miễn phí bằng Web Speech.');
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.volume = Math.min(1, Math.max(0, device.volume || 0.8));
      utterance.rate = 0.95;
      const preferredVoice = getPreferredVoice();
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang || 'vi-VN';
      }
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.speak(utterance);
    });
  };

  const playAudioUrl = (url: string) => {
    if (!audioRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const audio = audioRef.current;
      if (!audio) {
        resolve(false);
        return;
      }
      const cleanup = () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
      };
      const handleEnded = () => {
        cleanup();
        resolve(true);
      };
      const handleError = () => {
        cleanup();
        resolve(false);
      };

      audio.pause();
      audio.src = url;
      audio.volume = Math.min(1, Math.max(0, device.volume || 0.8));
      audio.addEventListener('ended', handleEnded, { once: true });
      audio.addEventListener('error', handleError, { once: true });
      void audio.play().catch(() => {
        cleanup();
        alert('Trình duyệt đã chặn phát tự động. Vui lòng bấm "Bật chế độ 24/24" một lần trên tablet.');
        resolve(false);
      });
    });
  };

  const playAnnouncement = async (announcement: PendingAnnouncement, manual = false) => {
    const source = manual ? 'MANUAL' : announcement.source;
    const text = announcement.text?.trim();
    const audioUrl = announcement.asset?.dataUrl || announcement.asset?.url;
    const preUrl = preAnnouncementAsset?.dataUrl || preAnnouncementAsset?.url;

    duckBackgroundMusic();
    try {
      if (preUrl) {
        await playAudioUrl(preUrl);
      }

      if (audioUrl) {
        await playAudioUrl(audioUrl);
      } else if (text) {
        await speakText(text);
      } else {
        return;
      }

      appendPlaybackLog({
        title: announcement.title,
        source,
        detail: announcement.detail || text || announcement.asset?.title
      });
    } finally {
      restoreBackgroundMusic();
    }
  };

  const playAsset = (asset: BroadcastAudioAsset) => {
    const audioUrl = asset.dataUrl || asset.url;
    if (audioUrl) {
      void playAudioUrl(audioUrl);
    } else if (asset.transcript) {
      speakText(asset.transcript);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const refreshVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
  }, []);

  useEffect(() => {
    if (!youtubeEmbed) return;
    if (broadcastState.shouldPlayBackground && isRunning) {
      playBackgroundMusic();
      restoreBackgroundMusic();
    } else {
      pauseBackgroundMusic();
    }
  }, [broadcastState.shouldPlayBackground, isRunning, youtubeEmbed]);

  useEffect(() => {
    if (!isTabletMode) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTabletMode]);

  useEffect(() => {
    return () => {
      void releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    if (!isRunning || !device.isAutomationEnabled) return;
    const dueWindowMs = 60 * 1000;
    const due = announcements
      .filter(item => item.time.getTime() <= now.getTime() && item.time.getTime() >= now.getTime() - dueWindowMs)
      .filter(item => !playedKeysRef.current.has(item.id))
      .sort((a, b) => b.priority - a.priority || a.time.getTime() - b.time.getTime())[0];

    if (!due) return;
    playedKeysRef.current.add(due.id);
    playAnnouncement(due);
  }, [announcements, device.isAutomationEnabled, isRunning, now]);

  const handleUpload = (file?: File | null) => {
    if (!file || !canEdit) return;
    if (!file.type.startsWith('audio/')) {
      alert('Vui lòng chọn file âm thanh phổ biến như mp3, wav, m4a.');
      return;
    }
    if (file.size > 700 * 1024) {
      alert('File này khá lớn để lưu trực tiếp vào Firestore. Vui lòng dùng file thông báo ngắn dưới 700KB hoặc dán URL âm thanh ngoài.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const asset: BroadcastAudioAsset = {
        id: makeId('bc-audio'),
        title: assetTitle.trim() || file.name.replace(/\.[^.]+$/, ''),
        source: 'UPLOAD',
        category: 'ANNOUNCEMENT',
        dataUrl: String(reader.result || ''),
        fileName: file.name,
        mimeType: file.type,
        createdAt: new Date().toISOString()
      };
      commitDevice({ audioAssets: [asset, ...(device.audioAssets || [])] });
      setAssetTitle('');
    };
    reader.readAsDataURL(file);
  };

  const addUrlAsset = () => {
    if (!assetUrl.trim()) return;
    const asset: BroadcastAudioAsset = {
      id: makeId('bc-audio'),
      title: assetTitle.trim() || 'Audio URL',
      source: 'URL',
      category: 'ANNOUNCEMENT',
      url: assetUrl.trim(),
      createdAt: new Date().toISOString()
    };
    commitDevice({ audioAssets: [asset, ...(device.audioAssets || [])] });
    setAssetTitle('');
    setAssetUrl('');
  };

  const addVoiceAsset = () => {
    if (!voiceText.trim()) return;
    const asset: BroadcastAudioAsset = {
      id: makeId('bc-voice'),
      title: voiceTitle.trim() || 'Voice AI thông báo',
      source: 'VOICE_AI',
      category: 'ANNOUNCEMENT',
      transcript: voiceText.trim(),
      createdAt: new Date().toISOString()
    };
    commitDevice({ audioAssets: [asset, ...(device.audioAssets || [])] });
    setVoiceTitle('Voice AI thông báo');
    setVoiceText('');
  };

  const addSchedule = () => {
    const hasAsset = selectedAssetId && selectedAssetId !== 'VOICE_ONLY';
    if (!scheduleText.trim() && !hasAsset) {
      alert('Vui lòng chọn file âm thanh hoặc nhập nội dung Voice AI.');
      return;
    }
    const schedule: BroadcastSchedule = {
      id: makeId('bc-schedule'),
      title: scheduleTitle.trim() || 'Thông báo mới',
      time: scheduleTime,
      enabled: true,
      assetId: hasAsset ? selectedAssetId : undefined,
      voiceText: scheduleText.trim() || undefined,
      priority: 10
    };
    commitDevice({ schedules: [...(device.schedules || []), schedule].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)) });
    setScheduleTitle('Thông báo mới');
    setScheduleText('');
    setSelectedAssetId('');
  };

  const removeAsset = (assetId: string) => {
    commitDevice({
      audioAssets: (device.audioAssets || []).filter(asset => asset.id !== assetId),
      preAnnouncementAssetId: device.preAnnouncementAssetId === assetId ? '' : device.preAnnouncementAssetId,
      schedules: (device.schedules || []).map(schedule => schedule.assetId === assetId ? { ...schedule, assetId: undefined } : schedule)
    });
  };

  const addYoutubeTrack = () => {
    const url = youtubeUrl.trim();
    if (!url) return;
    const track: BroadcastYoutubeTrack = {
      id: makeId('yt'),
      title: youtubeTitle.trim() || `Nhạc nền ${backgroundTracks.length + 1}`,
      url
    };
    const nextTracks = [...backgroundTracks.filter(trackItem => trackItem.id !== 'yt-legacy-fallback'), track];
    commitDevice({
      youtubePlaylist: nextTracks,
      youtubeFallbackUrl: nextTracks[0]?.url || '',
      backgroundTrackId: device.backgroundTrackId || track.id
    });
    setYoutubeTitle('');
    setYoutubeUrl('');
  };

  const removeYoutubeTrack = (trackId: string) => {
    const nextTracks = backgroundTracks.filter(track => track.id !== trackId && track.id !== 'yt-legacy-fallback');
    commitDevice({
      youtubePlaylist: nextTracks,
      youtubeFallbackUrl: nextTracks[0]?.url || '',
      backgroundTrackId: device.backgroundTrackId === trackId ? nextTracks[0]?.id || '' : device.backgroundTrackId
    });
  };

  const upsertEventMusicSetting = (eventId: string, patch: Partial<BroadcastEventMusicSetting>) => {
    const currentSettings = device.eventMusicSettings || [];
    const existing = currentSettings.find(setting => setting.eventId === eventId);
    const nextSetting: BroadcastEventMusicSetting = {
      eventId,
      enabled: true,
      mode: 'LOOP_ALL',
      trackIds: [],
      ...(existing || {}),
      ...patch
    };
    const nextSettings = existing
      ? currentSettings.map(setting => setting.eventId === eventId ? nextSetting : setting)
      : [...currentSettings, nextSetting];
    commitDevice({ eventMusicSettings: nextSettings });
  };

  const toggleEventTrack = (eventId: string, trackId: string, checked: boolean) => {
    const existing = (device.eventMusicSettings || []).find(setting => setting.eventId === eventId);
    const currentIds = new Set(existing?.trackIds || []);
    if (checked) currentIds.add(trackId); else currentIds.delete(trackId);
    upsertEventMusicSetting(eventId, { trackIds: Array.from(currentIds), enabled: currentIds.size > 0 });
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} className="hidden" />

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
              <Radio size={20} />
              <span>Thiết bị tương tác</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">{device.name}</h2>
            <p className="text-sm text-slate-500 mt-1">
              Phát thanh tự động tại {device.location || 'trung tâm'} • {todayEvents.length} sự kiện hôm nay • {nextAnnouncements.length} thông báo sắp tới
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsRunning(value => !value)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                isRunning ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRunning ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
              {isRunning ? 'Tạm dừng phát tự động' : 'Bật chế độ 24/24'}
            </button>
            <button
              onClick={() => commitDevice({ isAutomationEnabled: !device.isAutomationEnabled })}
              disabled={!canEdit}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold ${
                device.isAutomationEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'
              } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <BellRing size={17} />
              {device.isAutomationEnabled ? 'Automation đang bật' : 'Automation đang tắt'}
            </button>
            <button
              onClick={() => void toggleTabletMode()}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold ${
                isTabletMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Radio size={17} />
              {isTabletMode ? 'Đang chạy nền tablet' : 'Chế độ tablet 24/24'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-4 mt-4">
          <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <CalendarClock size={18} className="text-blue-600" />
                Hàng đợi hôm nay
              </div>
              <span className="text-xs font-semibold text-slate-500">{formatTime(now)}</span>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {nextAnnouncements.length === 0 && (
                <p className="text-sm text-slate-500 py-6 text-center">Chưa có thông báo sắp tới trong hôm nay.</p>
              )}
              {nextAnnouncements.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="w-14 shrink-0 text-sm font-bold text-slate-700">{formatTime(item.time)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 truncate">{item.detail || item.text || item.asset?.title}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${item.source === 'EVENT' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                    {item.source === 'EVENT' ? 'Sự kiện' : 'Cố định'}
                  </span>
                  <button
                    onClick={() => playAnnouncement(item, true)}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Phát thử"
                  >
                    <PlayCircle size={17} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center gap-2 font-bold text-slate-800">
              <Music2 size={18} className="text-emerald-600" />
              Nhạc nền YouTube
            </div>
            {youtubeEmbed ? (
              <iframe
                ref={youtubeIframeRef}
                title="YouTube fallback playlist"
                src={youtubeEmbed}
                className="w-full aspect-video bg-slate-100"
                allow="autoplay; encrypted-media"
                onLoad={() => restoreBackgroundMusic()}
              />
            ) : (
              <div className="aspect-video bg-slate-100 flex items-center justify-center text-sm text-slate-500">Chưa có playlist</div>
            )}
            <div className="p-3 space-y-2">
              <div className={`text-xs font-bold px-3 py-2 rounded-lg ${
                broadcastState.shouldPlayBackground ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {broadcastState.label}
              </div>
              <label className="text-xs font-bold text-slate-500 uppercase">Chế độ phát nền</label>
              <select
                value={device.backgroundMode || 'LOOP_ALL'}
                onChange={e => commitDevice({ backgroundMode: e.target.value as InteractiveDeviceProfile['backgroundMode'] })}
                disabled={!canEdit}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="SINGLE">Chỉ phát 1 video đang chọn</option>
                <option value="LOOP_ALL">Phát liên tục, lặp lại toàn bộ playlist</option>
              </select>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={youtubeTitle}
                  onChange={e => setYoutubeTitle(e.target.value)}
                  disabled={!canEdit}
                  className="min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Tên video/playlist"
                />
                <button
                  onClick={addYoutubeTrack}
                  disabled={!canEdit || !youtubeUrl.trim()}
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50"
                  title="Thêm link"
                >
                  <Plus size={17} />
                </button>
              </div>
              <input
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                disabled={!canEdit}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {backgroundTracks.map(track => (
                  <div key={track.id} className="border border-slate-200 rounded-lg p-2 flex items-center gap-2">
                    <button
                      onClick={() => commitDevice({ backgroundTrackId: track.id, backgroundMode: 'SINGLE' })}
                      disabled={!canEdit}
                      className={`p-1.5 rounded-lg border ${
                        activeBackgroundTrack?.id === track.id ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'
                      }`}
                      title="Chọn làm video phát đơn"
                    >
                      <PlayCircle size={15} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{track.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{track.url}</p>
                    </div>
                    <button
                      onClick={() => removeYoutubeTrack(track.id)}
                      disabled={!canEdit || track.id === 'yt-legacy-fallback'}
                      className="p-1.5 rounded-lg text-rose-600 disabled:opacity-30"
                      title="Xóa link"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">Có thể thêm 4-5 link video. Nhạc nền tự dừng khi trung tâm nghỉ trưa, ngoài giờ hoạt động, hoặc theo giờ nghỉ trưa của đoàn trong timeline sự kiện.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-[1fr_420px] gap-4">
        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><FileAudio size={18} className="text-blue-600" /> Thư viện âm thanh</h3>
              <p className="text-xs text-slate-500 mt-1">Upload MP3 ngắn, dán URL audio hoặc tạo thông báo bằng Voice AI miễn phí của trình duyệt.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Volume2 size={17} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={device.volume ?? 0.8}
                onChange={e => commitDevice({ volume: Number(e.target.value) })}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <BellRing size={17} />
                Âm báo trước mỗi thông báo
              </label>
              <select
                value={device.preAnnouncementAssetId || ''}
                onChange={e => commitDevice({ preAnnouncementAssetId: e.target.value })}
                disabled={!canEdit}
                className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Không dùng âm báo trước</option>
                {(device.audioAssets || []).map(asset => <option key={asset.id} value={asset.id}>{asset.title}</option>)}
              </select>
              <p className="text-xs text-amber-700">
                Upload đoạn sound ngắn kiểu sân bay vào thư viện, rồi chọn tại đây. Hệ thống sẽ phát sound này trước lịch cố định và thông báo sự kiện.
              </p>
            </div>

            <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-blue-800">
                <Mic2 size={17} />
                Giọng Voice AI
              </label>
              <select
                value={device.voiceURI || ''}
                onChange={e => commitDevice({ voiceURI: e.target.value })}
                disabled={!canEdit || sortedVoices.length === 0}
                className="w-full border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tự chọn giọng tiếng Việt</option>
                {sortedVoices.map(voice => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang}){voice.default ? ' - mặc định' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-blue-700">
                Danh sách giọng phụ thuộc tablet/trình duyệt. Nếu có giọng nữ tiếng Việt, chọn trực tiếp ở đây.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-800"><Upload size={16} /> Upload audio</div>
              <input value={assetTitle} onChange={e => setAssetTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Tên âm thanh" disabled={!canEdit} />
              <label className={`flex items-center justify-center gap-2 border border-dashed rounded-lg px-3 py-5 text-sm font-semibold ${canEdit ? 'cursor-pointer hover:bg-slate-50 text-slate-600' : 'opacity-60 cursor-not-allowed text-slate-400'}`}>
                <Upload size={18} />
                Chọn MP3/WAV
                <input type="file" accept="audio/*" className="hidden" onChange={e => handleUpload(e.target.files?.[0])} disabled={!canEdit} />
              </label>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-800"><Link size={16} /> Audio URL</div>
              <input value={assetTitle} onChange={e => setAssetTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Tên âm thanh" disabled={!canEdit} />
              <input value={assetUrl} onChange={e => setAssetUrl(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="https://...mp3" disabled={!canEdit} />
              <button onClick={addUrlAsset} disabled={!canEdit} className="w-full inline-flex justify-center items-center gap-2 bg-slate-900 text-white rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50">
                <Plus size={16} /> Thêm URL
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-800"><Wand2 size={16} /> Voice AI miễn phí</div>
              <input value={voiceTitle} onChange={e => setVoiceTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Tên voice" disabled={!canEdit} />
              <textarea value={voiceText} onChange={e => setVoiceText(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[76px]" placeholder="Nội dung cần đọc..." disabled={!canEdit} />
              <button onClick={addVoiceAsset} disabled={!canEdit} className="w-full inline-flex justify-center items-center gap-2 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50">
                <Mic2 size={16} /> Tạo voice
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {(device.audioAssets || []).map(asset => (
              <div key={asset.id} className="border border-slate-200 rounded-lg p-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  {asset.source === 'VOICE_AI' ? <Mic2 size={18} /> : <Headphones size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 truncate">{asset.title}</p>
                  <p className="text-xs text-slate-500 truncate">{asset.fileName || asset.url || asset.transcript || asset.source}</p>
                </div>
                <button onClick={() => playAsset(asset)} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Phát thử">
                  <PlayCircle size={17} />
                </button>
                <button
                  onClick={() => commitDevice({ preAnnouncementAssetId: asset.id })}
                  disabled={!canEdit}
                  className={`p-2 rounded-lg border border-slate-200 hover:bg-amber-50 disabled:opacity-40 ${
                    device.preAnnouncementAssetId === asset.id ? 'text-amber-700 bg-amber-50' : 'text-slate-600'
                  }`}
                  title="Đặt làm âm báo trước"
                >
                  <BellRing size={17} />
                </button>
                <button onClick={() => removeAsset(asset.id)} disabled={!canEdit} className="p-2 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40" title="Xóa">
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            {(device.audioAssets || []).length === 0 && (
              <div className="md:col-span-2 border border-dashed border-slate-200 rounded-lg py-8 text-center text-sm text-slate-500">
                Chưa có file âm thanh. Có thể dùng Voice AI trực tiếp trong lịch phát.
              </div>
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><CalendarClock size={18} className="text-emerald-600" /> Lịch phát cố định</h3>
            <p className="text-xs text-slate-500 mt-1">Dùng cho nghỉ trưa, đóng cửa, chào đầu ngày, kết thúc ca.</p>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-[1fr_112px] gap-2">
              <input value={scheduleTitle} onChange={e => setScheduleTitle(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Tên lịch" disabled={!canEdit} />
              <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" disabled={!canEdit} />
            </div>
            <select value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" disabled={!canEdit}>
              <option value="">Đọc bằng Voice AI</option>
              {(device.audioAssets || []).map(asset => <option key={asset.id} value={asset.id}>{asset.title}</option>)}
            </select>
            <textarea value={scheduleText} onChange={e => setScheduleText(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[82px]" placeholder="Nội dung Voice AI nếu không chọn file..." disabled={!canEdit} />
            <button onClick={addSchedule} disabled={!canEdit} className="w-full inline-flex justify-center items-center gap-2 bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50">
              <Plus size={16} /> Thêm lịch phát
            </button>
          </div>

          <div className="space-y-2">
            {(device.schedules || []).map(schedule => (
              <div key={schedule.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 text-sm font-bold text-slate-800">{schedule.time}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{schedule.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {(device.audioAssets || []).find(asset => asset.id === schedule.assetId)?.title || schedule.voiceText || 'Chưa có nội dung'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={e => commitDevice({ schedules: (device.schedules || []).map(item => item.id === schedule.id ? { ...item, enabled: e.target.checked } : item) })}
                    disabled={!canEdit}
                    className="mt-1"
                  />
                  <button
                    onClick={() => commitDevice({ schedules: (device.schedules || []).filter(item => item.id !== schedule.id) })}
                    disabled={!canEdit}
                    className="p-1.5 text-rose-600 disabled:opacity-40"
                    title="Xóa lịch"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><BellRing size={18} className="text-amber-600" /> Rule theo sự kiện</h3>
          <p className="text-xs text-slate-500 mt-1">Nếu hôm nay có sự kiện và có timeline Einstein House OS, hệ thống tự phát thông báo đoàn.</p>
          <div className="mt-3 border border-blue-100 bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 font-bold text-sm text-blue-800">
              <Music2 size={17} />
              Nhạc nền theo đoàn hôm nay
            </div>
            <p className="text-xs text-blue-700 mt-1">Chọn nhạc riêng cho từng đoàn từ danh sách link YouTube nền đã thêm.</p>
            <div className="mt-3 space-y-3">
              {todayEvents.length === 0 && (
                <div className="bg-white/70 border border-blue-100 rounded-lg px-3 py-4 text-sm text-blue-700 text-center">
                  Hôm nay chưa có đoàn/sự kiện để gán nhạc riêng.
                </div>
              )}
              {todayEvents.map(event => {
                const setting = (device.eventMusicSettings || []).find(item => item.eventId === event.id);
                const selectedIds = new Set(setting?.trackIds || []);
                const enabled = setting?.enabled && selectedIds.size > 0;
                return (
                  <div key={event.id} className="bg-white border border-blue-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!!enabled}
                        onChange={e => {
                          const firstTrackId = backgroundTracks[0]?.id;
                          upsertEventMusicSetting(event.id, {
                            enabled: e.target.checked,
                            trackIds: e.target.checked && selectedIds.size === 0 && firstTrackId ? [firstTrackId] : Array.from(selectedIds)
                          });
                        }}
                        disabled={!canEdit || backgroundTracks.length === 0}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{event.name}</p>
                        <p className="text-xs text-slate-500 truncate">{event.client || event.eventProfile?.organization || 'Đoàn trải nghiệm'} • {formatDate(getEventDateKeys(event)[0])}</p>
                      </div>
                      <select
                        value={setting?.mode || 'LOOP_ALL'}
                        onChange={e => upsertEventMusicSetting(event.id, { mode: e.target.value as BroadcastEventMusicSetting['mode'] })}
                        disabled={!canEdit}
                        className="border border-blue-100 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        <option value="SINGLE">1 bài</option>
                        <option value="LOOP_ALL">Lặp playlist</option>
                      </select>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {backgroundTracks.map(track => (
                        <label key={track.id} className="flex items-center gap-2 text-xs text-slate-700 border border-slate-100 rounded-lg px-2 py-2">
                          <input
                            type={setting?.mode === 'SINGLE' ? 'radio' : 'checkbox'}
                            name={`event-music-${event.id}`}
                            checked={selectedIds.has(track.id)}
                            onChange={e => {
                              if (setting?.mode === 'SINGLE') {
                                upsertEventMusicSetting(event.id, { enabled: true, trackIds: [track.id] });
                              } else {
                                toggleEventTrack(event.id, track.id, e.target.checked);
                              }
                            }}
                            disabled={!canEdit}
                          />
                          <span className="truncate">{track.title}</span>
                        </label>
                      ))}
                    </div>
                    {backgroundTracks.length === 0 && (
                      <p className="text-xs text-blue-700">Chưa có link YouTube nền. Thêm link ở khung Nhạc nền YouTube trước.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {(device.eventRules || []).map(rule => (
              <div key={rule.id} className="border border-slate-200 rounded-lg p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={e => commitDevice({ eventRules: (device.eventRules || []).map(item => item.id === rule.id ? { ...item, enabled: e.target.checked } : item) })}
                  disabled={!canEdit}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{rule.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{rule.trigger}{rule.blockKind ? ` • ${rule.blockKind}` : ''} • offset {rule.offsetMinutes} phút</p>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{rule.messageTemplate}</p>
                  <div className="mt-2 grid sm:grid-cols-[150px_1fr] gap-2 items-center">
                    <span className="text-xs font-bold text-slate-500">Âm thanh thông báo</span>
                    <select
                      value={rule.assetId || ''}
                      onChange={e => commitDevice({
                        eventRules: (device.eventRules || []).map(item =>
                          item.id === rule.id ? { ...item, assetId: e.target.value || undefined } : item
                        )
                      })}
                      disabled={!canEdit}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-white"
                    >
                      <option value="">Dùng Voice AI từ nội dung mẫu</option>
                      {(device.audioAssets || []).map(asset => (
                        <option key={asset.id} value={asset.id}>{asset.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><Radio size={18} className="text-blue-600" /> Nhật ký phát gần đây</h3>
          <div className="mt-3 divide-y divide-slate-100">
            {(device.playbackLogs || []).slice(0, 10).map(log => (
              <div key={log.id} className="py-3 flex gap-3">
                <div className="w-14 text-xs font-bold text-slate-500">{formatTime(new Date(log.playedAt))}</div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{log.title}</p>
                  <p className="text-xs text-slate-500 truncate">{log.source} • {log.detail}</p>
                </div>
              </div>
            ))}
            {(device.playbackLogs || []).length === 0 && (
              <p className="text-sm text-slate-500 py-8 text-center">Chưa có lượt phát nào trong phiên vận hành.</p>
            )}
          </div>
        </section>
      </div>

      {isTabletMode && (
        <button
          onClick={() => void toggleTabletMode()}
          className="fixed inset-0 z-[120] bg-black text-slate-500 flex flex-col items-center justify-center gap-3"
          title="Chạm để thoát chế độ tablet"
        >
          <Radio size={34} className="text-slate-700" />
          <span className="text-xs font-semibold tracking-wide uppercase">Broadcast mode</span>
          <span className="text-[11px] text-slate-700">Chạm màn hình để quay lại điều khiển</span>
        </button>
      )}
    </div>
  );
};
