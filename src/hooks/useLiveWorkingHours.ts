import { useState, useEffect } from 'react';
import { AttendanceRecord } from '@/types';

export function useLiveWorkingHours(todayRecord: AttendanceRecord | null): string {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (todayRecord?.checkIn && !todayRecord?.checkOut) {
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [todayRecord]);

  if (!todayRecord) return "--";
  if (!todayRecord.checkOut) {
    if (!todayRecord.checkIn?.timestamp) return "In Progress";
    const checkInMs = new Date(todayRecord.checkIn.timestamp).getTime();
    const diffMs = currentTime.getTime() - checkInMs;
    
    if (diffMs < 0) return "00:00:00"; 
    
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${todayRecord.workingHours} hrs`;
}
