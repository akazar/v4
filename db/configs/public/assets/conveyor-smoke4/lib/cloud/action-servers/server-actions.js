export const serverActions = {
    'NOTIFY': function(eventData, actionValue) {
        console.log('[server-actions] Notifying', 'recognition:', eventData, 'config value:', actionValue);
    },
    'API': function(eventData, actionValue) {
        console.log('[server-actions] Calling API', 'recognition:', eventData, 'config value:', actionValue);
    },
    'DB': function(eventData, actionValue) {
        console.log('[server-actions] Writing to DB', 'recognition:', eventData, 'config value:', actionValue);
    },
    'server-007': function(eventData, actionValue) {
        console.log('[server-actions] Running 007 action', 'recognition:', eventData, 'config value:', actionValue);
    }
};