
import { LocalNotifications } from '@capacitor/local-notifications';
import { ToastType } from '../components/Toast';

export type WalletEventCategory = 'SECURITY' | 'TRANSACTION' | 'SYSTEM';

export interface WalletEvent {
  id: string;
  category: WalletEventCategory;
  type: ToastType;
  title: string;
  message: string;
  timestamp: number;
}

class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  private get isNative(): boolean {
    return typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    if (!this.isNative) return true;
    try {
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch (e) {
      console.warn("LocalNotifications permission request failed:", e);
      return false;
    }
  }

  async notify(event: Omit<WalletEvent, 'id' | 'timestamp'>) {
    const id = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    const timestamp = Date.now();

    // OS-level notification
    if (this.isNative) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: event.title,
              body: event.message,
              id: id,
              schedule: { at: new Date(Date.now() + 100) }, // Nearly immediate
              sound: 'default',
              attachments: [],
              actionTypeId: '',
              extra: null
            }
          ]
        });
      } catch (e) {
        console.error("Failed to schedule local notification:", e);
      }
    }

    return { ...event, id: id.toString(), timestamp };
  }

  async notifySecurity(title: string, message: string) {
    return this.notify({
      category: 'SECURITY',
      type: 'warning',
      title,
      message
    });
  }

  async notifyTransaction(title: string, message: string, success: boolean = true) {
    return this.notify({
      category: 'TRANSACTION',
      type: success ? 'success' : 'error',
      title,
      message
    });
  }

  async notifySystem(title: string, message: string) {
    return this.notify({
      category: 'SYSTEM',
      type: 'info',
      title,
      message
    });
  }
}

export const notificationService = NotificationService.getInstance();
