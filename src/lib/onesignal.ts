
'use server';
import * as OneSignal from '@onesignal/node-onesignal';

const ONESIGNAL_APP_ID = '3c3eb6bb-f00e-4516-a7e6-965a538548f8';
// IMPORTANT: Replace with your OneSignal REST API Key
const ONESIGNAL_API_KEY = 'MzExYjliYTktNDBjYi00YjVjLWFkMjgtYmE2YjVlNWZkZjE5';

const client = new OneSignal.DefaultApi({
    appId: ONESIGNAL_APP_ID,
    token: ONESIGNAL_API_KEY,
});

interface SendPushNotificationParams {
    headings: { en: string; id?: string };
    contents: { en: string; id?: string };
    userIds: string[];
}

export async function sendPushNotification({ headings, contents, userIds }: SendPushNotificationParams) {
  if (!userIds || userIds.length === 0) {
    return { success: false, message: 'No recipients specified.' };
  }

  const notification = new OneSignal.Notification();
  notification.app_id = ONESIGNAL_APP_ID;
  notification.headings = headings;
  notification.contents = contents;
  notification.include_external_user_ids = userIds;

  try {
    const response = await client.createNotification(notification);
    return { success: true, message: 'Push notification sent.', response };
  } catch (error: any) {
    console.error('OneSignal Error:', error);
    return { success: false, message: error.body?.errors.join(', ') || 'Failed to send push notification.' };
  }
}
