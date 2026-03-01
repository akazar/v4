async function sendNotification(recognitionResults, channel, recipient) {
  console.log('[notification] Sending notification: ', recognitionResults, channel, recipient);
  return {
    success: true,
    data: {
      message: 'Notification sent',
    },
  };
}

export { sendNotification };