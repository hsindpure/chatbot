define([
    "qlik",
    "jquery",
    "./properties",
    "text!./template.html",
    "css!./styles.css"
], function(qlik, $, properties, template) {
    'use strict';

    // Speech recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    // Speech synthesis setup
    const synth = window.speechSynthesis;

    return {
        template: template,
        initialProperties: {
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [],
                qInitialDataFetch: [{
                    qWidth: 10,
                    qHeight: 50
                }]
            }
        },
        definition: properties,
        support: {
            snapshot: true,
            export: true,
            exportData: true
        },
        paint: function($element, layout) {
            this.$scope.layout = layout;
            return qlik.Promise.resolve();
        },
        controller: ['$scope', function($scope) {
            $scope.messages = [];
            $scope.loading = false;
            $scope.objectData = {};

            // Initialize the extension
            function init() {
                const app = qlik.currApp();
                $scope.layout.objectIds?.split(',').forEach(objectId => {
                    objectId = objectId.trim();
                    app.getObject(objectId).then(model => {
                        model.getHyperCubeData('/qHyperCubeDef', [{
                            qTop: 0,
                            qLeft: 0,
                            qWidth: 10,
                            qHeight: 1000
                        }]).then(data => {
                            $scope.objectData[objectId] = data[0];
                        });
                    });
                });
            }

            // Handle voice input
            $scope.startVoiceInput = function() {
                recognition.start();
                $scope.isListening = true;
                $scope.$apply();
            };

            recognition.onresult = function(event) {
                const query = event.results[0][0].transcript;
                $scope.query = query;
                $scope.sendMessage();
                $scope.isListening = false;
                $scope.$apply();
            };

            // Handle voice output
            $scope.speakMessage = function(message) {
                const utterance = new SpeechSynthesisUtterance(message);
                synth.speak(utterance);
            };

            // Copy response to clipboard
            $scope.copyResponse = function(response) {
                navigator.clipboard.writeText(response);
                // Show toast notification
                $scope.showToast = true;
                setTimeout(() => {
                    $scope.showToast = false;
                    $scope.$apply();
                }, 2000);
            };

            // Send message to OpenAI API
            $scope.sendMessage = async function() {
                if (!$scope.query) return;

                const message = {
                    role: 'user',
                    content: $scope.query
                };
                $scope.messages.push(message);
                $scope.loading = true;

                try {
                    // Prepare data context from QlikSense objects
                    let dataContext = '';
                    Object.entries($scope.objectData).forEach(([objectId, data]) => {
                        dataContext += `Data from ${objectId}:\n`;
                        dataContext += JSON.stringify(data) + '\n\n';
                    });

                    // Prepare prompt with context
                    const prompt = `${$scope.layout.prePrompt}\n\nContext:\n${dataContext}\n\nUser Query: ${$scope.query}`;

                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${$scope.layout.apiKey}`
                        },
                        body: JSON.stringify({
                            model: "gpt-4",
                            messages: [{
                                role: "system",
                                content: prompt
                            }],
                            temperature: 0.7
                        })
                    });

                    const data = await response.json();
                    const aiResponse = data.choices[0].message.content;

                    // Check if response contains chart instructions
                    if (aiResponse.toLowerCase().includes('chart')) {
                        // Create visualization using Qlik engine API
                        const app = qlik.currApp();
                        const chartProps = parseChartProperties(aiResponse);
                        const vis = await app.visualization.create(chartProps.type, chartProps.props);
                        const chartId = 'chart_' + Date.now();
                        $scope.messages.push({
                            role: 'assistant',
                            content: aiResponse,
                            chartId: chartId
                        });
                        vis.show(chartId);
                    } else {
                        $scope.messages.push({
                            role: 'assistant',
                            content: aiResponse
                        });
                    }
                } catch (error) {
                    console.error('Error:', error);
                    $scope.messages.push({
                        role: 'assistant',
                        content: 'Sorry, there was an error processing your request.'
                    });
                }

                $scope.loading = false;
                $scope.query = '';
                $scope.$apply();
            };

            // Helper function to parse chart properties from AI response
            function parseChartProperties(response) {
                // Add logic to parse chart type and properties from AI response
                // This is a simplified example
                return {
                    type: 'barchart',
                    props: {
                        qHyperCubeDef: {
                            qDimensions: [],
                            qMeasures: []
                        }
                    }
                };
            }

            init();
        }]
    };
});
