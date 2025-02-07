define([], function() {
    'use strict';
    return {
        type: "items",
        component: "accordion",
        items: {
            settings: {
                uses: "settings",
                items: {
                    config: {
                        type: "items",
                        label: "Chatbot Configuration",
                        items: {
                            apiKey: {
                                ref: "apiKey",
                                label: "OpenAI API Key",
                                type: "string",
                                expression: "optional"
                            },
                            objectIds: {
                                ref: "objectIds",
                                label: "QlikSense Object IDs (comma-separated)",
                                type: "string",
                                expression: "optional"
                            },
                            prePrompt: {
                                ref: "prePrompt",
                                label: "Pre-prompt Message",
                                type: "string",
                                expression: "optional",
                                defaultValue: "You are an AI assistant helping with QlikSense data analysis."
                            }
                        }
                    }
                }
            }
        }
    };
});
