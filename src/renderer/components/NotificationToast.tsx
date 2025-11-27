// src/renderer/components/NotificationToast.tsx

import React, { useState, useEffect } from 'react';
import { notificationService, Notification } from '../services/notificationService';

interface NotificationToastProps {
  notification: Notification;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animation entrance
    setIsVisible(true);
  }, []);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      notification.onDismiss?.();
    }, 300);
  };

  const getNotificationStyle = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-gradient-to-r from-green-600 to-emerald-600 border-green-500';
      case 'error':
        return 'bg-gradient-to-r from-red-600 to-rose-600 border-red-500';
      case 'warning':
        return 'bg-gradient-to-r from-amber-600 to-orange-600 border-amber-500';
      default:
        return 'bg-gradient-to-r from-blue-600 to-primary border-blue-500';
    }
  };

  return (
    <div
      className={`relative mb-3 p-4 rounded-xl border shadow-lg transform transition-all duration-300 ${
        isLeaving ? 'translate-x-full opacity-0' : ''
      } ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      style={{ minWidth: '320px', maxWidth: '400px' }}
    >
      {/* Background with gradient */}
      <div className={`absolute inset-0 rounded-xl -z-10 ${getNotificationStyle()}`}></div>
      
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            {/* Icon based on type */}
            <div className="mr-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'warning' && (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            
            <div className="flex-1">
              <h4 className="font-bold text-white text-sm">{notification.title}</h4>
              <p className="text-white/90 text-sm mt-1">{notification.message}</p>
              
              {/* Progress bar for downloads */}
              {notification.showProgress !== undefined && notification.showProgress && notification.progress !== undefined && (
                <div className="mt-2">
                  <div className="w-full bg-black/20 rounded-full h-2">
                    <div
                      className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${notification.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-white/80 text-xs mt-1 text-right">
                    {Math.round(notification.progress)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="ml-2 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;