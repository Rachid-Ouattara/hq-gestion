import { get, post, del } from './api.js';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error("Ce navigateur ne prend pas en charge les notifications push.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorisation refusée.');

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await get('/notifications/vapid-public-key');
  if (!publicKey) throw new Error('Notifications push non configurées côté serveur.');

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const json = subscription.toJSON();
  await post('/notifications/push-subscription', { endpoint: json.endpoint, keys: json.keys });
  return subscription;
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await del('/notifications/push-subscription', { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe();
}
