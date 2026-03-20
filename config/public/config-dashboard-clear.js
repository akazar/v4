const CONFIG = {
    /////////////////////// LOCAL CONFIG ///////////////////////
    id: 'config-dashboard-clear',
    name: 'Dashboard configuration clear',
    description: 'Default configuration for the dashboard clear',
    ui: true,
    boundingBoxStyles: {
        strokeStyle: '#00FFAA',
        lineWidth: 3,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        shadowBlur: 4,
        font: '16px system-ui, -apple-system, sans-serif',
        labelBgColor: 'rgba(0, 0, 0, 0.8)',
        labelTextColor: '#00FFAA',
        labelPadding: 6,
        borderRadius: 4,
        interval: 1000
    },
    localRecognitionActionFunctions: [],
    localRegularActionFunctions: [],

    /////////////////////// SERVER CONFIG ///////////////////////
    serverReasoning: {
        model: 'openai', // or 'google'
        prompt: 'Describe this image in detail. What objects, people, or scene do you see?'
    },   
    serverRecognitionActionFunctions: [],
    serverReasoningActionFunctions: [],
    serverRegularActionFunctions: [],
};

export default CONFIG;
export { CONFIG };
