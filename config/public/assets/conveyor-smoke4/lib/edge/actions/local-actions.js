export const localActions = {
    'NOTIFY': function(eventData, actionValue) {
        console.log('[local-actions] Notifying', 'recognition:', eventData, 'config value:', actionValue);
    },
    'API': function(eventData, actionValue) {
        console.log('[local-actions] Calling API', 'recognition:', eventData, 'config value:', actionValue);
    },
    'DB': function(eventData, actionValue) {
        console.log('[local-actions] Writing to DB', 'recognition:', eventData, 'config value:', actionValue);
    },
    'local-001': function(eventData, actionValue) {
        console.log('[local-actions] Running 001 action', 'recognition:', eventData, 'config value:', actionValue);
    }
};