define([], function() {
    return {
        type: "items",
        component: "accordion",
        items: {
            settings: {
                uses: "settings",
                items: {
                    customPrompt: {
                        ref: "props.customPrompt",
                        label: "Default Prompt",
                        type: "string",
                        defaultValue: "Ask me about your data or request visualizations..."
                    }
                }
            }
        }
    };
});