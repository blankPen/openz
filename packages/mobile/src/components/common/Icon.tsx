import Svg, { Circle, Line, Path, Polyline, Polygon, Rect } from 'react-native-svg';

export type IconName =
  | 'burger' | 'arrowDown' | 'voice' | 'phone' | 'plus' | 'arrowUp'
  | 'mic' | 'sun' | 'image' | 'doc' | 'camera' | 'quote' | 'close'
  | 'check' | 'chevDown' | 'chevUp' | 'send' | 'copy' | 'like' | 'regenerate' | 'share'
  | 'flash' | 'cube' | 'globe' | 'web' | 'lawyer' | 'fire' | 'phd'
  | 'help' | 'info' | 'sparkles' | 'bell' | 'gear' | 'logout' | 'textSize' | 'lang'
  | 'menu' | 'model' | 'search' | 'file' | 'star' | 'chart'
  | 'robot' | 'spark' | 'pptGrid' | 'chartEkg' | 'globe2'
  | 'history' | 'trash';

type Props = { name: IconName; size?: number; color: string; testID?: string; style?: object };

export function Icon({ name, size = 22, color, testID, style }: Props) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, testID, style };
  switch (name) {
    case 'burger': return <Svg {...props}><Line x1={4} y1={7} x2={20} y2={7} /><Line x1={4} y1={12} x2={20} y2={12} /><Line x1={4} y1={17} x2={20} y2={17} /></Svg>;
    case 'arrowDown': return <Svg {...props}><Polyline points="6 9 12 15 18 9" /></Svg>;
    case 'arrowUp': return <Svg {...props}><Line x1={12} y1={19} x2={12} y2={5} /><Polyline points="6 11 12 5 18 11" /></Svg>;
    case 'voice': return <Svg {...props}><Polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill={color} stroke="none" /><Path d="M15.54 8.46a5 5 0 010 7.07" /><Path d="M19.07 4.93a10 10 0 010 14.14" /></Svg>;
    case 'phone': return <Svg {...props}><Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></Svg>;
    case 'plus': return <Svg {...props}><Line x1={12} y1={5} x2={12} y2={19} /><Line x1={5} y1={12} x2={19} y2={12} /></Svg>;
    case 'mic': return <Svg {...props} strokeWidth={2.4}><Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><Path d="M19 10v2a7 7 0 01-14 0v-2" /><Line x1={12} y1={19} x2={12} y2={23} /><Line x1={8} y1={23} x2={16} y2={23} /></Svg>;
    case 'send': return <Svg {...props} strokeWidth={2.4}><Line x1={12} y1={19} x2={12} y2={5} /><Polyline points="6 11 12 5 18 11" /></Svg>;
    case 'sun': return <Svg {...props} strokeWidth={1.8}><Circle cx={12} cy={12} r={4} /><Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Svg>;
    case 'image': return <Svg {...props} strokeWidth={1.8}><Rect x={3} y={3} width={18} height={18} rx={2} /><Circle cx={8.5} cy={8.5} r={1.5} /><Polyline points="21 15 16 10 5 21" /></Svg>;
    case 'doc': return <Svg {...props} strokeWidth={1.8}><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Polyline points="14 2 14 8 20 8" /><Line x1={9} y1={15} x2={15} y2={15} /></Svg>;
    case 'camera': return <Svg {...props} strokeWidth={1.8}><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx={12} cy={13} r={4} /></Svg>;
    case 'quote': return <Svg {...props} strokeWidth={2.5}><Polyline points="9 17 4 12 9 7" /><Path d="M20 18v-2a4 4 0 00-4-4H4" /></Svg>;
    case 'close': return <Svg {...props} strokeWidth={2.5}><Line x1={6} y1={6} x2={18} y2={18} /><Line x1={18} y1={6} x2={6} y2={18} /></Svg>;
    case 'check': return <Svg {...props} strokeWidth={2.5}><Polyline points="20 6 9 17 4 12" /></Svg>;
    case 'chevDown': return <Svg {...props} strokeWidth={2}><Polyline points="6 9 12 15 18 9" /></Svg>;
    case 'copy': return <Svg {...props}><Rect x={9} y={9} width={13} height={13} rx={2} /><Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></Svg>;
    case 'like': return <Svg {...props} fill={color} stroke="none"><Path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></Svg>;
    case 'regenerate': return <Svg {...props}><Path d="M23 4v6h-6" /><Path d="M20.49 15A9 9 0 1118 5.3L23 10" /></Svg>;
    case 'share': return <Svg {...props}><Circle cx={18} cy={5} r={3} /><Circle cx={6} cy={12} r={3} /><Circle cx={18} cy={19} r={3} /><Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} /><Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} /></Svg>;
    case 'flash': return <Svg {...props} fill={color} stroke="none"><Path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></Svg>;
    case 'cube': return <Svg {...props}><Path d="M12 2L2 7l10 5 10-5-10-5z" /><Path d="M2 17l10 5 10-5" /><Path d="M2 12l10 5 10-5" /></Svg>;
    case 'globe': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Line x1={2} y1={12} x2={22} y2={12} /><Path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></Svg>;
    case 'web': return <Svg {...props} strokeWidth={2}><Circle cx={12} cy={12} r={10} /><Line x1={2} y1={12} x2={22} y2={12} /></Svg>;
    case 'lawyer': return <Svg {...props}><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Polyline points="14 2 14 8 20 8" /></Svg>;
    case 'fire': return <Svg {...props} strokeWidth={2}><Path d="M12 2c0 4-4 5-4 9a4 4 0 008 0c0-2-1-3-1-5 1 1 3 2 3 5a6 6 0 11-12 0c0-5 5-7 6-9z" /></Svg>;
    case 'phd': return <Svg {...props}><Path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>;
    case 'help': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><Line x1={12} y1={17} x2={12.01} y2={17} /></Svg>;
    case 'info': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Line x1={12} y1={16} x2={12} y2={12} /><Line x1={12} y1={8} x2={12.01} y2={8} /></Svg>;
    case 'chevUp': return <Svg {...props}><Polyline points="6 15 12 9 18 15" /></Svg>;
    case 'menu': return <Svg {...props}><Line x1={3} y1={6} x2={21} y2={6} /><Line x1={3} y1={12} x2={21} y2={12} /><Line x1={3} y1={18} x2={21} y2={18} /></Svg>;
    case 'model': return <Svg {...props}><Rect x={3} y={3} width={8} height={8} rx={1} /><Rect x={8} y={8} width={8} height={8} rx={1} /><Rect x={13} y={13} width={8} height={8} rx={1} /></Svg>;
    case 'search': return <Svg {...props}><Circle cx={11} cy={11} r={6} /><Line x1={21} y1={21} x2={16.65} y2={16.65} /></Svg>;
    case 'file': return <Svg {...props}><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Polyline points="14 2 14 8 20 8" /><Line x1={9} y1={15} x2={15} y2={15} /></Svg>;
    case 'star': return <Svg {...props} fill={color} stroke="none"><Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Svg>;
    case 'chart': return <Svg {...props}><Line x1={18} y1={20} x2={18} y2={10} /><Line x1={12} y1={20} x2={12} y2={4} /><Line x1={6} y1={20} x2={6} y2={14} /></Svg>;
    case 'sparkles': return <Svg {...props} fill={color} stroke="none"><Path d="M12 2L9 9H2l5.5 4.5L5 21l7-4.5L19 21l-2.5-7.5L22 9h-7z" /></Svg>;
    case 'bell': return <Svg {...props}><Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 01-3.46 0" /></Svg>;
    case 'gear': return <Svg {...props}><Circle cx={12} cy={12} r={3} /><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></Svg>;
    case 'logout': return <Svg {...props}><Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><Polyline points="16 17 21 12 16 7" /><Line x1={21} y1={12} x2={9} y2={12} /></Svg>;
    case 'textSize': return <Svg {...props}><Path d="M4 7V4h16v3" /><Path d="M9 20h6" /><Path d="M12 4v16" /></Svg>;
    case 'lang': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Line x1={2} y1={12} x2={22} y2={12} /><Path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></Svg>;
    // Robot face —— 设计稿 settings.html "默认模型" 菜单项
    case 'robot': return <Svg {...props}><Rect x={5} y={8} width={14} height={11} rx={2} /><Circle cx={9} cy={13} r={1.2} /><Circle cx={15} cy={13} r={1.2} /><Path d="M12 4v4" /><Circle cx={12} cy={3} r={1.2} /></Svg>;
    // Sun rays + center circle —— 设计稿 home.html "通用 Agent" 工具图标
    case 'spark': return <Svg {...props} strokeWidth={1.8}><Circle cx={12} cy={12} r={3} /><Path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m7.07 7.07l4.25 4.25M1 12h6m6 0h6M4.22 19.78l4.24-4.24m7.07-7.07l4.25-4.25" /></Svg>;
    // 4-cell grid (PPT slide) —— 设计稿 home.html "一键 PPT"
    case 'pptGrid': return <Svg {...props} strokeWidth={1.8}><Rect x={3} y={3} width={18} height={18} rx={2} /><Line x1={3} y1={9} x2={21} y2={9} /><Line x1={9} y1={3} x2={9} y2={21} /></Svg>;
    // EKG / heart-rate line —— 设计稿 home.html "健康助手"
    case 'chartEkg': return <Svg {...props}><Path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>;
    // Globe with longitude/latitude —— fallback for agent
    case 'globe2': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Line x1={2} y1={12} x2={22} y2={12} /><Path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></Svg>;
    // Clock / history icon for history sessions list
    case 'history': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Polyline points="12 6 12 12 16 14" /></Svg>;
    // Trash icon for delete session
    case 'trash': return <Svg {...props}><Polyline points="3 6 5 6 21 6" /><Path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></Svg>;
  }
}
