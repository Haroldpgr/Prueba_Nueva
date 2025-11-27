// src/renderer/components/NotificationContainer.tsx

import React, { useState, useEffect } from 'react';
import NotificationToast from './NotificationToast';
import { notificationService, Notification } from '../services/notificationService';

const NotificationContainer: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe(setNotifications);
    return unsubscribe;
  }, []);

  return (
    <div 
      className="fixed top-4 right-4 z-50 flex flex-col items-end pointer-events-none"
      style={{ maxWidth: 'calc(100% - 2rem)' }}
    >
      {notifications.map(notification => (
        <div key={notification.id} className="pointer-events-auto mb-2">
          <NotificationToast notification={notification} />
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;