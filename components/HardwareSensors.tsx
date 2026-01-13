import React from 'react';
import { SensorData, DeviceType } from '../types';

interface HardwareSensorsProps {
  data: SensorData;
  deviceType: DeviceType;
  themeColor: string;
}

const HardwareSensors: React.FC<HardwareSensorsProps> = ({ data, deviceType, themeColor }) => {
  const isCompact = deviceType === 'mobile' || deviceType === 'wear';

  return (
    <div className={`flex items-center ${isCompact ? 'gap-2 px-3 py-1.5' : 'gap-4 px-4 py-2'} bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md`}>
      <div className="flex items-center gap-2 group cursor-help" title={`Platform: ${data.platform}`}>
        <i 
          className={`fas ${deviceType === 'mobile' ? 'fa-mobile-screen' : deviceType === 'wear' ? 'fa-watch' : deviceType === 'tv' ? 'fa-tv' : deviceType === 'auto' ? 'fa-car' : 'fa-desktop'} text-[10px]`}
          style={{ color: themeColor }}
        ></i>
        {!isCompact && <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">{deviceType}</span>}
      </div>
      
      <div className="w-[1px] h-3 bg-white/10"></div>
      
      <div className="flex items-center gap-2">
        <i className={`fas ${data.online ? 'fa-wifi' : 'fa-plane'} text-[10px] ${data.online ? 'text-emerald-500' : 'text-red-500'}`}></i>
        {!isCompact && <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{data.online ? 'Online' : 'Offline'}</span>}
      </div>

      {data.battery !== undefined && (
        <>
          <div className="w-[1px] h-3 bg-white/10"></div>
          <div className="flex items-center gap-2">
            <i className={`fas ${data.charging ? 'fa-battery-bolt' : 'fa-battery-three-quarters'} text-[10px] ${data.battery < 0.2 ? 'text-red-500' : 'text-emerald-500'}`}></i>
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{Math.round(data.battery * 100)}%</span>
          </div>
        </>
      )}

      {data.location && !isCompact && (
        <>
          <div className="w-[1px] h-3 bg-white/10"></div>
          <div className="flex items-center gap-2">
            <i className="fas fa-location-crosshairs text-[10px] text-blue-400 animate-pulse"></i>
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">GPS_LOCK</span>
          </div>
        </>
      )}
    </div>
  );
};

export default HardwareSensors;