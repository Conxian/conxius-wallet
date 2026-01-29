
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService } from '../services/notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    requestPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
    schedule: vi.fn(() => Promise.resolve())
  }
}));

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock isNative to true for testing OS notifications
    (global as any).window = {
        Capacitor: {
            isNativePlatform: () => true
        }
    };
  });

  it('requests permissions correctly', async () => {
    const result = await notificationService.requestPermissions();
    expect(result).toBe(true);
    expect(LocalNotifications.requestPermissions).toHaveBeenCalled();
  });

  it('notifies correctly and returns an event object', async () => {
    const eventData = {
      category: 'SYSTEM' as const,
      type: 'info' as const,
      title: 'Test Title',
      message: 'Test Message'
    };

    const event = await notificationService.notify(eventData);

    expect(event.title).toBe(eventData.title);
    expect(event.message).toBe(eventData.message);
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(LocalNotifications.schedule).toHaveBeenCalled();
  });

  it('handles security notifications specifically', async () => {
    await notificationService.notifySecurity('Security Alert', 'Unauthorized access detected');
    expect(LocalNotifications.schedule).toHaveBeenCalledWith(expect.objectContaining({
      notifications: expect.arrayContaining([
        expect.objectContaining({
          title: 'Security Alert',
          body: 'Unauthorized access detected'
        })
      ])
    }));
  });
});
