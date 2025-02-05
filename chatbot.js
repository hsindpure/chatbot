// chatbot.js
define([
    "qlik",
    "jquery",
    "./properties",
    "text!./template.html",
    "css!./style.css"
], function(qlik, $, properties, template) {
    'use strict';

    // Claude API Configuration
    const CLAUDE_API_KEY = 'your_claude_api_key';
    const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

    return {
        template: template,
        definition: properties,
        support: {
            snapshot: true,
            export: true,
            exportData: true
        },
        controller: ['$scope', function($scope) {
            $scope.messages = [];
            $scope.userInput = '';
            
            var app = qlik.currApp();
            var fieldList = [];
            var dataModel = {};
            
            // Get field list and initialize data model
            app.getList("FieldList").then(function(model) {
                fieldList = model.layout.qFieldList.qItems.map(item => item.qName);
                initializeDataModel();
            });

            // Initialize data model with field values and types
            function initializeDataModel() {
                fieldList.forEach(function(field) {
                    app.field(field).getData().then(function(data) {
                        dataModel[field] = {
                            values: data,
                            type: determineFieldType(data)
                        };
                    });
                });
            }

            function determineFieldType(data) {
                if (data && data[0]) {
                    if (!isNaN(data[0])) return 'numeric';
                    if (!isNaN(Date.parse(data[0]))) return 'date';
                    return 'string';
                }
                return 'string';
            }

            // Call Claude API
            async function callClaudeAPI(prompt, data) {
                try {
                    const response = await fetch(CLAUDE_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': CLAUDE_API_KEY,
                            'anthropic-version': '2023-06-01'
                        },
                        body: JSON.stringify({
                            model: 'claude-3-opus-20240229',
                            max_tokens: 1024,
                            messages: [{
                                role: 'user',
                                content: `Given this data context: ${JSON.stringify(data)}\n\nQuestion: ${prompt}\n\nProvide a detailed analysis and answer.`
                            }]
                        })
                    });

                    const result = await response.json();
                    return result.content[0].text;
                } catch (error) {
                    console.error('Claude API Error:', error);
                    return 'I encountered an error analyzing the data. Please try again.';
                }
            }

            // Process user question with data context
            async function processQuestion(question) {
                // Gather relevant data context
                const dataContext = await gatherDataContext(question);
                
                // Get Claude's analysis
                const claudeResponse = await callClaudeAPI(question, dataContext);
                
                // Check if response contains visualization request
                if (claudeResponse.includes('VISUALIZATION:')) {
                    return handleVisualizationRequest(claudeResponse, dataContext);
                }
                
                return claudeResponse;
            }

            // Gather relevant data for context
            async function gatherDataContext(question) {
                const context = {};
                const keywords = extractKeywords(question);
                
                for (const field of keywords) {
                    if (dataModel[field]) {
                        // Get field data
                        const fieldData = await app.field(field).getData();
                        context[field] = {
                            type: dataModel[field].type,
                            sampleData: fieldData.slice(0, 10), // Send sample data
                            summary: await getFieldSummary(field)
                        };
                    }
                }
                
                return context;
            }

            // Get summary statistics for a field
            async function getFieldSummary(field) {
                if (dataModel[field].type === 'numeric') {
                    const summary = {
                        sum: await app.calculateExpression(`Sum(${field})`),
                        avg: await app.calculateExpression(`Avg(${field})`),
                        min: await app.calculateExpression(`Min(${field})`),
                        max: await app.calculateExpression(`Max(${field})`)
                    };
                    return summary;
                }
                return null;
            }

            // Handle visualization requests from Claude
            async function handleVisualizationRequest(response, dataContext) {
                const vizConfig = extractVisualizationConfig(response);
                if (vizConfig) {
                    const chartObject = await createVisualization(vizConfig);
                    return {
                        text: response.split('VISUALIZATION:')[0].trim(),
                        visualization: chartObject
                    };
                }
                return response;
            }

            // Extract visualization configuration from Claude's response
            function extractVisualizationConfig(response) {
                try {
                    const vizPart = response.split('VISUALIZATION:')[1];
                    return JSON.parse(vizPart);
                } catch (error) {
                    return null;
                }
            }

            // Create QlikSense visualization
            async function createVisualization(config) {
                try {
                    const vis = await app.visualization.create(
                        config.type,
                        config.dimensions,
                        config.measures,
                        config.properties
                    );
                    return vis;
                } catch (error) {
                    console.error('Visualization Error:', error);
                    return null;
                }
            }

            // Handle send message
            $scope.sendMessage = async function() {
                if (!$scope.userInput.trim()) return;

                const userMessage = $scope.userInput;
                $scope.messages.push({
                    type: 'user',
                    text: userMessage
                });

                $scope.userInput = '';

                try {
                    const response = await processQuestion(userMessage);
                    
                    if (typeof response === 'object' && response.visualization) {
                        // Handle response with visualization
                        const chartId = 'chart_' + Date.now();
                        $scope.messages.push({
                            type: 'bot',
                            text: response.text,
                            chartId: chartId
                        });
                        
                        // Render visualization after DOM update
                        setTimeout(() => {
                            response.visualization.show(chartId);
                        }, 100);
                    } else {
                        // Handle text-only response
                        $scope.messages.push({
                            type: 'bot',
                            text: response
                        });
                    }
                    
                    $scope.$apply();
                } catch (error) {
                    console.error('Error processing message:', error);
                    $scope.messages.push({
                        type: 'bot',
                        text: 'Sorry, I encountered an error. Please try again.'
                    });
                    $scope.$apply();
                }
            };

            $scope.handleKeyPress = function(event) {
                if (event.which === 13) {
                    $scope.sendMessage();
                }
            };
        }]
    };
});